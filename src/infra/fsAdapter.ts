import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import type { FileOperation, Result } from '../types/domain.js';
import type { FsError, FsPort } from '../types/ports.js';

type AbsolutePath = (path: string) => string;
type Snapshots = ReadonlyMap<string, string | undefined>;

function failure(type: FsError['type'], path: string, error: unknown): Result<never, FsError> {
  return {
    error: { message: error instanceof Error ? error.message : String(error), path, type },
    ok: false,
  };
}

function isMissingPath(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

async function getBackupRoot(path: string): Promise<Result<string, FsError>> {
  try {
    return { ok: true, value: await mkdtemp(join(tmpdir(), 'skills-repo-')) };
  } catch (error) {
    return failure('write', path, error);
  }
}

async function createSnapshot(
  operationPath: string,
  backupRoot: string,
  backupIndex: number,
  absolutePath: AbsolutePath
): Promise<Result<string | undefined, FsError>> {
  try {
    await access(absolutePath(operationPath));
  } catch (error) {
    if (isMissingPath(error)) {
      return { ok: true, value: undefined };
    }
    return failure('read', operationPath, error);
  }

  const backupPath = join(backupRoot, String(backupIndex));
  try {
    await cp(absolutePath(operationPath), backupPath, { recursive: true });
    return { ok: true, value: backupPath };
  } catch (error) {
    return failure('read', operationPath, error);
  }
}

async function createSnapshots(
  operations: readonly FileOperation[],
  backupRoot: string,
  absolutePath: AbsolutePath
): Promise<Result<Snapshots, FsError>> {
  const snapshots = new Map<string, string | undefined>();
  for (const operation of operations) {
    if (snapshots.has(operation.path)) {
      continue;
    }
    const snapshot = await createSnapshot(operation.path, backupRoot, snapshots.size, absolutePath);
    if (!snapshot.ok) {
      return snapshot;
    }
    snapshots.set(operation.path, snapshot.value);
  }
  return { ok: true, value: snapshots };
}

async function applyOperation(operation: FileOperation, absolutePath: AbsolutePath): Promise<void> {
  if (operation.action === 'delete') {
    await rm(absolutePath(operation.path), { force: true, recursive: true });
    return;
  }
  if (operation.content === undefined) {
    throw new Error('Missing file content');
  }
  await mkdir(dirname(absolutePath(operation.path)), { recursive: true });
  await writeFile(absolutePath(operation.path), operation.content, 'utf8');
}

async function applyOperations(
  operations: readonly FileOperation[],
  absolutePath: AbsolutePath
): Promise<Result<void, FsError>> {
  for (const operation of operations) {
    try {
      await applyOperation(operation, absolutePath);
    } catch (error) {
      const type = operation.action === 'delete' ? 'remove' : 'write';
      return failure(type, operation.path, error);
    }
  }
  return { ok: true, value: undefined };
}

async function restoreSnapshots(snapshots: Snapshots, absolutePath: AbsolutePath): Promise<void> {
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
}

async function removeBackupRoot(backupRoot: string): Promise<void> {
  try {
    await rm(backupRoot, { force: true, recursive: true });
  } catch {
    // Cleanup must not mask the operation result.
  }
}

export function createFsAdapter(root = process.cwd()): FsPort {
  const absolutePath: AbsolutePath = (path) =>
    path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path) ? path : resolve(root, path);

  return {
    async apply(operations) {
      const firstOperation = operations[0];
      if (firstOperation === undefined) {
        return { ok: true, value: undefined };
      }

      const backupRoot = await getBackupRoot(firstOperation.path);
      if (!backupRoot.ok) {
        return backupRoot;
      }

      try {
        const snapshots = await createSnapshots(operations, backupRoot.value, absolutePath);
        if (!snapshots.ok) {
          return snapshots;
        }
        const applied = await applyOperations(operations, absolutePath);
        if (applied.ok) {
          return applied;
        }
        await restoreSnapshots(snapshots.value, absolutePath);
        return applied;
      } finally {
        await removeBackupRoot(backupRoot.value);
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
