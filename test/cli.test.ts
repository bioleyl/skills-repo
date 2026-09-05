import { describe, expect, it } from 'vitest';

import { renderError } from '../src/cli/errors.js';

describe('renderError', () => {
  it('renders a script-failed error', () => {
    const result = renderError({ hook: 'postInstall', message: 'command not found', type: 'scriptFailed' });
    expect(result.message).toBe('command not found (postInstall)');
    expect(result.exitCode).toBe(1);
  });
});
