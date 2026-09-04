import { describe, expect, it } from 'vitest';

import { addSkill } from '../src/app/addSkill.js';
import { readLockfile } from '../src/app/helpers.js';
import { removeSkills } from '../src/app/removeSkill.js';

import type { AppContext } from '../src/app/context.js';
import type { RegistryIndex, Result, SemVer, Sha, SkillFile, SkillName } from '../src/types/domain.js';
import type { FsError, FsPort, RegistryClientPort, RegistryError } from '../src/types/ports.js';

const sha = '0123456789abcdef0123456789abcdef01234567';
const source = { ownerRepo: 'owner/repo', ref: 'main' } as const;
const index: RegistryIndex = {
  commitSha: sha as Sha,
  generatedAt: '2025-09-04T12:00:00Z',
  skills: [
    {
      description: 'A demo skill.',
      files: ['SKILL.md', 'skill.json'],
      keywords: ['demo'],
      name: 'demo-skill' as SkillName,
      path: 'skills/demo-skill',
      sizeBytes: 100,
      version: '1.0.0' as SemVer,
    },
  ],
  version: 1,
};

function fakeContext(): { readonly context: AppContext; readonly files: Map<string, string> } {
  const files = new Map<string, string>();
  const fs: FsPort = {
    apply: async (operations) => {
      for (const operation of operations) {
        if (operation.action === 'delete') {
          for (const file of files.keys()) {
            if (file === operation.path || file.startsWith(`${operation.path}/`)) {
              files.delete(file);
            }
          }
          continue;
        }
        if (operation.content === undefined) {
          return { error: { message: 'missing content', path: operation.path, type: 'write' }, ok: false };
        }
        files.set(operation.path, operation.content);
      }
      return { ok: true, value: undefined };
    },
    exists: async (path) => files.has(path),
    mkdir: async () => ({ ok: true, value: undefined }),
    readFile: async (path): Promise<Result<string, FsError>> => {
      const value = files.get(path);
      return value === undefined
        ? { error: { message: 'missing', path, type: 'read' }, ok: false }
        : { ok: true, value };
    },
    rm: async (path) => {
      for (const file of files.keys()) {
        if (file === path || file.startsWith(`${path}/`)) {
          files.delete(file);
        }
      }
      return { ok: true, value: undefined };
    },
    writeFile: async (path, content) => {
      files.set(path, content);
      return { ok: true, value: undefined };
    },
  };
  const registry: RegistryClientPort = {
    fetchSkillFiles: async (): Promise<Result<readonly SkillFile[], RegistryError>> => ({
      ok: true,
      value: [
        { content: '---\nname: demo-skill\ndescription: A demo skill.\n---\n', path: 'SKILL.md' },
        {
          content: '{"name":"demo-skill","version":"1.0.0","description":"A demo skill.","keywords":["demo"]}',
          path: 'skill.json',
        },
      ],
    }),
    getIndex: async () => ({ ok: true, value: index }),
  };
  return {
    context: {
      clock: { now: () => new Date('2025-09-04T12:00:00Z') },
      detector: {
        detect: () => [
          { detected: false, id: 'claude-code' },
          { detected: false, id: 'portable' },
        ],
      },
      environment: { homeDir: '/home/test', separator: '/' },
      fs,
      registry,
      source,
    },
    files,
  };
}

describe('skill app use cases', () => {
  it('rejects a lockfile created for another registry', async () => {
    const { context, files } = fakeContext();
    files.set(
      'skills.lock.json',
      JSON.stringify({ registry: { ownerRepo: 'other/repo', ref: 'main' }, skills: [], version: 1 })
    );

    await expect(readLockfile(context, 'project', source)).resolves.toMatchObject({
      error: { type: 'invalid-lockfile' },
      ok: false,
    });
  });

  it('adds, records, conflicts, and removes a skill', async () => {
    const { context, files } = fakeContext();
    const added = await addSkill(context, { name: 'demo-skill', policy: { scope: 'project' } });
    expect(added.ok).toBe(true);
    expect(files.has('.agents/skills/demo-skill/SKILL.md')).toBe(true);
    expect(files.has('skills.lock.json')).toBe(true);

    const conflict = await addSkill(context, { name: 'demo-skill', policy: { scope: 'project' } });
    expect(conflict).toMatchObject({ error: { type: 'conflict' }, ok: false });

    const removed = await removeSkills(context, ['demo-skill'], 'project');
    expect(removed).toEqual({ ok: true, value: { removed: ['demo-skill'] } });
    expect(files.has('.agents/skills/demo-skill/SKILL.md')).toBe(false);
  });
});
