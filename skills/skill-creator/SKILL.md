---
name: skill-creator
description: Author skills for this registry with correct SKILL.md structure, strong capability-and-trigger descriptions, skill.json manifests, and lean instruction bodies. Use when creating or improving a skill.
---

# Creating a skill

Give the skill a lowercase hyphenated name. In `SKILL.md`, use only the standard `name` and `description` frontmatter fields. Make the description state both the capability and when to use it, then keep the body procedural and concise.

Add a matching `skill.json` with a SemVer version, the exact same name and description, lowercase keywords, license, and optional compatibility list. Keep supporting files small, text-only, and relevant. Validate locally before opening a PR.
