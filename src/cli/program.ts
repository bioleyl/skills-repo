import { confirm, isCancel } from '@clack/prompts';
import { Command } from 'commander';

import { addSkill } from '../app/addSkill.js';
import { detectAgents } from '../app/detectAgents.js';
import { initProject } from '../app/initProject.js';
import { listSkills } from '../app/listSkills.js';
import { removeSkills } from '../app/removeSkill.js';
import { searchSkills } from '../app/searchSkills.js';
import { skillInfo } from '../app/skillInfo.js';
import { updateSkills } from '../app/updateSkills.js';
import { validateRegistry } from '../infra/registryBuilder.js';
import { renderError } from './errors.js';
import {
  renderAdd,
  renderAgents,
  renderInfo,
  renderJson,
  renderList,
  renderSearch,
  renderUpdates,
} from './render.js';
import { createRuntime, parseAgents } from './runtime.js';

import type { Scope } from '../types/domain.js';

interface GlobalOptions {
  readonly debug?: boolean;
  readonly json?: boolean;
  readonly registry?: string;
  readonly scope?: Scope;
  readonly noCache?: boolean;
}

function globalOptions(command: Command): GlobalOptions {
  const options = command.optsWithGlobals() as GlobalOptions & { readonly cache?: boolean };
  return {
    ...(options.debug === undefined ? {} : { debug: options.debug }),
    ...(options.json === undefined ? {} : { json: options.json }),
    ...(options.registry === undefined ? {} : { registry: options.registry }),
    ...(options.scope === undefined ? {} : { scope: options.scope }),
    ...(options.cache === false ? { noCache: true } : {}),
  };
}

function print(value: unknown, human: string | undefined, json: boolean): void {
  process.stdout.write(`${json ? renderJson(value) : (human ?? '')}\n`);
}

