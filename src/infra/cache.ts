import { parseRegistryIndex } from '../core/index.js';

import type { RegistrySource, SkillFile } from '../types/domain.js';
import type { ClockPort, FsPort, RegistryClientPort } from '../types/ports.js';

interface CacheEntry<T> {
  readonly cachedAt: string;
  readonly value: T;
}

function cacheKey(source: RegistrySource): string {
  return encodeURIComponent(JSON.stringify([source.ownerRepo, source.ref]));
}

function cachedFilesPath(root: string, source: RegistrySource, sha: string, skillPath: string): string {
  return `${root}/${cacheKey(source)}_${encodeURIComponent(sha)}_${encodeURIComponent(skillPath)}.files.json`;
}

function isSafeRelativePath(path: string): boolean {
  return (
    !path.startsWith('/')
    && !path.includes('\\')
    && path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
  );
}

function isSkillFiles(value: unknown): value is readonly SkillFile[] {
  return (
    Array.isArray(value)
    && value.every(
      (entry) =>
        typeof entry === 'object'
        && entry !== null
        && 'path' in entry
        && typeof entry.path === 'string'
        && isSafeRelativePath(entry.path)
        && 'content' in entry
        && typeof entry.content === 'string'
    )
  );
}

function cachedPath(root: string, source: RegistrySource, suffix: string): string {
  return `${root}/${cacheKey(source)}.${suffix}.json`;
}

export interface CacheOptions {
  readonly directory: string;
  readonly ttlMs?: number;
  readonly noCache?: boolean;
}

export function createCachedRegistryClient(
  client: RegistryClientPort,
  fs: FsPort,
  clock: ClockPort,
  options: CacheOptions
): RegistryClientPort {
  const ttlMs = options.ttlMs ?? 5 * 60 * 1000;
  const readCache = async <T>(path: string, maxAgeMs = ttlMs): Promise<T | undefined> => {
    const result = await fs.readFile(path);
    if (!result.ok) {
      return undefined;
    }
    try {
      const input: unknown = JSON.parse(result.value);
      if (
        typeof input !== 'object'
        || input === null
        || !('cachedAt' in input)
        || typeof input.cachedAt !== 'string'
        || !('value' in input)
        || !Number.isFinite(new Date(input.cachedAt).getTime())
      ) {
        return undefined;
      }
      const entry = input as CacheEntry<T>;
      if (
        maxAgeMs !== Number.POSITIVE_INFINITY
        && clock.now().getTime() - new Date(entry.cachedAt).getTime() > maxAgeMs
      ) {
        return undefined;
      }
      return entry.value;
    } catch {
      return undefined;
    }
  };
  const writeCache = async <T>(path: string, value: T): Promise<void> => {
    await fs.mkdir(options.directory);
    await fs.writeFile(
      path,
      JSON.stringify({ cachedAt: clock.now().toISOString(), value } satisfies CacheEntry<T>)
    );
  };
  return {
    async fetchSkillFiles(source, skillPath, sha, files) {
      const path = cachedFilesPath(options.directory, source, sha, skillPath);
      if (!options.noCache) {
        const cached = await readCache<unknown>(path, Number.POSITIVE_INFINITY);
        if (
          isSkillFiles(cached)
          && files.every((file) => isSafeRelativePath(file) && cached.some((entry) => entry.path === file))
        ) {
          return { ok: true, value: cached.filter((entry) => files.includes(entry.path)) };
        }
      }
      const result = await client.fetchSkillFiles(source, skillPath, sha, files);
      if (result.ok && !options.noCache) {
        await writeCache(path, result.value);
      }
      return result;
    },
    async getIndex(source) {
      if (!options.noCache) {
        const cached = await readCache<unknown>(cachedPath(options.directory, source, 'index'));
        if (cached !== undefined) {
          const parsed = parseRegistryIndex(JSON.stringify(cached));
          if (parsed.ok) {
            return parsed;
          }
        }
      }
      const result = await client.getIndex(source);
      if (result.ok && !options.noCache) {
        await writeCache(cachedPath(options.directory, source, 'index'), result.value);
      }
      return result;
    },
  };
}
