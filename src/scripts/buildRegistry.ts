#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

import { buildRegistry, writeRegistry } from '../infra/registryBuilder.js';

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

const result = await buildRegistry(process.cwd(), commitSha());
if (!result.ok) {
  process.stderr.write(
    `${result.error.skill === undefined ? '' : `${result.error.skill}: `}${result.error.message}\n`
  );
  process.exitCode = 1;
} else {
  await writeRegistry(process.cwd(), result.value);
  process.stdout.write(`Generated registry.json with ${result.value.skills.length} skills\n`);
}
