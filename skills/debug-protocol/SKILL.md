---
name: debug-protocol
description: Use hypothesis-driven debugging: reproduce, isolate, hypothesize, test, fix, and verify. Use when a bug is not immediately obvious.
---

# Hypothesis-driven debugging

Reproduce the failure with the smallest reliable case and record the expected and observed behavior. Reduce the search space by isolating the failing layer, input, and recent change.

State one falsifiable hypothesis at a time. Design the smallest experiment that distinguishes it from alternatives. Apply the narrowest fix, then rerun the reproducer, relevant tests, and a regression test. Verify the final behavior rather than stopping when the error message changes.
