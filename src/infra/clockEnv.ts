import type { ClockPort, ConsolePort, EnvPort } from '../types/ports.js';

export const systemClock: ClockPort = {
  now: () => new Date(),
};

export const processEnv: EnvPort = {
  get: (name) => process.env[name],
};

export const processConsole: ConsolePort = {
  stderr: (message) => process.stderr.write(`${message}\n`),
  stdout: (message) => process.stdout.write(`${message}\n`),
};
