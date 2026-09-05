import { resolveInstallTargets } from './targets.js';

import type {
  DetectedAgent,
  FileOperation,
  InstallPlan,
  RegistrySource,
  SkillFile,
  SkillManifest,
} from '../types/domain.js';
import type { InstallPolicy, TargetEnvironment } from './targets.js';

export function planInstall(
  skill: SkillManifest,
  source: RegistrySource,
  commitSha: string,
  files: readonly SkillFile[],
  policy: InstallPolicy,
  detectedAgents: readonly DetectedAgent[],
  environment: TargetEnvironment
): InstallPlan {
  const targets = resolveInstallTargets(policy, detectedAgents, skill.name, environment);
  const operations: FileOperation[] = [];
  for (const target of targets) {
    for (const file of files) {
      operations.push({
        action: 'write',
        content: file.content,
        path: [target.path, file.path.replace(/[\\/]/g, environment.separator)].join(environment.separator),
      });
    }
  }

  return { commitSha, operations, skill, source, targets };
}
