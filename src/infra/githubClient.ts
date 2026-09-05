import { parseRegistryIndex } from '../core/index.js';

import type { RegistrySource, Result, SkillFile } from '../types/domain.js';
import type { HttpPort, RegistryClientPort, RegistryError } from '../types/ports.js';

const maxFileBytes = 512 * 1024;
const maxConcurrency = 6;
const maxTotalBytes = 2 * 1024 * 1024;

function encodedPath(path: string): string {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function isSafeRelativePath(path: string): boolean {
  return (
    !path.startsWith('/')
    && !path.includes('\\')
    && path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
  );
}

function errorFromHttp(result: {
  readonly type: 'network' | 'http';
  readonly message: string;
  readonly status?: number;
}): RegistryError {
  return result.type === 'network'
    ? { message: result.message, type: 'network' }
    : {
        message: result.message,
        ...(result.status === undefined ? {} : { status: result.status }),
        type: result.status === 404 ? 'notFound' : 'invalid-response',
      };
}

export interface GithubClientOptions {
  readonly token?: string;
  readonly maxFileBytes?: number;
  readonly concurrency?: number;
}

export function createGithubRegistryClient(http: HttpPort, options: GithubClientOptions = {}): RegistryClientPort {
  const fileLimit = options.maxFileBytes ?? maxFileBytes;
  const concurrency = Math.max(1, options.concurrency ?? maxConcurrency);
  const headers: Record<string, string> = Object.fromEntries([['Accept', 'application/json']]);
  if (options.token !== undefined) {
    Object.assign(headers, Object.fromEntries([['Authorization', `Bearer ${options.token}`]]));
  }

  const defaultBranchApi = (ownerRepo: string): string =>
    `https://api.github.com/repos/${encodedPath(ownerRepo)}/branches/main`;

  const resolveRef = async (source: RegistrySource, ref: string): Promise<Result<string, RegistryError>> => {
    const response = await http.get(defaultBranchApi(source.ownerRepo));
    if (!response.ok) {
      return { error: errorFromHttp(response.error), ok: false };
    }
    if (response.value.status !== 200) {
      return {
        error: {
          message: `GitHub returned HTTP ${response.value.status}`,
          status: response.value.status,
          type: response.value.status === 404 ? 'notFound' : 'invalid-response',
        },
        ok: false,
      };
    }
    const parsed = JSON.parse(response.value.body) as { readonly name: string };
    return parsed.name === undefined
      ? {
          error: { message: 'GitHub default branch response is missing name', type: 'invalid-response' },
          ok: false,
        }
      : { ok: true, value: parsed.name };
  };

  const rawUrl = (source: RegistrySource, ref: string, path: string): string =>
    `https://raw.githubusercontent.com/${encodedPath(source.ownerRepo)}/${encodedPath(ref)}/${encodedPath(path)}`;
  const treeUrl = (source: RegistrySource): string =>
    `https://api.github.com/repos/${encodedPath(source.ownerRepo)}/git/trees/${encodedPath(source.ref)}?recursive=1`;

  const getText = async (url: string): Promise<Result<string, RegistryError>> => {
    const response = await http.get(url, headers);
    if (!response.ok) {
      return { error: errorFromHttp(response.error), ok: false };
    }
    if (response.value.status !== 200) {
      return {
        error: {
          message: `GitHub returned HTTP ${response.value.status}`,
          status: response.value.status,
          type: response.value.status === 404 ? 'notFound' : 'invalid-response',
        },
        ok: false,
      };
    }
    return { ok: true, value: response.value.body };
  };

  return {
    async fetchSkillFiles(source, skillPath, sha, files) {
      if (!/^skills\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skillPath)) {
        return { error: { message: 'Invalid skill path', type: 'invalid-response' }, ok: false };
      }
      if (files.length > 20 || files.some((file) => !isSafeRelativePath(file))) {
        return { error: { message: 'Skill contains an unsafe file path', type: 'invalid-response' }, ok: false };
      }

      const output: SkillFile[] = new Array(files.length);
      let next = 0;
      let totalBytes = 0;
      const worker = async (): Promise<Result<void, RegistryError>> => {
        while (true) {
          const index = next;
          next += 1;
          const file = files[index];
          if (file === undefined) {
            return { ok: true, value: undefined };
          }
          const response = await getText(rawUrl(source, sha, `${skillPath}/${file}`));
          if (!response.ok) {
            return response;
          }
          const fileBytes = Buffer.byteLength(response.value, 'utf8');
          totalBytes += fileBytes;
          if (fileBytes > fileLimit || totalBytes > maxTotalBytes) {
            return {
              error: {
                message:
                  fileBytes > fileLimit
                    ? `File exceeds the ${fileLimit}-byte limit: ${file}`
                    : 'Skill exceeds the 2 MiB size limit',
                type: 'invalid-response',
              },
              ok: false,
            };
          }
          output[index] = { content: response.value, path: file };
        }
      };

      const workers = await Promise.all(
        Array.from({ length: Math.min(concurrency, files.length) }, () => worker())
      );
      const failure = workers.find((result) => !result.ok);
      if (failure !== undefined && !failure.ok) {
        return failure;
      }
      return { ok: true, value: output };
    },
    async getIndex(source) {
      const response = await getText(rawUrl(source, source.ref, 'registry.json'));
      if (response.ok) {
        const parsed = parseRegistryIndex(response.value);
        return parsed.ok
          ? parsed
          : { error: { message: parsed.error.message, type: 'invalid-response' }, ok: false };
      }
      const branch = await resolveRef(source, source.ref);
      if (!branch.ok || branch.value === source.ref) {
        return response;
      }
      const fallbackResponse = await getText(rawUrl(source, branch.value, 'registry.json'));
      if (!fallbackResponse.ok) {
        return response;
      }
      const parsed = parseRegistryIndex(fallbackResponse.value);
      return parsed.ok
        ? parsed
        : { error: { message: parsed.error.message, type: 'invalid-response' }, ok: false };
    },
    async refreshTree(source) {
      const response = await getText(treeUrl(source));
      if (!response.ok) {
        return response;
      }
      let input: unknown;
      try {
        input = JSON.parse(response.value) as unknown;
      } catch {
        return {
          error: { message: 'GitHub tree response is not valid JSON', type: 'invalid-response' },
          ok: false,
        };
      }
      if (typeof input !== 'object' || input === null || !('tree' in input) || !Array.isArray(input.tree)) {
        return {
          error: { message: 'GitHub tree response has an invalid shape', type: 'invalid-response' },
          ok: false,
        };
      }
      const paths: string[] = [];
      for (const item of input.tree) {
        if (typeof item !== 'object' || item === null || !('path' in item) || typeof item.path !== 'string') {
          continue;
        }
        if ('type' in item && item.type === 'blob' && isSafeRelativePath(item.path)) {
          paths.push(item.path);
        }
      }
      return { ok: true, value: paths };
    },
  };
}
