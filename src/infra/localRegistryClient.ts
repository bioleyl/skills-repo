import { parseRegistryIndex } from '../core/index.js';

import type { RegistrySource, Result, SkillFile } from '../types/domain.js';
import type { FsPort, RegistryClientPort, RegistryError } from '../types/ports.js';

function isSafeRelativePath(path: string): boolean {
  return (
    !path.startsWith('/')
    && !path.includes('\\')
    && path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
  );
}

export function createLocalRegistryClient(fs: FsPort, root: string): RegistryClientPort {
  const read = async (path: string): Promise<Result<string, RegistryError>> => {
    const result = await fs.readFile(`${root}/${path}`);
    return result.ok ? result : { error: { message: result.error.message, type: 'not-found' }, ok: false };
  };

  return {
    async fetchSkillFiles(_source, skillPath, _sha, files) {
      if (!/^skills\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skillPath)) {
        return { error: { message: 'Invalid skill path', type: 'invalid-response' }, ok: false };
      }
      if (files.length > 20 || files.some((file) => !isSafeRelativePath(file))) {
        return { error: { message: 'Skill contains an unsafe file path', type: 'invalid-response' }, ok: false };
      }

      const output: SkillFile[] = [];
      for (const file of files) {
        const content = await read(`${skillPath}/${file}`);
        if (!content.ok) {
          return content;
        }
        output.push({ content: content.value, path: file });
      }
      return { ok: true, value: output };
    },
    async getIndex(_source: RegistrySource) {
      const content = await read('registry.json');
      if (!content.ok) {
        return content;
      }
      const parsed = parseRegistryIndex(content.value);
      return parsed.ok
        ? parsed
        : { error: { message: parsed.error.message, type: 'invalid-response' }, ok: false };
    },
  };
}
