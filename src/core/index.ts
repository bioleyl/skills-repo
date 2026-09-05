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

const SCORE = {
  descriptionMatch: 20,
  keywordMatch: 30,
  nameExactMatch: 100,
  namePartialMatch: 40,
  namePrefixMatch: 60,
} as const;

export interface SearchResult {
  readonly skill: RegistrySkill;
  readonly score: number;
}

function scoreNameMatch(name: string, term: string): number {
  if (name === term) {
    return SCORE.nameExactMatch;
  }
  if (name.startsWith(term)) {
    return SCORE.namePrefixMatch;
  }
  if (name.includes(term)) {
    return SCORE.namePartialMatch;
  }
  return 0;
}

function scoreKeywordMatch(keywords: readonly string[], term: string): number {
  if (keywords.some((keyword) => keyword.toLowerCase().includes(term))) {
    return SCORE.keywordMatch;
  }
  return 0;
}

function keywordTermsMatch(keywords: readonly string[], terms: readonly string[]): boolean {
  return keywords.some((keyword) => terms.some((term) => keyword.toLowerCase().includes(term)));
}

export function searchIndex(index: RegistryIndex, query: string, keywordOnly = false): readonly SearchResult[] {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term !== '');
  if (terms.length === 0) {
    return [];
  }

  return index.skills
    .map((skill) => {
      const name = skill.name.toLowerCase();
      const description = skill.description.toLowerCase();

      let score = 0;
      let hasMatch = false;

      for (const term of terms) {
        const nameScore = scoreNameMatch(name, term);
        if (nameScore > 0) {
          score += nameScore;
          hasMatch = true;
        }

        const descScore = !keywordOnly && description.includes(term) ? SCORE.descriptionMatch : 0;
        if (descScore > 0) {
          score += descScore;
          hasMatch = true;
        }

        const keywordScore = scoreKeywordMatch(skill.keywords, term);
        if (keywordScore > 0) {
          score += keywordScore;
          hasMatch = true;
        }
      }

      if (keywordOnly && !keywordTermsMatch(skill.keywords, terms)) {
        return undefined;
      }

      return hasMatch ? { score, skill } : undefined;
    })
    .filter((result): result is SearchResult => result !== undefined)
    .sort((left, right) => right.score - left.score || left.skill.name.localeCompare(right.skill.name));
}
