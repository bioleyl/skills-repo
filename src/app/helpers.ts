import { emptyLockfile, parseLockfile, serializeLockfile } from '../core/lockfile.js';

import type { Lockfile, RegistrySource, Result, Scope } from '../types/domain.js';
import type { AppContext, AppError } from './context.js';

export async function readLockfile(
  context: AppContext,
  scope: Scope,
  source: RegistrySource
): Promise<Result<Lockfile, AppError>> {
  const path = lockfilePathFor(context, scope);
  if (!(await context.fs.exists(path))) {
    return { ok: true, value: emptyLockfile(source) };
  }
  const content = await context.fs.readFile(path);
  if (!content.ok) {
    return { error: { message: content.error.message, path: content.error.path, type: 'filesystem' }, ok: false };
  }
  const parsed = parseLockfile(content.value);
  if (!parsed.ok) {
    return { error: { message: parsed.error.message, type: 'invalidLockfile' }, ok: false };
  }
  if (parsed.value.registry.ownerRepo !== source.ownerRepo || parsed.value.registry.ref !== source.ref) {
    return {
      error: {
        message: `Lockfile belongs to ${parsed.value.registry.ownerRepo}@${parsed.value.registry.ref}`,
        type: 'invalidLockfile',
      },
      ok: false,
    };
  }
  return parsed;
}

export async function writeLockfile(
  context: AppContext,
  scope: Scope,
  lockfile: Lockfile
): Promise<Result<void, AppError>> {
  const path = lockfilePathFor(context, scope);
  const result = await context.fs.writeFile(path, serializeLockfile(lockfile));
  return result.ok
    ? result
    : { error: { message: result.error.message, path: result.error.path, type: 'filesystem' }, ok: false };
}

export function lockfilePathFor(context: AppContext, scope: Scope): string {
  return scope === 'project'
    ? 'skills.lock.json'
    : [
        context.environment.configHome
          ?? [context.environment.homeDir, '.config'].join(context.environment.separator),
        'skills-repo',
        'lock.json',
      ].join(context.environment.separator);
}
