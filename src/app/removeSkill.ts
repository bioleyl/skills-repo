import { applyRemove } from '../core/lockfile.js';
import { resolveInstallTargets } from '../core/targets.js';
import { readLockfile, writeLockfile } from './helpers.js';

import type { SkillName } from '../types/domain.js';
import type { AppContext, AppResult } from './context.js';

export interface RemoveSkillOutput {
  readonly removed: readonly string[];
}

export async function removeSkills(
  context: AppContext,
  names: readonly string[],
  scope: 'project' | 'user'
): Promise<AppResult<RemoveSkillOutput>> {
  const lockfile = await readLockfile(context, scope, context.source);
  if (!lockfile.ok) {
    return lockfile;
  }
  const entries = names.map((name) => lockfile.value.skills.find((skill) => skill.name === name));
  const missing = names.find((_, index) => entries[index] === undefined);
  if (missing !== undefined) {
    return { error: { skill: missing, type: 'not-found' }, ok: false };
  }

  const paths: string[] = [];
  for (const entry of entries) {
    if (entry === undefined) {
      continue;
    }
    const expected = resolveInstallTargets(
      { agents: entry.targets.map((target) => target.agent), scope: entry.scope },
      [],
      entry.name,
      context.environment
    ).map((target) => target.path);
    for (const target of entry.targets) {
      if (!expected.includes(target.path)) {
        return {
          error: { message: `Lockfile target is not derived: ${target.path}`, type: 'invalid-lockfile' },
          ok: false,
        };
      }
      paths.push(target.path);
    }
  }

  for (const path of paths) {
    const result = await context.fs.rm(path);
    if (!result.ok) {
      return { error: { message: result.error.message, path: result.error.path, type: 'filesystem' }, ok: false };
    }
  }
  const updated = applyRemove(
    lockfile.value,
    entries
      .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined)
      .map((entry) => entry.name as SkillName)
  );
  const written = await writeLockfile(context, scope, updated);
  if (!written.ok) {
    return written;
  }
  return { ok: true, value: { removed: names } };
}
