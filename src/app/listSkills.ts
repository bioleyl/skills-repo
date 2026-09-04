import { hasSkillChanged } from '../core/versioning.js';
import { readLockfile } from './helpers.js';

import type { AppContext, AppResult } from './context.js';

export interface InstalledSkill {
  readonly name: string;
  readonly version: string;
  readonly targets: readonly string[];
  readonly upToDate: boolean;
}

export async function listSkills(
  context: AppContext,
  available = false,
  scope: 'project' | 'user' = 'project'
): Promise<AppResult<readonly unknown[]>> {
  if (available) {
    const index = await context.registry.getIndex(context.source);
    return index.ok
      ? { ok: true, value: index.value.skills }
      : { error: { error: index.error, type: 'registry' }, ok: false };
  }
  const lockfile = await readLockfile(context, scope, context.source);
  if (!lockfile.ok) {
    return lockfile;
  }
  const index = await context.registry.getIndex(context.source);
  if (!index.ok) {
    return { error: { error: index.error, type: 'registry' }, ok: false };
  }
  return {
    ok: true,
    value: lockfile.value.skills.map((skill): InstalledSkill => {
      const availableSkill = index.value.skills.find((candidate) => candidate.name === skill.name);
      return {
        name: skill.name,
        targets: skill.targets.map((target) => target.agent),
        upToDate: availableSkill !== undefined && !hasSkillChanged(skill, availableSkill, index.value.commitSha),
        version: skill.version,
      };
    }),
  };
}
