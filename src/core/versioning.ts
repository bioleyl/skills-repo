import semver from 'semver';

import type { RegistrySkill, Result } from '../types/domain.js';

export function compareVersions(left: string, right: string): number {
  return semver.compare(left, right);
}

export function isNewerVersion(candidate: string, installed: string): boolean {
  return compareVersions(candidate, installed) > 0;
}

export function hasSkillChanged(
  installed: { readonly version: string; readonly commitSha: string },
  available: RegistrySkill,
  availableCommitSha: string
): boolean {
  return installed.version !== available.version || installed.commitSha !== availableCommitSha;
}

export function parseVersion(value: string): Result<string, string> {
  return semver.valid(value) === null ? { error: `Invalid SemVer: ${value}`, ok: false } : { ok: true, value };
}
