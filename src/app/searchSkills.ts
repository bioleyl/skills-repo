import { searchIndex } from '../core/index.js';

import type { AppContext, AppResult } from './context.js';

export async function searchSkills(
  context: AppContext,
  query: string,
  keywordOnly = false
): Promise<AppResult<ReturnType<typeof searchIndex>>> {
  const result = await context.registry.getIndex(context.source);
  return result.ok
    ? { ok: true, value: searchIndex(result.value, query, keywordOnly) }
    : { error: { error: result.error, type: 'registry' }, ok: false };
}
