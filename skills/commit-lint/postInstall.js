import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const repoRoot = join(__dirname, '..', '..', '..');
const hookFile = join(repoRoot, '.git', 'hooks', 'commit-msg');
const hookSource = join(__dirname, 'commit-msg.hook');

if (existsSync(hookFile)) {
  console.log('commit-msg hook already exists, skipping.');
  process.exit(0);
}

const content = readFileSync(hookSource, 'utf-8');
mkdirSync(dirname(hookFile), { recursive: true });
writeFileSync(hookFile, content, { mode: 0o755 });
console.log('commit-msg hook installed.');
