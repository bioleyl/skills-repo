export function renderJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function renderAdd(value: {
  readonly name: string;
  readonly version: string;
  readonly targets: readonly { readonly agent: string; readonly path: string }[];
}): string {
  return `${value.name}@${value.version} installed to ${value.targets.map((target) => target.path).join(', ')}`;
}

export function renderList(values: readonly unknown[]): string {
  if (values.length === 0) {
    return 'No skills installed.';
  }
  return values
    .map((value) => {
      if (typeof value !== 'object' || value === null) {
        return String(value);
      }
      const item = value as {
        readonly name?: unknown;
        readonly version?: unknown;
        readonly available?: unknown;
        readonly upToDate?: unknown;
      };
      let status = '';
      if (item.available === false) {
        status = ' (unavailable)';
      } else if (item.upToDate === false) {
        status = ' (update available)';
      }
      const version = item.version === undefined ? '' : `@${String(item.version)}`;
      return `${String(item.name)}${version}${status}`;
    })
    .join('\n');
}

export function renderAgents(values: readonly unknown[]): string {
  return values
    .map((value) => {
      const agent = value as { readonly agent: string; readonly detected: boolean; readonly path: string };
      return `${agent.agent}: ${agent.detected ? 'detected' : 'not detected'} (${agent.path})`;
    })
    .join('\n');
}

export function renderInfo(value: {
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly installed: boolean;
  readonly upToDate: boolean;
}): string {
  return `${value.name}@${value.version}\n${value.description}\nInstalled: ${value.installed ? 'yes' : 'no'}${value.installed ? ` (${value.upToDate ? 'up to date' : 'update available'})` : ''}`;
}

export function renderUpdates(value: {
  readonly updates: readonly { readonly name: string; readonly from: string; readonly to: string }[];
  readonly unavailable?: readonly string[];
  readonly dryRun: boolean;
}): string {
  const lines = value.updates.map((update) => `${update.name}: ${update.from} -> ${update.to}`);
  const unavailable = value.unavailable ?? [];
  if (unavailable.length > 0) {
    lines.push(`Unavailable: ${unavailable.join(', ')}`);
  }
  return lines.length === 0 ? 'All installed skills are up to date.' : lines.join('\n');
}

export function renderSearch(
  values: readonly {
    readonly skill: { readonly name: string; readonly description: string };
    readonly score: number;
  }[]
): string {
  return values.map((result) => `${result.skill.name}: ${result.skill.description}`).join('\n');
}
