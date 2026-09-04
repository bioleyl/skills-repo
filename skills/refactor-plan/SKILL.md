---
name: refactor-plan
description: Plan safe, incremental refactorings by characterizing behavior first, taking small reversible steps, and keeping tests green. Use when refactoring.
---

# Safe refactoring

Characterize current behavior with focused tests before changing structure. State the target design and identify seams that let the work proceed incrementally.

Make one reversible change at a time. Keep the code buildable, run the smallest relevant tests after each step, and avoid mixing behavior changes with mechanical moves. Remove compatibility scaffolding only after callers have migrated and the full suite is green.
