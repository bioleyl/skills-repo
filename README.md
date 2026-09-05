# skills-repo

A lightweight npm-style registry for AI agent skills. The `skills-repo` CLI downloads reviewed skill files from a public GitHub repository and installs them into the directories used by Claude Code, Codex, Cursor, Windsurf, and other compatible agents.

> Skills are instructions that an agent will read. Review a skill's description and contents before installing it. The CLI confirms removals interactively; use `--yes` for automated removal.

## Install

```sh
npx @bioleyl/skills-repo add commit-lint
```

The npm package is `@bioleyl/skills-repo` and it exposes the `skills-repo` binary. It writes only files from the registry's exact file list and never executes installed scripts.

## Commands

```text
skills-repo init [--scope project|user]
skills-repo add <skill...> [--agent <ids...>] [--scope project|user] [--force]
skills-repo remove <skill...> [--scope project|user] [--yes]
skills-repo list [--available]
skills-repo search <query> [--keyword]
skills-repo info <skill>
skills-repo update [skill...] [--all] [--dry-run]
skills-repo agents
skills-repo validate [--root <checkout>]
```

Every command supports `--json` for machine-readable output. Registry access can be overridden with `--registry owner/repo@ref` or `--registry file:///absolute/path`. `GITHUB_TOKEN` is used only for GitHub API rate limits and is never written to disk.

## Registry format

A skill lives under `skills/<name>/` and contains:

- `SKILL.md` — standard agent-facing frontmatter (`name`, `description`) and instructions.
- `skill.json` — registry metadata including SemVer, keywords, license, and compatibility.

`registry.json` is generated from the skill directories. It includes the exact file list, total size, and commit SHA used for reproducible installs.

## Scope and lockfiles

Project installs are recorded in `skills.lock.json`. User installs use `$XDG_CONFIG_HOME/skills-repo/lock.json`, or `~/.config/skills-repo/lock.json` when `XDG_CONFIG_HOME` is unset. Paths in the lockfile are derived from the selected agent and scope, so `remove` and `update` do not accept arbitrary file paths.

The default policy installs to `.agents/skills/<name>/` and also to `.claude/skills/<name>/` when Claude Code is detected. Use `--agent` to opt into native directories for a specific host.

## Development

```sh
npm install
npm test
npm run typecheck
npm run lint
npm run build
npm run validate
# Optional local regeneration; CI does this automatically after merges
npm run build:registry
```

The default registry is `bioleyl/skills-repo` on GitHub. Browse the generated catalog at [bioleyl.github.io/skills-repo](https://bioleyl.github.io/skills-repo/). Set `SKILLS_REPO_REGISTRY` or pass `--registry` for local development.

## Publishing

The npm workflow is manually triggered from GitHub Actions using npm trusted publishing (OIDC). Configure `bioleyl/skills-repo` as a trusted publisher for `@bioleyl/skills-repo` on npm, then run **Publish npm package** from the Actions tab. The workflow checks the package, builds it, and publishes the current `package.json` version under the selected npm dist-tag. Bump the version before publishing a new release.

## License

MIT.
test
