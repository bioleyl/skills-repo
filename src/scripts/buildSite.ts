#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { buildRegistry } from '../infra/registryBuilder.js';

function commitSha(): string {
  if (process.env.GITHUB_SHA !== undefined) {
    return process.env.GITHUB_SHA;
  }
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '0000000000000000000000000000000000000000';
  }
}

const root = process.cwd();
const result = await buildRegistry(root, commitSha());
if (!result.ok) {
  process.stderr.write(
    `${result.error.skill === undefined ? '' : `${result.error.skill}: `}${result.error.message}\n`
  );
  process.exitCode = 1;
} else {
  const siteDirectory = join(root, 'site');
  await mkdir(siteDirectory, { recursive: true });
  await writeFile(join(siteDirectory, 'skills.json'), `${JSON.stringify(result.value)}\n`, 'utf8');
  process.stdout.write(`Generated site data for ${result.value.skills.length} skills\n`);
}
