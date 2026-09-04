import { nativeSkillDirectory } from '../core/targets.js';

import type { AppContext, AppResult } from './context.js';

export async function detectAgents(
  context: AppContext,
  scope: 'project' | 'user' = 'project'
): Promise<AppResult<readonly unknown[]>> {
  const detected = context.detector.detect();
  return {
    ok: true,
    value: detected.map((agent) => {
      const base = nativeSkillDirectory(agent.id, scope).replace(/[\\/]/g, context.environment.separator);
      const path =
        scope === 'user' ? [context.environment.homeDir, base].join(context.environment.separator) : base;
      return { agent: agent.id, detected: agent.detected, path };
    }),
  };
}
