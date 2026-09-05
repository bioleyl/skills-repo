import type { AppError } from '../app/context.js';

export interface RenderedError {
  readonly message: string;
  readonly exitCode: 1 | 2;
}

export function renderError(error: AppError): RenderedError {
  switch (error.type) {
    case 'conflict':
      return { exitCode: 1, message: `Refusing to overwrite: ${error.paths.join(', ')}` };
    case 'filesystem':
      return { exitCode: 1, message: `${error.message} (${error.path})` };
    case 'incompatible':
      return { exitCode: 1, message: `Skill is not compatible with: ${error.agents.join(', ')}` };
    case 'invalid-lockfile':
      return { exitCode: 1, message: `Invalid lockfile: ${error.message}` };
    case 'invalid-skill':
      return { exitCode: 1, message: `Invalid skill: ${error.message}` };
    case 'not-found':
      return { exitCode: 1, message: `Skill not found: ${error.skill}` };
    case 'registry':
      return { exitCode: 1, message: error.error.message };
    case 'script-failed':
      return { exitCode: 1, message: `${error.message} (${error.hook})` };
  }
  return { exitCode: 1, message: 'An unknown error occurred' };
}
