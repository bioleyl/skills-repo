import { registryIndexSchema } from './schema.js';

import type { CoreError, RegistryIndex, RegistrySkill, Result, SkillName } from '../types/domain.js';

export function parseRegistryIndex(
  text: string
): Result<RegistryIndex, Extract<CoreError, { readonly type: 'invalid-index' }>> {
  let input: unknown;
  try {
    input = JSON.parse(text) as unknown;
  } catch {
    return { error: { message: 'registry.json is not valid JSON', type: 'invalid-index' }, ok: false };
  }

  const parsed = registryIndexSchema.safeParse(input);
  if (!parsed.success) {
    return { error: { message: parsed.error.message, type: 'invalid-index' }, ok: false };
  }

  for (const skill of parsed.data.skills) {
    if (skill.path !== `skills/${skill.name}`) {
      return { error: { message: `Invalid path for skill ${skill.name}`, type: 'invalid-index' }, ok: false };
    }
    if (!skill.files.includes('SKILL.md') || !skill.files.includes('skill.json')) {
      return {
        error: { message: `Skill ${skill.name} is missing a required file`, type: 'invalid-index' },
        ok: false,
      };
    }
    if (skill.files.some((file) => !isSafeRelativePath(file))) {
      return {
        error: { message: `Skill ${skill.name} contains an unsafe file path`, type: 'invalid-index' },
        ok: false,
      };
    }
    if (skill.sizeBytes > 2 * 1024 * 1024) {
      return {
        error: { message: `Skill ${skill.name} exceeds the size limit`, type: 'invalid-index' },
        ok: false,
      };
    }
  }

  return {
    ok: true,
    value: {
      ...parsed.data,
      commitSha: parsed.data.commitSha as RegistryIndex['commitSha'],
      skills: parsed.data.skills.map((skill) => ({
        ...skill,
        name: skill.name as SkillName,
        version: skill.version as RegistrySkill['version'],
      })),
    },
  };
}

function isSafeRelativePath(file: string): boolean {
  return (
    !file.startsWith('/')
    && !file.includes('\\')
    && file.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')
  );
}

export function findSkill(index: RegistryIndex, name: string): RegistrySkill | undefined {
  return index.skills.find((skill) => skill.name === name);
}

export interface SearchResult {
  readonly skill: RegistrySkill;
  readonly score: number;
}

export function searchIndex(index: RegistryIndex, query: string, keywordOnly = false): readonly SearchResult[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return [];
  }

  return index.skills
    .map((skill) => {
      const name = skill.name.toLowerCase();
      const description = skill.description.toLowerCase();
      const keywordMatch = skill.keywords.some((keyword) => keyword.toLowerCase().includes(needle));
      if (keywordOnly && !keywordMatch) {
        return undefined;
      }

      let score = 0;
      if (name === needle) {
        score += 100;
      } else if (name.startsWith(needle)) {
        score += 60;
      } else if (name.includes(needle)) {
        score += 40;
      }
      if (!keywordOnly && description.includes(needle)) {
        score += 20;
      }
      if (keywordMatch) {
        score += 30;
      }
      return score === 0 ? undefined : { score, skill };
    })
    .filter((result): result is SearchResult => result !== undefined)
    .sort((left, right) => right.score - left.score || left.skill.name.localeCompare(right.skill.name));
}
