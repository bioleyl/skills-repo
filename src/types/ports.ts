import type {
  AgentId,
  DetectedAgent,
  FileOperation,
  RegistryIndex,
  RegistrySource,
  Result,
  SkillFile,
} from './domain.js';

export interface HttpBody {
  readonly status: number;
  readonly body: string;
}

export interface HttpPort {
  get(url: string, headers?: Readonly<Record<string, string>>): Promise<Result<HttpBody, HttpError>>;
}

export interface HttpError {
  readonly type: 'network' | 'http';
  readonly message: string;
  readonly status?: number;
}

export interface RegistryClientPort {
  getIndex(source: RegistrySource): Promise<Result<RegistryIndex, RegistryError>>;
  fetchSkillFiles(
    source: RegistrySource,
    skillPath: string,
    sha: string,
    files: readonly string[]
  ): Promise<Result<readonly SkillFile[], RegistryError>>;
  refreshTree?(source: RegistrySource): Promise<Result<readonly string[], RegistryError>>;
}

export interface RegistryError {
  readonly type: 'network' | 'not-found' | 'invalid-response';
  readonly message: string;
  readonly status?: number;
}

export interface FsPort {
  readFile(path: string): Promise<Result<string, FsError>>;
  writeFile(path: string, content: string): Promise<Result<void, FsError>>;
  apply(operations: readonly FileOperation[]): Promise<Result<void, FsError>>;
  mkdir(path: string): Promise<Result<void, FsError>>;
  rm(path: string): Promise<Result<void, FsError>>;
  exists(path: string): Promise<boolean>;
}

export interface FsError {
  readonly type: 'read' | 'write' | 'mkdir' | 'remove';
  readonly message: string;
  readonly path: string;
}

export interface AgentDetectorPort {
  detect(): readonly DetectedAgent[];
}

export interface ClockPort {
  now(): Date;
}

export interface EnvPort {
  get(name: string): string | undefined;
}

export interface ConsolePort {
  stdout(message: string): void;
  stderr(message: string): void;
}

export interface ScriptExecutorPort {
  execute(scriptPath: string, cwd: string): Promise<Result<void, ScriptError>>;
}

export interface ScriptError {
  readonly type: 'script-failed';
  readonly message: string;
  readonly code: number | null;
}

export const agentIds: readonly AgentId[] = ['portable', 'claude-code', 'codex', 'cursor', 'windsurf'];
