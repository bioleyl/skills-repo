import type { AgentId, DetectedAgent, Scope } from '../types/domain.js';

export interface TargetEnvironment {
  readonly configHome?: string;
  readonly homeDir: string;
  readonly separator: '/' | '\\';
}

export interface InstallPolicy {
  readonly scope: Scope;
  readonly agents?: readonly AgentId[];
}

const projectDirectories: Readonly<Record<AgentId, string>> = {
  'claude-code': '.claude/skills',
  codex: '.codex/skills',
  cursor: '.cursor/skills',
  portable: '.agents/skills',
  windsurf: '.windsurf/skills',
};

const userDirectories: Readonly<Record<AgentId, string>> = {
  'claude-code': '.claude/skills',
  codex: '.codex/skills',
  cursor: '.cursor/skills',
  portable: '.agents/skills',
  windsurf: '.codeium/windsurf/skills',
};

function joinPath(separator: '/' | '\\', ...parts: string[]): string {
  return parts
    .filter((part) => part !== '')
    .join(separator)
    .replace(/[\\/]+/g, separator);
}

export function resolveAgents(
  detectedAgents: readonly DetectedAgent[],
  requestedAgents?: readonly AgentId[]
): readonly AgentId[] {
  if (requestedAgents !== undefined && requestedAgents.length > 0) {
    return [...new Set(requestedAgents)];
  }

  const agents: AgentId[] = ['portable'];
  if (detectedAgents.some((agent) => agent.id === 'claude-code' && agent.detected)) {
    agents.push('claude-code');
  }
  return agents;
}

export function resolveInstallTargets(
  policy: InstallPolicy,
  detectedAgents: readonly DetectedAgent[],
  skillName: string,
  environment: TargetEnvironment
): readonly { readonly agent: AgentId; readonly scope: Scope; readonly path: string }[] {
  const agents = resolveAgents(detectedAgents, policy.agents);
  return agents.map((agent) => {
    const base = nativeSkillDirectory(agent, policy.scope);
    const root = policy.scope === 'user' ? joinPath(environment.separator, environment.homeDir, base) : base;
    return { agent, path: joinPath(environment.separator, root, skillName), scope: policy.scope };
  });
}

export function nativeSkillDirectory(agent: AgentId, scope: Scope = 'project'): string {
  return scope === 'user' ? userDirectories[agent] : projectDirectories[agent];
}
