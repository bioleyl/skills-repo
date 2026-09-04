module.exports = {
  forbidden: [
    {
      name: 'types-must-be-leaf',
      severity: 'error',
      from: { path: '^src/types' },
      to: { path: '^src/(core|app|infra|cli)' },
    },
    {
      name: 'core-must-not-import-outer-layers',
      severity: 'error',
      from: { path: '^src/core' },
      to: { path: '^src/(app|infra|cli)' },
    },
    {
      name: 'app-must-not-import-outer-layers',
      severity: 'error',
      from: { path: '^src/app' },
      to: { path: '^src/(infra|cli)' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
  },
};
