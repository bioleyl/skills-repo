---
name: pr-reviewer
description: Perform structured code reviews covering correctness, security, performance, and tests with severity-tagged findings. Use when reviewing a PR or code.
---

# Structured code review

Review the change, not the author. Start by understanding the intended behavior and affected interfaces. Inspect the diff and relevant tests, then check:

1. **Correctness** — happy paths, edge cases, failure handling, and regressions.
2. **Security** — trust boundaries, authorization, injection, secrets, and unsafe input.
3. **Performance** — unnecessary I/O, expensive loops, allocations, and scalability.
4. **Tests** — behavior coverage, meaningful assertions, and missing negative cases.

Report findings as `[blocker]`, `[high]`, `[medium]`, or `[low]`, with file/line, impact, and a concrete fix. Separate findings from questions and positive notes.
