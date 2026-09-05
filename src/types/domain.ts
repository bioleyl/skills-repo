export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export type SemVer = string;
export type Sha = string;
export type SkillName = string;
export type AgentId = 'portable' | 'claude-code' | 'codex' | 'cursor' | 'windsurf';
export type HookName = 'preUninstall' | 'postUninstall' | 'postInstall';

export type Hooks = {
  preUninstall?: string | undefined;
  postUninstall?: string | undefined;
  postInstall?: string | undefined;
};
export type Scope = 'project' | 'user';

export interface RegistrySource {
  readonly ownerRepo: string;
  readonly ref: string;
}

export interface SkillDoc {
  readonly name: string;
  readonly description: string;
}

export interface SkillManifest {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly author?: string | undefined;
  readonly license?: string | undefined;
  readonly compatibility: readonly AgentId[];
  readonly hooks?: Hooks | undefined;
}

export interface RegistrySkill {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly keywords: readonly string[];
  readonly path: string;
  readonly files: readonly string[];
  readonly sizeBytes: number;
}

export interface RegistryIndex {
  readonly version: 1;
  readonly generatedAt: string;
  readonly commitSha: string;
  readonly skills: readonly RegistrySkill[];
}

export interface SkillFile {
  readonly path: string;
  readonly content: string;
}

export interface InstallTarget {
  readonly agent: AgentId;
  readonly scope: Scope;
  readonly path: string;
}

export interface FileOperation {
  readonly action: 'write' | 'delete';
  readonly path: string;
  readonly content?: string;
}

export interface InstallPlan {
  readonly skill: SkillManifest;
  readonly source: RegistrySource;
  readonly commitSha: string;
  readonly targets: readonly InstallTarget[];
  readonly operations: readonly FileOperation[];
}

export interface DetectedAgent {
  readonly id: AgentId;
  readonly detected: boolean;
}

export interface LockfileTarget {
  readonly agent: AgentId;
  readonly path: string;
}

export interface LockfileSkill {
  readonly hooks?: Hooks | undefined;
  readonly name: string;
  readonly version: string;
  readonly commitSha: string;
  readonly installedAt: string;
  readonly scope: Scope;
  readonly targets: readonly LockfileTarget[];
}

export interface Lockfile {
  readonly version: 1;
  readonly registry: RegistrySource;
  readonly skills: readonly LockfileSkill[];
}

export type CoreError =
  | { readonly type: 'invalid-document'; readonly message: string }
  | { readonly type: 'invalid-manifest'; readonly message: string }
  | { readonly type: 'invalid-index'; readonly message: string }
  | { readonly type: 'invalidLockfile'; readonly message: string }
  | { readonly type: 'inconsistent-skill'; readonly message: string };
