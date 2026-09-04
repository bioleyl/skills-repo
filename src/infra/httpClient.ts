import type { Result } from '../types/domain.js';
import type { HttpError, HttpPort } from '../types/ports.js';

export function createFetchHttpClient(fetcher: typeof fetch = fetch): HttpPort {
  return {
    async get(url, headers): Promise<Result<{ readonly status: number; readonly body: string }, HttpError>> {
      try {
        const response = await fetcher(url, headers === undefined ? undefined : { headers });
        return { ok: true, value: { body: await response.text(), status: response.status } };
      } catch (error) {
        return {
          error: {
            message: error instanceof Error ? error.message : 'Network request failed',
            type: 'network',
          },
          ok: false,
        };
      }
    },
  };
}