export function createProgram(): Command {
  const program = new Command()
    .name('skills-repo')
    .description('Install and manage AI agent skills')
    .option('--debug', 'include unexpected error details')
    .option('--json', 'print machine-readable JSON')
    .option('--registry <source>', 'owner/repo[@ref] or file://<path>')
    .option('--scope <scope>', 'project or user', 'project')
    .option('--no-cache', 'bypass the registry cache');

  program
    .command('init')
    .option('--scope <scope>', 'project or user')
    .action(async function () {
      const options = globalOptions(this);
      const runtime = createRuntime(options);
      const result = await initProject(runtime.context, (options.scope ?? runtime.scope) as Scope);
      handle(result, options.json, (value) => `Initialized ${value.path}`);
    });

  program
    .command('add')
    .argument('<skills...>')
    .option('--agent <ids...>', 'target agents')
    .option('--scope <scope>', 'project or user')
    .option('--force', 'overwrite existing files')
    .option('--yes', 'accepted for non-interactive use')
    .action(async function (
      names: string[],
      commandOptions: {
        readonly agent?: readonly string[];
        readonly scope?: Scope;
        readonly force?: boolean;
        readonly yes?: boolean;
      }
    ) {
      const options = globalOptions(this);
      const selectedScope = commandOptions.scope ?? options.scope;
      const runtime = createRuntime({
        ...options,
        ...(selectedScope === undefined ? {} : { scope: selectedScope }),
      });
      const agents = parseAgents(commandOptions.agent);
      if (commandOptions.yes !== true && process.stdin.isTTY === true) {
        const index = await runtime.context.registry.getIndex(runtime.context.source);
        if (!index.ok) {
          process.stderr.write(`${index.error.message}\n`);
          process.exitCode = 1;
          return;
        }
        const descriptions = names.map((name) => {
          const entry = index.value.skills.find((skill) => skill.name === name);
          return entry === undefined ? `${name} (not found)` : `${name}: ${entry.description}`;
        });
        const approved = await confirm({ message: `Install these skills?\n${descriptions.join('\n')}` });
        if (isCancel(approved) || !approved) {
          return;
        }
      }
      const values = [];
      for (const name of names) {
        const result = await addSkill(runtime.context, {
          ...(commandOptions.force === undefined ? {} : { force: commandOptions.force }),
          name,
          policy: {
            ...(agents === undefined ? {} : { agents }),
            scope: (commandOptions.scope ?? runtime.scope) as Scope,
          },
        });
        if (!result.ok) {
          return handle(result, options.json);
        }
        values.push(result.value);
      }
      print(values, values.map(renderAdd).join('\n'), options.json === true);
    });

  program
    .command('remove')
    .argument('<skills...>')
    .option('--scope <scope>', 'project or user')
    .option('--yes', 'confirm removal')
    .action(async function (names: string[], commandOptions: { readonly scope?: Scope }) {
      const options = globalOptions(this);
      const selectedScope = commandOptions.scope ?? options.scope;
      const runtime = createRuntime({
        ...options,
        ...(selectedScope === undefined ? {} : { scope: selectedScope }),
      });
      const result = await removeSkills(runtime.context, names, (commandOptions.scope ?? runtime.scope) as Scope);
      handle(result, options.json, (value) => `Removed ${value.removed.join(', ')}`);
    });

  program
    .command('list')
    .option('--available', 'list registry skills instead of installed skills')
    .option('--scope <scope>', 'project or user')
    .action(async function (commandOptions: { readonly available?: boolean; readonly scope?: Scope }) {
      const options = globalOptions(this);
      const selectedScope = commandOptions.scope ?? options.scope;
      const runtime = createRuntime({
        ...options,
        ...(selectedScope === undefined ? {} : { scope: selectedScope }),
      });
      const result = await listSkills(
        runtime.context,
        commandOptions.available,
        (commandOptions.scope ?? runtime.scope) as Scope
      );
      handle(result, options.json, renderList);
    });

  program
    .command('search')
    .argument('<query>')
    .option('--keyword', 'match keywords only')
    .action(async function (query: string, commandOptions: { readonly keyword?: boolean }) {
      const options = globalOptions(this);
      const result = await searchSkills(createRuntime(options).context, query, commandOptions.keyword);
      handle(result, options.json, renderSearch);
    });

  program
    .command('validate')
    .option('--root <path>', 'local checkout to validate', '.')
    .action(async function (commandOptions: { readonly root: string }) {
      const options = globalOptions(this);
      const result = await validateRegistry(commandOptions.root);
      if (result.ok) {
        print(
          { skills: result.value.skills.length, valid: true },
          `Valid registry: ${result.value.skills.length} skills`,
          options.json === true
        );
      } else {
        process.stderr.write(`${options.json ? renderJson({ error: result.error }) : result.error.message}\n`);
        process.exitCode = 1;
      }
    });

  program
    .command('info')
    .argument('<skill>')
    .option('--scope <scope>', 'project or user')
    .action(async function (name: string, commandOptions: { readonly scope?: Scope }) {
      const options = globalOptions(this);
      const selectedScope = commandOptions.scope ?? options.scope;
      const runtime = createRuntime({
        ...options,
        ...(selectedScope === undefined ? {} : { scope: selectedScope }),
      });
      const result = await skillInfo(runtime.context, name, (selectedScope ?? runtime.scope) as Scope);
      handle(result, options.json, renderInfo);
    });

  program
    .command('update')
    .argument('[skills...]')
    .option('--all', 'update every installed skill')
    .option('--dry-run', 'show updates without writing files')
    .option('--scope <scope>', 'project or user')
    .action(async function (
      names: string[] | undefined,
      commandOptions: { readonly all?: boolean; readonly dryRun?: boolean; readonly scope?: Scope }
    ) {
      const options = globalOptions(this);
      const selectedScope = commandOptions.scope ?? options.scope;
      const runtime = createRuntime({
        ...options,
        ...(selectedScope === undefined ? {} : { scope: selectedScope }),
      });
      const result = await updateSkills(
        runtime.context,
        commandOptions.all === true || names === undefined || names.length === 0 ? undefined : names,
        (selectedScope ?? runtime.scope) as Scope,
        commandOptions.dryRun
      );
      handle(result, options.json, renderUpdates);
    });

  program
    .command('agents')
    .option('--scope <scope>', 'project or user')
    .action(async function (commandOptions: { readonly scope?: Scope }) {
      const options = globalOptions(this);
      const selectedScope = commandOptions.scope ?? options.scope;
      const runtime = createRuntime({
        ...options,
        ...(selectedScope === undefined ? {} : { scope: selectedScope }),
      });
      const result = await detectAgents(runtime.context, (commandOptions.scope ?? runtime.scope) as Scope);
      handle(result, options.json, renderAgents);
    });

  return program;
}

function handle<T>(
  result:
    | { readonly ok: true; readonly value: T }
    | { readonly ok: false; readonly error: Parameters<typeof renderError>[0] },
  json = false,
  human?: (value: T) => string
): void {
  if (result.ok) {
    print(result.value, human?.(result.value), json);
    return;
  }
  const rendered = renderError(result.error);
  process.stderr.write(`${json ? renderJson({ error: result.error }) : rendered.message}\n`);
  process.exitCode = rendered.exitCode;
}
