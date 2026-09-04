import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { AgentId, DetectedAgent } from '../types/domain.js';
import type { EnvPort } from '../types/ports.js';

const agentMarkers: Readonly<Record<AgentId, readonly string[]>> = {
  'claude-code': ['.claude'],
  codex: ['.codex'],
  cursor: ['.cursor'],
  portable: ['.agents'],
  windsurf: ['.windsurf', '.codeium'],
};

const agentEnvironment: Readonly<Partial<Record<AgentId, string>>> = {
  'claude-code': 'CLAUDE_CODE',
  codex: 'CODEX_HOME',
  cursor: 'CURSOR_TRACE_ID',
  windsurf: 'WINDSURF_HOME',
};

export interface AgentDetectorOptions {
  readonly cwd?: string;
  readonly homeDir?: string;
  readonly env?: EnvPort;
  readonly exists?: (path: string) => boolean;
}

export function createAgentDetector(options: AgentDetectorOptions = {}): { detect(): readonly DetectedAgent[] } {
  const cwd = options.cwd ?? process.cwd();
  const homeDir = options.homeDir ?? homedir();
  const env = options.env ?? { get: (name: string) => process.env[name] };
  const pathExists = options.exists ?? existsSync;

  return {
    detect: () =>
      (Object.keys(agentMarkers) as AgentId[]).map((id) => {
        const markerDetected = agentMarkers[id].some(
          (marker) => pathExists(join(cwd, marker)) || pathExists(join(homeDir, marker))
        );
        const environmentName = agentEnvironment[id];
        const environmentDetected = environmentName !== undefined && env.get(environmentName) !== undefined;
        return { detected: markerDetected || environmentDetected, id };
      }),
  };
}
