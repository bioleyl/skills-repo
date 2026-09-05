import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

import { createAgentDetector } from '../infra/agentDetector.js';
import { createCachedRegistryClient } from '../infra/cache.js';
import { processEnv, systemClock } from '../infra/clockEnv.js';
import { createFsAdapter } from '../infra/fsAdapter.js';
import { createGithubRegistryClient } from '../infra/githubClient.js';
import { createFetchHttpClient } from '../infra/httpClient.js';
import { createLocalRegistryClient } from '../infra/localRegistryClient.js';
import { createScriptExecutor } from '../infra/scriptExecutor.js';

import type { AppContext } from '../app/context.js';
import type { AgentId, RegistrySource, Scope } from '../types/domain.js';

export const defaultOwnerRepo = 'bioleyl/skills-repo' as const;

export interface RuntimeOptions {
  readonly registry?: string;
  readonly scope?: Scope;
  readonly noCache?: boolean;
}

export interface Runtime {
  readonly context: AppContext;
  readonly scope: Scope;
}

function parseSource(value: string): { readonly source: RegistrySource; readonly localRoot?: string } {
  if (value.startsWith('file://')) {
    return { localRoot: fileURLToPath(value), source: { ownerRepo: 'local/registry', ref: 'main' } };
  }
  const separator = value.lastIndexOf('@');
  const ownerRepo = separator < 0 ? value : value.slice(0, separator);
  const ref = separator < 0 ? 'main' : value.slice(separator + 1);
  if (!/^[^/]+\/[^/]+$/.test(ownerRepo) || ref === '') {
    throw new Error('Registry must be owner/repo[@ref] or file://<path>');
  }
  return { source: { ownerRepo: ownerRepo as `${string}/${string}`, ref } };
}

export function createRuntime(options: RuntimeOptions = {}): Runtime {
  const registryValue = options.registry ?? processEnv.get('SKILLS_REPO_REGISTRY') ?? defaultOwnerRepo;
  const parsed = parseSource(registryValue);
  const fs = createFsAdapter(process.cwd());
  const token = processEnv.get('GITHUB_TOKEN');
  const registry =
    parsed.localRoot === undefined
      ? createCachedRegistryClient(
          createGithubRegistryClient(createFetchHttpClient(), token === undefined ? {} : { token }),
          fs,
          systemClock,
          {
            directory: `${homedir()}/.cache/skills-repo`,
            ...(options.noCache === undefined ? {} : { noCache: options.noCache }),
          }
        )
      : createLocalRegistryClient(fs, parsed.localRoot);
  const separator = process.platform === 'win32' ? '\\' : '/';
  const scope = options.scope ?? 'project';
  return {
    context: {
      clock: systemClock,
      detector: createAgentDetector(),
      environment: {
        configHome: processEnv.get('XDG_CONFIG_HOME') ?? [homedir(), '.config'].join(separator),
        homeDir: homedir(),
        separator,
      },
      executor: createScriptExecutor(),
      fs,
      registry,
      source: parsed.source,
    },
    scope,
  };
}

export function parseAgents(values: readonly string[] | undefined): readonly AgentId[] | undefined {
  if (values === undefined || values.length === 0) {
    return undefined;
  }
  const allowed: readonly AgentId[] = ['portable', 'claude-code', 'codex', 'cursor', 'windsurf'];
  const agents = values.flatMap((value) => value.split(',').map((item) => item.trim())).filter(Boolean);
  if (agents.some((agent) => !allowed.includes(agent as AgentId))) {
    throw new Error(`Unknown agent. Choose from: ${allowed.join(', ')}`);
  }
  return [...new Set(agents as AgentId[])];
}
