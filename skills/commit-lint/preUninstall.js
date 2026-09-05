import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const repoRoot = join(__dirname, '..', '..', '..');
const hookFile = join(repoRoot, '.git', 'hooks', 'commit-msg');

if (existsSync(hookFile)) {
  rmSync(hookFile);
  console.log('commit-msg hook removed.');
} else {
  console.log('commit-msg hook not found, nothing to do.');
}
