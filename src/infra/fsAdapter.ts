import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

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
    async apply(operations) {
      if (operations.length === 0) {
        return { ok: true, value: undefined };
      }
      let currentPath = operations[0]?.path ?? root;
      let backupRoot: string;
      try {
        backupRoot = await mkdtemp(join(tmpdir(), 'skills-repo-'));
      } catch (error) {
        return failure('write', currentPath, error);
      }
      const snapshots = new Map<string, string | undefined>();
      try {
        for (const operation of operations) {
          currentPath = operation.path;
          if (snapshots.has(operation.path)) {
            continue;
          }
          try {
            await access(absolutePath(operation.path));
          } catch (error) {
            if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
              snapshots.set(operation.path, undefined);
              continue;
            }
            return failure('read', operation.path, error);
          }
          const backupPath = join(backupRoot, String(snapshots.size));
          await cp(absolutePath(operation.path), backupPath, { recursive: true });
          snapshots.set(operation.path, backupPath);
        }

        for (const operation of operations) {
          currentPath = operation.path;
          if (operation.action === 'delete') {
            await rm(absolutePath(operation.path), { force: true, recursive: true });
            continue;
          }
          if (operation.content === undefined) {
            throw new Error('Missing file content');
          }
          await mkdir(dirname(absolutePath(operation.path)), { recursive: true });
          await writeFile(absolutePath(operation.path), operation.content, 'utf8');
        }
        return { ok: true, value: undefined };
      } catch (error) {
        for (const [path, backupPath] of [...snapshots].reverse()) {
          try {
            await rm(absolutePath(path), { force: true, recursive: true });
            if (backupPath !== undefined) {
              await cp(backupPath, absolutePath(path), { recursive: true });
            }
          } catch {
            // Preserve the original operation failure; rollback is best effort.
          }
        }
        return failure('write', currentPath, error);
      } finally {
        try {
          await rm(backupRoot, { force: true, recursive: true });
        } catch {
          // Cache cleanup must not mask the operation result.
        }
      }
    },
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
