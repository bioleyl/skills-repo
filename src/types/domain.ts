export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export type SkillName = string & { readonly __brand: 'SkillName' };
export type SemVer = string & { readonly __brand: 'SemVer' };
export type Sha = string & { readonly __brand: 'Sha' };

export type AgentId = 'portable' | 'claude-code' | 'codex' | 'cursor' | 'windsurf';
export type Scope = 'project' | 'user';

export interface RegistrySource {
  readonly ownerRepo: `${string}/${string}`;
  readonly ref: string;
}

export interface SkillDoc {
  readonly name: SkillName;
  readonly description: string;
}

export interface SkillManifest {
  readonly name: SkillName;
  readonly version: SemVer;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly author?: string;
  readonly license?: string;
  readonly compatibility: readonly AgentId[];
}

export interface RegistrySkill {
  readonly name: SkillName;
  readonly description: string;
  readonly version: SemVer;
  readonly keywords: readonly string[];
  readonly path: string;
  readonly files: readonly string[];
  readonly sizeBytes: number;
}

export interface RegistryIndex {
  readonly version: 1;
  readonly generatedAt: string;
  readonly commitSha: Sha;
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
  readonly commitSha: Sha;
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
  readonly name: SkillName;
  readonly version: SemVer;
  readonly commitSha: Sha;
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
  | { readonly type: 'invalid-lockfile'; readonly message: string }
  | { readonly type: 'inconsistent-skill'; readonly message: string };
