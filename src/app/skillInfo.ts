import { findSkill } from '../core/index.js';
import { checkDocManifestConsistency, parseSkillJson } from '../core/manifest.js';
import { parseSkillMd } from '../core/skillDoc.js';
import { hasSkillChanged } from '../core/versioning.js';
import { readLockfile } from './helpers.js';

import type { AppContext, AppResult } from './context.js';

export interface SkillInfoOutput {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly keywords: readonly string[];
  readonly compatibility: readonly string[];
  readonly installed: boolean;
  readonly upToDate: boolean;
}

export async function skillInfo(
  context: AppContext,
  name: string,
  scope: 'project' | 'user' = 'project'
): Promise<AppResult<SkillInfoOutput>> {
  const index = await context.registry.getIndex(context.source);
  if (!index.ok) {
    return { error: { error: index.error, type: 'registry' }, ok: false };
  }
  const entry = findSkill(index.value, name);
  if (entry === undefined) {
    return { error: { skill: name, type: 'not-found' }, ok: false };
  }

  const files = await context.registry.fetchSkillFiles(
    context.source,
    entry.path,
    index.value.commitSha,
    entry.files
  );
  if (!files.ok) {
    return { error: { error: files.error, type: 'registry' }, ok: false };
  }
  const document = files.value.find((file) => file.path === 'SKILL.md');
  const manifestFile = files.value.find((file) => file.path === 'skill.json');
  if (document === undefined || manifestFile === undefined) {
    return { error: { message: 'Skill is missing SKILL.md or skill.json', type: 'invalid-skill' }, ok: false };
  }
  const parsedDoc = parseSkillMd(document.content);
  const parsedManifest = parseSkillJson(manifestFile.content);
  if (!parsedDoc.ok) {
    return { error: { message: parsedDoc.error.message, type: 'invalid-skill' }, ok: false };
  }
  if (!parsedManifest.ok) {
    return { error: { message: parsedManifest.error.message, type: 'invalid-skill' }, ok: false };
  }
  const consistent = checkDocManifestConsistency(parsedDoc.value, parsedManifest.value);
  if (!consistent.ok) {
    return { error: { message: consistent.error.message, type: 'invalid-skill' }, ok: false };
  }
  if (parsedManifest.value.name !== entry.name || parsedManifest.value.version !== entry.version) {
    return {
      error: { message: 'Downloaded skill metadata does not match registry.json', type: 'invalid-skill' },
      ok: false,
    };
  }

  const lockfile = await readLockfile(context, scope, context.source);
  if (!lockfile.ok) {
    return lockfile;
  }
  const installed = lockfile.value.skills.find((skill) => skill.name === entry.name);
  return {
    ok: true,
    value: {
      compatibility: parsedManifest.value.compatibility,
      description: parsedManifest.value.description,
      installed: installed !== undefined,
      keywords: parsedManifest.value.keywords,
      name: parsedManifest.value.name,
      upToDate: installed !== undefined && !hasSkillChanged(installed, entry, index.value.commitSha),
      version: parsedManifest.value.version,
    },
  };
}
