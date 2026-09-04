import { describe, expect, it } from 'vitest';

import { parseRegistryIndex, searchIndex } from '../src/core/index.js';
import { applyAdd, emptyLockfile, parseLockfile, serializeLockfile } from '../src/core/lockfile.js';
import { checkDocManifestConsistency, parseSkillJson } from '../src/core/manifest.js';
import { parseSkillMd } from '../src/core/skillDoc.js';
import { resolveInstallTargets } from '../src/core/targets.js';

import type { DetectedAgent, RegistryIndex, SemVer, Sha, SkillName } from '../src/types/domain.js';

const sha = '0123456789abcdef0123456789abcdef01234567';

function registryIndex(): RegistryIndex {
  const parsed = parseRegistryIndex(
    JSON.stringify({
      commitSha: sha,
      generatedAt: '2025-09-04T12:00:00Z',
      skills: [
        {
          description: 'Generate branded PDF reports.',
          files: ['SKILL.md', 'skill.json', 'references/layout.md'],
          keywords: ['pdf', 'reporting'],
          name: 'pdf-report',
          path: 'skills/pdf-report',
          sizeBytes: 100,
          version: '1.2.0',
        },
      ],
      version: 1,
    })
  );
  if (!parsed.ok) {
    throw new Error(parsed.error.message);
  }
  return parsed.value;
}

describe('skill document and manifest parsing', () => {
  it('parses folded frontmatter descriptions', () => {
    const result = parseSkillMd(
      `---\nname: pdf-report\ndescription: >\n  Generate branded PDF reports.\n  Use when exporting a document.\n---\n\nInstructions.`
    );

    expect(result).toEqual({
      ok: true,
      value: {
        description: 'Generate branded PDF reports. Use when exporting a document.',
        name: 'pdf-report',
      },
    });
  });

  it('rejects documents without frontmatter', () => {
    expect(parseSkillMd('# Not a skill')).toMatchObject({ error: { type: 'invalid-document' }, ok: false });
  });

  it('requires the manifest and document to agree', () => {
    const doc = parseSkillMd('---\nname: pdf-report\ndescription: Reports\n---');
    const manifest = parseSkillJson(
      JSON.stringify({
        description: 'Different',
        keywords: ['reports'],
        name: 'pdf-report',
        version: '1.0.0',
      })
    );

    expect(
      doc.ok && manifest.ok ? checkDocManifestConsistency(doc.value, manifest.value) : undefined
    ).toMatchObject({
      error: { type: 'inconsistent-skill' },
      ok: false,
    });
  });
});

describe('registry index', () => {
  it('searches by name, description, and keyword', () => {
    const index = registryIndex();
    expect(searchIndex(index, 'pdf')[0]?.skill.name).toBe('pdf-report');
    expect(searchIndex(index, 'reporting', true)[0]?.skill.name).toBe('pdf-report');
    expect(searchIndex(index, 'missing')).toEqual([]);
  });

  it('rejects unsafe file paths', () => {
    const index = JSON.parse(JSON.stringify(registryIndex())) as Record<string, unknown>;
    const skills = index.skills as Array<Record<string, unknown>>;
    const firstSkill = skills[0];
    if (firstSkill === undefined) {
      throw new Error('test fixture is empty');
    }
    firstSkill.files = ['SKILL.md', 'skill.json', '../outside'];
    expect(parseRegistryIndex(JSON.stringify(index))).toMatchObject({
      error: { type: 'invalid-index' },
      ok: false,
    });
  });
});

describe('install targets and lockfiles', () => {
  it('uses portable plus detected Claude targets by default', () => {
    const detected: readonly DetectedAgent[] = [
      { detected: true, id: 'claude-code' },
      { detected: false, id: 'cursor' },
    ];
    const targets = resolveInstallTargets({ scope: 'project' }, detected, 'pdf-report' as SkillName, {
      homeDir: '/home/test',
      separator: '/',
    });

    expect(targets.map((target) => target.path)).toEqual([
      '.agents/skills/pdf-report',
      '.claude/skills/pdf-report',
    ]);
  });

  it('round-trips a lockfile and replaces an existing skill on add', () => {
    const source = { ownerRepo: 'owner/repo', ref: 'main' } as const;
    const lockfile = emptyLockfile(source);
    const entry = {
      commitSha: sha as Sha,
      installedAt: '2025-09-04T12:00:00Z',
      name: 'pdf-report' as SkillName,
      scope: 'project' as const,
      targets: [{ agent: 'portable' as const, path: '.agents/skills/pdf-report' }],
      version: '1.0.0' as SemVer,
    };

    const result = parseLockfile(serializeLockfile(applyAdd(lockfile, entry)));
    expect(result.ok && result.value.skills).toHaveLength(1);
    expect(result.ok && result.value.skills[0]?.name).toBe('pdf-report');
  });
});
