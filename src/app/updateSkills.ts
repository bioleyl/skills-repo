import { findSkill } from '../core/index.js';
import { hasSkillChanged } from '../core/versioning.js';
import { addSkill } from './addSkill.js';
import { readLockfile } from './helpers.js';

import type { InstallPolicy } from '../core/targets.js';
import type { AppContext, AppResult } from './context.js';

export interface UpdateSkill {
  readonly name: string;
  readonly from: string;
  readonly to: string;
}

export interface UpdateOutput {
  readonly updates: readonly UpdateSkill[];
  readonly unavailable: readonly string[];
  readonly dryRun: boolean;
}

export async function updateSkills(
  context: AppContext,
  names: readonly string[] | undefined,
  scope: 'project' | 'user',
  dryRun = false
): Promise<AppResult<UpdateOutput>> {
  const lockfile = await readLockfile(context, scope, context.source);
  if (!lockfile.ok) {
    return lockfile;
  }
  const index = await context.registry.getIndex(context.source);
  if (!index.ok) {
    return { error: { error: index.error, type: 'registry' }, ok: false };
  }

  const selected =
    names === undefined || names.length === 0
      ? lockfile.value.skills
      : lockfile.value.skills.filter((skill) => names.includes(skill.name));
  const missing = names?.find((name) => !lockfile.value.skills.some((skill) => skill.name === name));
  if (missing !== undefined) {
    return { error: { skill: missing, type: 'not-found' }, ok: false };
  }

  const updates: UpdateSkill[] = [];
  const unavailable: string[] = [];
  for (const installed of selected) {
    const available = findSkill(index.value, installed.name);
    if (available === undefined) {
      unavailable.push(installed.name);
      continue;
    }
    if (hasSkillChanged(installed, available, index.value.commitSha)) {
      updates.push({ from: installed.version, name: installed.name, to: available.version });
    }
  }
  if (dryRun || (updates.length === 0 && unavailable.length === 0)) {
    return { ok: true, value: { dryRun, unavailable, updates } };
  }

  for (const update of updates) {
    const installed = selected.find((skill) => skill.name === update.name);
    if (installed === undefined) {
      continue;
    }
    const policy: InstallPolicy = {
      agents: installed.targets.map((target) => target.agent),
      scope: installed.scope,
    };
    const result = await addSkill(context, { force: true, name: update.name, policy });
    if (!result.ok) {
      return result;
    }
  }
  return { ok: true, value: { dryRun: false, unavailable, updates } };
}
