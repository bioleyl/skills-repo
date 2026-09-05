import semver from 'semver';

import { safeParseJson } from '../utils/json.js';
import { skillManifestSchema } from './schema.js';

import type { CoreError, Result, SkillDoc, SkillManifest } from '../types/domain.js';

export function parseSkillJson(
  text: string
): Result<SkillManifest, Extract<CoreError, { readonly type: 'invalid-manifest' }>> {
  const input = safeParseJson(text);
  if (input === undefined) {
    return { error: { message: 'skill.json is not valid JSON', type: 'invalid-manifest' }, ok: false };
  }
  const parsed = skillManifestSchema.safeParse(input);
  if (!parsed.success) {
    return { error: { message: parsed.error.message, type: 'invalid-manifest' }, ok: false };
  }
  if (semver.valid(parsed.data.version) === null) {
    return { error: { message: 'version must be valid SemVer', type: 'invalid-manifest' }, ok: false };
  }

  const { name, version, description, keywords, compatibility, author, license, hooks } = parsed.data;
  return {
    ok: true,
    value: { author, compatibility, description, hooks, keywords, license, name, version },
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
