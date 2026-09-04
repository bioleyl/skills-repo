import semver from 'semver';

import type { RegistrySkill, Result, SemVer } from '../types/domain.js';

export function compareVersions(left: SemVer, right: SemVer): number {
  return semver.compare(left, right);
}

export function isNewerVersion(candidate: SemVer, installed: SemVer): boolean {
  return compareVersions(candidate, installed) > 0;
}

export function hasSkillChanged(
  installed: { readonly version: SemVer; readonly commitSha: string },
  available: RegistrySkill,
  availableCommitSha: string
): boolean {
  return installed.version !== available.version || installed.commitSha !== availableCommitSha;
}

export function parseVersion(value: string): Result<SemVer, string> {
  return semver.valid(value) === null
    ? { error: `Invalid SemVer: ${value}`, ok: false }
    : { ok: true, value: value as SemVer };
}
