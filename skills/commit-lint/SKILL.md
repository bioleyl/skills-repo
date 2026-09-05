---
name: commit-lint
description: Write Conventional Commits messages and enforce them via git hook. Use for every git commit.
---

# Conventional Commits

Write a concise commit message in the form `type(scope): description`.

## Valid types

Use `feat` for user-visible functionality, `fix` for bug fixes, `docs` for documentation, `style` for formatting, `refactor` for behavior-preserving code changes, `test` for tests, `build` for tooling, `ci` for CI, `chore` for maintenance, `perf` for performance, and `revert` for reverts.

Keep the subject imperative, specific, and under 72 characters. Add a body when the motivation or migration impact is not obvious. Add `BREAKING CHANGE:` in the footer for incompatible changes.

## Git hook

This skill includes `commit-msg.hook`. Install it with:

```sh
cp commit-msg.hook .git/hooks/commit-msg && chmod +x .git/hooks/commit-msg
```

The hook validates every commit against the Conventional Commits specification and rejects messages that do not match the pattern.
