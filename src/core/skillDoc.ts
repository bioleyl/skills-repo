import { skillDocSchema } from './schema.js';

import type { Result, SkillDoc, SkillName } from '../types/domain.js';

const frontmatterDelimiter = /^---\s*$/;

function unquote(value: string): string {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function parseFrontmatter(text: string): Record<string, string> | undefined {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lines[0] === undefined || !frontmatterDelimiter.test(lines[0])) {
    return undefined;
  }

  const closingIndex = lines.findIndex((line, index) => index > 0 && frontmatterDelimiter.test(line));
  if (closingIndex < 0) {
    return undefined;
  }

  const fields: Record<string, string> = {};
  for (let index = 1; index < closingIndex; index += 1) {
    const line = lines[index];
    if (line === undefined || line.trim() === '' || line.trimStart().startsWith('#')) {
      continue;
    }
    const separator = line.indexOf(':');
    if (separator <= 0) {
      return undefined;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (value === '>' || value === '|') {
      const body: string[] = [];
      index += 1;
      while (index < closingIndex) {
        const bodyLine = lines[index];
        if (bodyLine === undefined) {
          break;
        }
        body.push(bodyLine.replace(/^\s{2}/, '').trimEnd());
        index += 1;
      }
      index -= 1;
      fields[key] = value === '>' ? body.join(' ').trim() : body.join('\n').trim();
    } else {
      fields[key] = unquote(value);
    }
  }
  return fields;
}

export function parseSkillMd(
  text: string
): Result<SkillDoc, { readonly type: 'invalid-document'; readonly message: string }> {
  const raw = parseFrontmatter(text);
  if (raw === undefined) {
    return {
      error: { message: 'SKILL.md must start with YAML frontmatter', type: 'invalid-document' },
      ok: false,
    };
  }

  const parsed = skillDocSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: { message: parsed.error.message, type: 'invalid-document' }, ok: false };
  }

  return {
    ok: true,
    value: {
      description: parsed.data.description,
      name: parsed.data.name as SkillName,
    },
  };
}
