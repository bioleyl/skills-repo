import { findSkill } from '../core/index.js';
import { applyAdd, lockfileEntry, serializeLockfile } from '../core/lockfile.js';
import { checkDocManifestConsistency, parseSkillJson } from '../core/manifest.js';
import { planInstall } from '../core/planInstall.js';
import { parseSkillMd } from '../core/skillDoc.js';
import { lockfilePathFor, readLockfile } from './helpers.js';

import type { InstallPolicy } from '../core/targets.js';
import type { InstallPlan, InstallTarget, SkillManifest } from '../types/domain.js';
import type { ScriptExecutorPort } from '../types/ports.js';
import type { AppContext, AppResult } from './context.js';

export interface AddSkillInput {
  readonly name: string;
  readonly policy: InstallPolicy;
  readonly force?: boolean;
  readonly allowIncompatible?: boolean;
}

export interface AddSkillOutput {
  readonly name: string;
  readonly version: string;
  readonly targets: readonly InstallTarget[];
}

function invalidSkill(message: string): AppResult<never> {
  return { error: { message, type: 'invalidSkill' }, ok: false };
}

export async function addSkill(context: AppContext, input: AddSkillInput): Promise<AppResult<AddSkillOutput>> {
  const indexResult = await context.registry.getIndex(context.source);
  if (!indexResult.ok) {
    return { error: { error: indexResult.error, type: 'registry' }, ok: false };
  }
  const entry = findSkill(indexResult.value, input.name);
  if (entry === undefined) {
    return { error: { skill: input.name, type: 'notFound' }, ok: false };
  }

  const filesResult = await context.registry.fetchSkillFiles(
    context.source,
    entry.path,
    indexResult.value.commitSha,
    entry.files
  );
  if (!filesResult.ok) {
    return { error: { error: filesResult.error, type: 'registry' }, ok: false };
  }

  const skillFiles = filesResult.value;
  const docFile = skillFiles.find((file) => file.path === 'SKILL.md');
  const manifestFile = skillFiles.find((file) => file.path === 'skill.json');
  if (docFile === undefined || manifestFile === undefined) {
    return invalidSkill('Skill is missing SKILL.md or skill.json');
  }

  const doc = parseSkillMd(docFile.content);
  if (!doc.ok) {
    return invalidSkill(doc.error.message);
  }
  const manifest = parseSkillJson(manifestFile.content);
  if (!manifest.ok) {
    return invalidSkill(manifest.error.message);
  }
  const consistent = checkDocManifestConsistency(doc.value, manifest.value);
  if (!consistent.ok) {
    return invalidSkill(consistent.error.message);
  }
  if (manifest.value.name !== entry.name || manifest.value.version !== entry.version) {
    return invalidSkill('Downloaded skill metadata does not match registry.json');
  }

  const plan = planInstall(
    manifest.value,
    context.source,
    indexResult.value.commitSha,
    skillFiles,
    input.policy,
    context.detector.detect(),
    context.environment
  );
  const incompatibleAgents = plan.targets
    .map((target) => target.agent)
    .filter((agent) => !manifest.value.compatibility.includes(agent));
  if (incompatibleAgents.length > 0 && input.allowIncompatible !== true) {
    return {
      error: { agents: [...new Set(incompatibleAgents)], type: 'incompatible' },
      ok: false,
    };
  }
  const lockfile = await readLockfile(context, input.policy.scope, context.source);
  if (!lockfile.ok) {
    return lockfile;
  }

  const conflicts =
    input.force === true
      ? []
      : (
          await Promise.all(
            plan.operations.map(async (operation) =>
              (await context.fs.exists(operation.path)) ? operation.path : undefined
            )
          )
        ).filter((path): path is string => path !== undefined);
  if (conflicts.length > 0) {
    return { error: { paths: conflicts, type: 'conflict' }, ok: false };
  }

  const updated = applyAdd(
    lockfile.value,
    lockfileEntry(
      manifest.value,
      indexResult.value.commitSha,
      context.clock.now().toISOString(),
      input.policy.scope,
      plan.targets.map(({ agent, path }) => ({ agent, path }))
    )
  );
  const operations = [
    ...plan.operations,
    {
      action: 'write' as const,
      content: serializeLockfile(updated),
      path: lockfilePathFor(context, input.policy.scope),
    },
  ];
  const applied = await context.fs.apply(operations);
  if (!applied.ok) {
    return { error: { message: applied.error.message, path: applied.error.path, type: 'filesystem' }, ok: false };
  }

  const hookResult = await runPostInstall(plan, manifest.value, context.executor);
  if (!hookResult.ok) {
    return hookResult;
  }

  return {
    ok: true,
    value: { name: manifest.value.name, targets: plan.targets, version: manifest.value.version },
  };
}

async function runPostInstall(
  plan: InstallPlan,
  manifest: SkillManifest,
  executor: ScriptExecutorPort
): Promise<AppResult<void>> {
  const hook = manifest.hooks?.postInstall;
  if (hook === undefined) {
    return { ok: true, value: undefined };
  }
  for (const target of plan.targets) {
    const result = await executor.execute(hook, target.path);
    if (!result.ok) {
      return {
        error: { hook: 'postInstall', message: result.error.message, type: 'scriptFailed' },
        ok: false,
      };
    }
  }
  return { ok: true, value: undefined };
}
