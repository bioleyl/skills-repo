import semver from 'semver';

import { skillManifestSchema } from './schema.js';

import type { CoreError, Result, SemVer, SkillDoc, SkillManifest, SkillName } from '../types/domain.js';

export function parseSkillJson(
  text: string
): Result<SkillManifest, Extract<CoreError, { readonly type: 'invalid-manifest' }>> {
  let input: unknown;
  try {
    input = JSON.parse(text) as unknown;
  } catch {
    return { error: { message: 'skill.json is not valid JSON', type: 'invalid-manifest' }, ok: false };
  }

  const parsed = skillManifestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: { message: parsed.error.message, type: 'invalid-manifest' }, ok: false };
  }
  if (semver.valid(parsed.data.version) === null) {
    return { error: { message: 'version must be valid SemVer', type: 'invalid-manifest' }, ok: false };
  }

  const { name, version, description, keywords, compatibility, author, license } = parsed.data;
  return {
    ok: true,
    value: {
      compatibility,
      description,
      keywords,
      name: name as SkillName,
      version: version as SemVer,
      ...(author === undefined ? {} : { author }),
      ...(license === undefined ? {} : { license }),
    },
  };
}

export function checkDocManifestConsistency(
  doc: SkillDoc,
  manifest: SkillManifest
): Result<SkillManifest, Extract<CoreError, { readonly type: 'inconsistent-skill' }>> {
  if (doc.name !== manifest.name) {
    return {
      error: { message: 'SKILL.md name must equal skill.json name', type: 'inconsistent-skill' },
      ok: false,
    };
  }
  if (doc.description !== manifest.description) {
    return {
      error: { message: 'SKILL.md description must equal skill.json description', type: 'inconsistent-skill' },
      ok: false,
    };
  }
  return { ok: true, value: manifest };
}
