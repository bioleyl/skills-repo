import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createCachedRegistryClient } from '../src/infra/cache.js';
import { createFsAdapter } from '../src/infra/fsAdapter.js';
import { createGithubRegistryClient } from '../src/infra/githubClient.js';
import { createLocalRegistryClient } from '../src/infra/localRegistryClient.js';
import { buildRegistry } from '../src/infra/registryBuilder.js';

import type { Result } from '../src/types/domain.js';
import type { ClockPort, FsPort, HttpPort, RegistryClientPort } from '../src/types/ports.js';

const sha = '0123456789abcdef0123456789abcdef01234567';
const source = { ownerRepo: 'owner/repo', ref: 'main' } as const;

const indexBody = JSON.stringify({
  commitSha: sha,
  generatedAt: '2025-09-04T12:00:00Z',
  skills: [
    {
      description: 'A demo skill.',
      files: ['SKILL.md', 'skill.json'],
      keywords: ['demo'],
      name: 'demo-skill',
      path: 'skills/demo-skill',
      sizeBytes: 100,
      version: '1.0.0',
    },
  ],
  version: 1,
});

function fakeHttp(routes: Readonly<Record<string, string>>): HttpPort {
  return {
    get: async (url) => {
      const body = routes[url];
      return body === undefined
        ? { error: { message: 'not found', status: 404, type: 'http' }, ok: false }
        : { ok: true, value: { body, status: 200 } };
    },
  };
}

describe('registry cache', () => {
  it('keeps files from different skills in separate cache entries', async () => {
    const cacheFiles = new Map<string, string>();
    const fs: FsPort = {
      apply: async (operations) => {
        for (const operation of operations) {
          if (operation.action === 'delete') {
            cacheFiles.delete(operation.path);
            continue;
          }
          if (operation.content === undefined) {
            return { error: { message: 'missing content', path: operation.path, type: 'write' }, ok: false };
          }
          cacheFiles.set(operation.path, operation.content);
        }
        return { ok: true, value: undefined };
      },
      exists: async (path) => cacheFiles.has(path),
      mkdir: async () => ({ ok: true, value: undefined }),
      readFile: async (path) => {
        const value = cacheFiles.get(path);
        return value === undefined
          ? { error: { message: 'missing', path, type: 'read' }, ok: false }
          : { ok: true, value };
      },
      rm: async (path) => {
        cacheFiles.delete(path);
        return { ok: true, value: undefined };
      },
      writeFile: async (path, content) => {
        cacheFiles.set(path, content);
        return { ok: true, value: undefined };
      },
    };
    const client: RegistryClientPort = {
      fetchSkillFiles: async (_source, skillPath, _sha, files) => ({
        ok: true,
        value: files.map((path) => ({ content: `${skillPath}/${path}`, path })),
      }),
      getIndex: async () => ({ error: { message: 'unused', type: 'network' }, ok: false }),
    };
    const clock: ClockPort = { now: () => new Date('2025-09-04T12:00:00Z') };
    const cached = createCachedRegistryClient(client, fs, clock, { directory: '/cache' });

    const first = await cached.fetchSkillFiles(source, 'skills/first', sha, ['SKILL.md', 'skill.json']);
    const second = await cached.fetchSkillFiles(source, 'skills/second', sha, ['SKILL.md', 'skill.json']);

    expect(first.ok && first.value[0]?.content).toBe('skills/first/SKILL.md');
    expect(second.ok && second.value[0]?.content).toBe('skills/second/SKILL.md');
  });
});

describe('filesystem adapter', () => {
  it('rolls back a multi-file operation when a later operation fails', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skills-repo-'));
    try {
      const fs = createFsAdapter(root);
      await fs.writeFile('existing.txt', 'before');
      const result = await fs.apply([
        { action: 'write', content: 'after', path: 'existing.txt' },
        { action: 'write', path: 'new.txt' },
      ]);

      expect(result.ok).toBe(false);
      expect(await fs.readFile('existing.txt')).toMatchObject({ ok: true, value: 'before' });
      expect(await fs.exists('new.txt')).toBe(false);
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});

describe('GitHub registry client', () => {
  it('fetches and parses the index and skill files', async () => {
    const base = 'https://raw.githubusercontent.com/owner/repo';
    const http = fakeHttp({
      [`${base}/main/registry.json`]: indexBody,
      [`${base}/${sha}/skills/demo-skill/SKILL.md`]: '---\nname: demo-skill\ndescription: A demo skill.\n---',
      [`${base}/${sha}/skills/demo-skill/skill.json`]: '{"name":"demo-skill"}',
    });
    const client = createGithubRegistryClient(http);

    const index = await client.getIndex(source);
    expect(index.ok && index.value.skills[0]?.name).toBe('demo-skill');
    const files = await client.fetchSkillFiles(source, 'skills/demo-skill', sha, ['SKILL.md', 'skill.json']);
    expect(files.ok && files.value.map((file) => file.path)).toEqual(['SKILL.md', 'skill.json']);
  });

  it('rejects path traversal before making file requests', async () => {
    let requests = 0;
    const http: HttpPort = {
      get: async (): Promise<Result<{ readonly status: number; readonly body: string }, never>> => {
        requests += 1;
        return { ok: true, value: { body: '', status: 200 } };
      },
    };
    const result = await createGithubRegistryClient(http).fetchSkillFiles(source, 'skills/demo-skill', sha, [
      '../secret',
    ]);
    expect(result).toMatchObject({ error: { type: 'invalid-response' }, ok: false });
    expect(requests).toBe(0);
  });
});

describe('registry builder', () => {
  it('builds an index from skill directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skills-repo-'));
    try {
      await mkdir(join(root, 'skills', 'demo-skill'), { recursive: true });
      await writeFile(
        join(root, 'skills', 'demo-skill', 'SKILL.md'),
        '---\nname: demo-skill\ndescription: A demo skill.\n---\n'
      );
      await writeFile(
        join(root, 'skills', 'demo-skill', 'skill.json'),
        '{"name":"demo-skill","version":"1.0.0","description":"A demo skill.","keywords":["demo"]}'
      );
      const result = await buildRegistry(root, sha, '2025-09-04T12:00:00Z');
      expect(result.ok && result.value.skills[0]?.name).toBe('demo-skill');
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});

describe('local registry client', () => {
  it('uses the same index and file contract without HTTP', async () => {
    const files: Record<string, string> = {
      '/fixture/registry.json': indexBody,
      '/fixture/skills/demo-skill/SKILL.md': 'skill',
    };
    const fs = {
      readFile: async (path: string) => {
        const content = files[path];
        return content === undefined
          ? { error: { message: 'missing', path, type: 'read' as const }, ok: false as const }
          : { ok: true as const, value: content };
      },
    };
    const client = createLocalRegistryClient(fs as never, '/fixture');
    const result = await client.fetchSkillFiles(source, 'skills/demo-skill', sha, ['SKILL.md']);
    expect(result).toEqual({ ok: true, value: [{ content: 'skill', path: 'SKILL.md' }] });
  });
});
