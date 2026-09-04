import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

import { parseRegistryIndex } from '../core/index.js';
import { checkDocManifestConsistency, parseSkillJson } from '../core/manifest.js';
import { parseSkillMd } from '../core/skillDoc.js';

import type { Dirent } from 'node:fs';
import type { RegistryIndex, RegistrySkill, Result, Sha } from '../types/domain.js';

const maxFileBytes = 512 * 1024;
const maxSkillBytes = 2 * 1024 * 1024;
const maxFiles = 20;
const zeroSha = '0000000000000000000000000000000000000000' as Sha;

export interface RegistryBuildError {
  readonly type: 'registry-build';
  readonly message: string;
  readonly skill?: string;
}

interface SkillFiles {
  readonly files: readonly string[];
  readonly contents: ReadonlyMap<string, string>;
  readonly sizeBytes: number;
}

async function collectFiles(directory: string): Promise<Result<SkillFiles, RegistryBuildError>> {
  const names: string[] = [];
  const contents = new Map<string, string>();
  let sizeBytes = 0;
  const visit = async (current: string): Promise<Result<void, RegistryBuildError>> => {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = join(current, entry.name);
      const relativePath = relative(directory, absolute).split('\\').join('/');
      if (entry.isSymbolicLink()) {
        return {
          error: { message: `Symlinks are not allowed: ${relativePath}`, type: 'registry-build' },
          ok: false,
        };
      }
      if (entry.isDirectory()) {
        const result = await visit(absolute);
        if (!result.ok) {
          return result;
        }
        continue;
      }
      if (!entry.isFile()) {
        return { error: { message: `Unsupported file type: ${relativePath}`, type: 'registry-build' }, ok: false };
      }
      const bytes = await readFile(absolute);
      if (bytes.byteLength > maxFileBytes) {
        return { error: { message: `File exceeds 512 KiB: ${relativePath}`, type: 'registry-build' }, ok: false };
      }
      sizeBytes += bytes.byteLength;
      if (sizeBytes > maxSkillBytes) {
        return { error: { message: 'Skill exceeds 2 MiB', type: 'registry-build' }, ok: false };
      }
      if (names.length >= maxFiles) {
        return { error: { message: 'Skill contains more than 20 files', type: 'registry-build' }, ok: false };
      }
      let content: string;
      try {
        content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        return {
          error: { message: `File is not valid UTF-8: ${relativePath}`, type: 'registry-build' },
          ok: false,
        };
      }
      names.push(relativePath);
      contents.set(relativePath, content);
    }
    return { ok: true, value: undefined };
  };

  try {
    const result = await visit(directory);
    return result.ok ? { ok: true, value: { contents, files: names.sort(), sizeBytes } } : result;
  } catch (error) {
    return {
      error: { message: error instanceof Error ? error.message : String(error), type: 'registry-build' },
      ok: false,
    };
  }
}

export async function buildRegistry(
  root: string,
  commitSha: string = zeroSha,
  generatedAt = new Date().toISOString()
): Promise<Result<RegistryIndex, RegistryBuildError>> {
  if (!/^[0-9a-f]{40}$/i.test(commitSha)) {
    return {
      error: { message: 'Commit SHA must be 40 hexadecimal characters', type: 'registry-build' },
      ok: false,
    };
  }
  const skillsRoot = join(root, 'skills');
  let directories: Dirent[];
  try {
    directories = await readdir(skillsRoot, { withFileTypes: true });
  } catch (error) {
    return {
      error: { message: error instanceof Error ? error.message : String(error), type: 'registry-build' },
      ok: false,
    };
  }

  const skills: RegistrySkill[] = [];
  for (const directory of directories
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const name = directory.name;
    const skillDirectory = join(skillsRoot, name);
    const collected = await collectFiles(skillDirectory);
    if (!collected.ok) {
      return { error: { ...collected.error, skill: name }, ok: false };
    }
    const skillJson = collected.value.contents.get('skill.json');
    const skillMd = collected.value.contents.get('SKILL.md');
    if (skillJson === undefined || skillMd === undefined) {
      return {
        error: { message: 'Each skill must contain SKILL.md and skill.json', skill: name, type: 'registry-build' },
        ok: false,
      };
    }
    const doc = parseSkillMd(skillMd);
    const manifest = parseSkillJson(skillJson);
    if (!doc.ok) {
      return { error: { message: doc.error.message, skill: name, type: 'registry-build' }, ok: false };
    }
    if (!manifest.ok) {
      return { error: { message: manifest.error.message, skill: name, type: 'registry-build' }, ok: false };
    }
    if (manifest.value.name !== name || doc.value.name !== name) {
      return {
        error: { message: 'Skill names must match the directory name', skill: name, type: 'registry-build' },
        ok: false,
      };
    }
    const consistent = checkDocManifestConsistency(doc.value, manifest.value);
    if (!consistent.ok) {
      return { error: { message: consistent.error.message, skill: name, type: 'registry-build' }, ok: false };
    }
    skills.push({
      description: manifest.value.description,
      files: collected.value.files,
      keywords: manifest.value.keywords,
      name: manifest.value.name,
      path: `skills/${name}`,
      sizeBytes: collected.value.sizeBytes,
      version: manifest.value.version,
    });
  }

  return {
    ok: true,
    value: {
      commitSha: commitSha as Sha,
      generatedAt,
      skills,
      version: 1,
    },
  };
}

export async function writeRegistry(root: string, index: RegistryIndex): Promise<void> {
  await writeFile(join(root, 'registry.json'), `${JSON.stringify(index, null, 2)}\n`, 'utf8');
}

export async function validateRegistry(root: string): Promise<Result<RegistryIndex, RegistryBuildError>> {
  const built = await buildRegistry(root);
  if (!built.ok) {
    return built;
  }
  const parsed = parseRegistryIndex(JSON.stringify(built.value));
  return parsed.ok ? parsed : { error: { message: parsed.error.message, type: 'registry-build' }, ok: false };
}
