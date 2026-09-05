import { safeParseJson } from '../utils/json.js';
import { lockfileSchema } from './schema.js';

import type {
  CoreError,
  Lockfile,
  LockfileSkill,
  RegistrySource,
  Result,
  Scope,
  SkillManifest,
} from '../types/domain.js';

export function parseLockfile(
  text: string
): Result<Lockfile, Extract<CoreError, { readonly type: 'invalid-lockfile' }>> {
  const input = safeParseJson(text);
  if (input === undefined) {
    return { error: { message: 'lockfile is not valid JSON', type: 'invalid-lockfile' }, ok: false };
  }
  const parsed = lockfileSchema.safeParse(input);
  if (!parsed.success) {
    return { error: { message: parsed.error.message, type: 'invalid-lockfile' }, ok: false };
  }
  return { ok: true, value: parsed.data as Lockfile };
}

export function serializeLockfile(lockfile: Lockfile): string {
  return `${JSON.stringify(lockfile, null, 2)}\n`;
}

export function emptyLockfile(registry: RegistrySource): Lockfile {
  return { registry, skills: [], version: 1 };
}

export function applyAdd(lockfile: Lockfile, entry: LockfileSkill): Lockfile {
  const skills = lockfile.skills.filter((skill) => skill.name !== entry.name);
  return { ...lockfile, skills: [...skills, entry] };
}

export function applyRemove(lockfile: Lockfile, names: readonly string[]): Lockfile {
  const removed = new Set(names);
  return { ...lockfile, skills: lockfile.skills.filter((skill) => !removed.has(skill.name)) };
}

export function lockfileEntry(
  skill: SkillManifest,
  commitSha: string,
  installedAt: string,
  scope: Scope,
  targets: LockfileSkill['targets']
): LockfileSkill {
  const { hooks, name, version } = skill;
  return {
    commitSha,
    hooks,
    installedAt,
    name,
    scope,
    targets,
    version,
  };
}
