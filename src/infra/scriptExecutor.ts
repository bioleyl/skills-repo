import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

import type { Result } from '../types/domain.js';
import type { ScriptError, ScriptExecutorPort } from '../types/ports.js';

export function createScriptExecutor(): ScriptExecutorPort {
  return {
    execute: async (scriptPath: string, cwd: string): Promise<Result<void, ScriptError>> => {
      const absolute = isAbsolute(scriptPath) ? scriptPath : resolve(cwd, scriptPath);
      if (!existsSync(absolute)) {
        return {
          error: { code: null, message: `Script not found: ${scriptPath}`, type: 'script-failed' },
          ok: false,
        };
      }

      return new Promise<Result<void, ScriptError>>((resolve) => {
        const child = spawn(process.execPath, [absolute], {
          cwd,
          stdio: ['inherit', 'inherit', 'inherit'],
        });

        child.on('close', (code) => {
          if (code === 0 || code === null) {
            resolve({ ok: true, value: undefined });
          } else {
            resolve({
              error: {
                code,
                message: `Hook exited with code ${code}`,
                type: 'script-failed',
              },
              ok: false,
            });
          }
        });

        child.on('error', () => {
          resolve({
            error: { code: null, message: `Failed to execute script: ${scriptPath}`, type: 'script-failed' },
            ok: false,
          });
        });
      });
    },
  };
}
