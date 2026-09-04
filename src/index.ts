#!/usr/bin/env node

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export * from './app/index.js';
export * from './cli/index.js';
export * from './core/index.js';
export * from './core/lockfile.js';
export * from './core/manifest.js';
export * from './core/planInstall.js';
export * from './core/schema.js';
export * from './core/skillDoc.js';
export * from './core/targets.js';
export * from './core/versioning.js';
export * from './infra/index.js';
export * from './types/domain.js';
export * from './types/ports.js';

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { createProgram } = await import('./cli/program.js');
  try {
    await createProgram().parseAsync(process.argv);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const details =
      process.argv.includes('--debug') && error instanceof Error && error.stack !== undefined
        ? `\n${error.stack}`
        : '';
    process.stderr.write(`${message}${details}\n`);
    process.exitCode = 1;
  }
}
