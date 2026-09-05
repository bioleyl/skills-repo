import type { AppError, AppErrorTypes } from '../app/context.js';

export interface RenderedError {
  readonly message: string;
  readonly exitCode: 1 | 2;
}

type ErrorHandler<T extends AppErrorTypes> = (error: Extract<AppError, { readonly type: T }>) => RenderedError;
type ErrorHandlers = {
  [T in AppErrorTypes]: ErrorHandler<T>;
};

const errorHandlers: ErrorHandlers = {
  conflict: (error) => ({ exitCode: 1, message: `Refusing to overwrite: ${error.paths.join(', ')}` }),
  filesystem: (error) => ({ exitCode: 1, message: `${error.message} (${error.path})` }),
  incompatible: (error) => ({ exitCode: 1, message: `Skill is not compatible with: ${error.agents.join(', ')}` }),
  invalidLockfile: (error) => ({ exitCode: 1, message: `Invalid lockfile: ${error.message}` }),
  invalidSkill: (error) => ({ exitCode: 1, message: `Invalid skill: ${error.message}` }),
  notFound: (error) => ({ exitCode: 1, message: `Skill not found: ${error.skill}` }),
  registry: (error) => ({ exitCode: 1, message: error.error.message }),
  scriptFailed: (error) => ({ exitCode: 1, message: `${error.message} (${error.hook})` }),
};

function getErrorHandler<T extends AppErrorTypes>(type: T): ErrorHandler<T> {
  return errorHandlers[type];
}

function renderErrorByType<T extends AppErrorTypes>(
  error: Extract<AppError, { readonly type: T }>
): RenderedError {
  return getErrorHandler(error.type)(error);
}

export function renderError(error: AppError): RenderedError {
  return renderErrorByType(error);
}
