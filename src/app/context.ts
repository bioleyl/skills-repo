import type { TargetEnvironment } from '../core/targets.js';
import type { RegistrySource, Result } from '../types/domain.js';
import type {
  AgentDetectorPort,
  ClockPort,
  FsPort,
  RegistryClientPort,
  RegistryError,
  ScriptExecutorPort,
} from '../types/ports.js';

export interface AppContext {
  readonly registry: RegistryClientPort;
  readonly executor: ScriptExecutorPort;
  readonly fs: FsPort;
  readonly detector: AgentDetectorPort;
  readonly clock: ClockPort;
  readonly source: RegistrySource;
  readonly environment: TargetEnvironment;
}

export type AppError =
  | { readonly type: 'registry'; readonly error: RegistryError }
  | { readonly type: 'filesystem'; readonly message: string; readonly path: string }
  | { readonly type: 'not-found'; readonly skill: string }
  | { readonly type: 'conflict'; readonly paths: readonly string[] }
  | { readonly type: 'invalid-skill'; readonly message: string }
  | { readonly type: 'incompatible'; readonly agents: readonly string[] }
  | { readonly type: 'invalid-lockfile'; readonly message: string }
  | { readonly type: 'script-failed'; readonly message: string; readonly hook: string };

export type AppResult<T> = Result<T, AppError>;
