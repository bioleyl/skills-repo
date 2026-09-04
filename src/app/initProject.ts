import { emptyLockfile } from '../core/lockfile.js';
import { lockfilePathFor } from './helpers.js';

import type { AppContext, AppResult } from './context.js';

export interface InitOutput {
  readonly path: string;
  readonly agents: readonly string[];
}

export async function initProject(context: AppContext, scope: 'project' | 'user'): Promise<AppResult<InitOutput>> {
  const path = lockfilePathFor(context, scope);
  if (await context.fs.exists(path)) {
    return { error: { paths: [path], type: 'conflict' }, ok: false };
  }
  const result = await context.fs.writeFile(path, `${JSON.stringify(emptyLockfile(context.source), null, 2)}\n`);
  if (!result.ok) {
    return { error: { message: result.error.message, path: result.error.path, type: 'filesystem' }, ok: false };
  }
  return {
    ok: true,
    value: {
      agents: context.detector
        .detect()
        .filter((agent) => agent.detected)
        .map((agent) => agent.id),
      path,
    },
  };
}
