import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { Result } from '../types/domain.js';
import type { FsError, FsPort } from '../types/ports.js';

export function createFsAdapter(root = process.cwd()): FsPort {
  const absolutePath = (path: string): string =>
    path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path) ? path : resolve(root, path);
  const failure = (type: FsError['type'], path: string, error: unknown): Result<never, FsError> => ({
    error: { message: error instanceof Error ? error.message : String(error), path, type },
    ok: false,
  });

  return {
    async exists(path) {
      try {
        await access(absolutePath(path));
        return true;
      } catch {
        return false;
      }
    },
    async mkdir(path) {
      try {
        await mkdir(absolutePath(path), { recursive: true });
        return { ok: true, value: undefined };
      } catch (error) {
        return failure('mkdir', path, error);
      }
    },
    async readFile(path) {
      try {
        return { ok: true, value: await readFile(absolutePath(path), 'utf8') };
      } catch (error) {
        return failure('read', path, error);
      }
    },
    async rm(path) {
      try {
        await rm(absolutePath(path), { force: true, recursive: true });
        return { ok: true, value: undefined };
      } catch (error) {
        return failure('remove', path, error);
      }
    },
    async writeFile(path, content) {
      try {
        await mkdir(dirname(absolutePath(path)), { recursive: true });
        await writeFile(absolutePath(path), content, 'utf8');
        return { ok: true, value: undefined };
      } catch (error) {
        return failure('write', path, error);
      }
    },
  };
}
