---
name: test-design
description: Design tests using equivalence classes, boundary values, error paths, one behavior per test, and appropriate unit versus integration scope. Use when writing tests.
---

# Test design

Identify the behavior and its observable contract before choosing a test level. Partition inputs into equivalence classes, include boundary values, and cover expected failures and recovery paths.

Keep each test focused on one behavior with a descriptive name. Prefer pure unit tests for domain rules, contract tests for adapters, and integration tests for sequencing and persistence. Assert outcomes and important side effects, not implementation details.
