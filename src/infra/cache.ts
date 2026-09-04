import type { RegistryIndex, RegistrySource, SkillFile } from '../types/domain.js';
import type { ClockPort, FsPort, RegistryClientPort } from '../types/ports.js';

interface CacheEntry<T> {
  readonly cachedAt: string;
  readonly value: T;
}

function cacheKey(source: RegistrySource): string {
  return `${source.ownerRepo.replace(/[^a-zA-Z0-9._-]/g, '_')}_${source.ref.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
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
      const entry = JSON.parse(result.value) as CacheEntry<T>;
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
      const path = `${options.directory}/${cacheKey(source)}_${sha}.files.json`;
      if (!options.noCache) {
        const cached = await readCache<readonly SkillFile[]>(path, Number.POSITIVE_INFINITY);
        if (cached !== undefined && files.every((file) => cached.some((entry) => entry.path === file))) {
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
        const cached = await readCache<RegistryIndex>(cachedPath(options.directory, source, 'index'));
        if (cached !== undefined) {
          return { ok: true, value: cached };
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
