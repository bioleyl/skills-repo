---
name: coding-style
description: Write clean, maintainable code with clear separation of concerns, small pure functions, early-return control flow, and no nested ternaries. Use when implementing, reviewing, or refactoring code.
---

# Coding style

Understand the existing architecture and conventions before changing code. Make the smallest change that solves the problem and preserve unrelated behavior.

## Structure

- Keep responsibilities separated: domain rules should not perform I/O, and orchestration should not contain low-level implementation details.
- Prefer small functions with one clear responsibility and descriptive names.
- Keep pure logic deterministic and move filesystem, network, time, environment, and process effects to explicit boundaries.
- Prefer simple composition over premature abstractions. Introduce an abstraction when it removes a real dependency or clarifies a stable boundary.

## Control flow

- Use guard clauses and early returns for invalid input, errors, and exceptional cases.
- Avoid nested `if` statements. If a condition is not an early return, extract a named predicate or function.
- Prefer exhaustive mappers over `switch` statements for type- or case-based logic. Use a typed map such as `const labels: Record<MyType, string> = { ... }`; adding a member to `MyType` then produces a compile-time error until the mapper is updated.
- Never use nested ternaries. If the logic needs more branching than a simple ternary or an early return, the function is doing too much: split it into smaller functions with clear responsibilities.
- Avoid deeply nested loops and callbacks; extract the inner operation when it needs its own explanation.

## Verification

- Preserve the existing public contract unless a breaking change is intentional.
- Add or update tests around behavior and failure paths.
- Run formatting, linting, type checking, and the relevant tests before finishing.
- Keep comments focused on why a non-obvious decision exists, not on repeating what the code says.
