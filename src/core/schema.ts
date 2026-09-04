import { z } from 'zod';

export const skillNameSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const semVerSchema = z
  .string()
  .regex(
    /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
  );
export const shaSchema = z.string().regex(/^[0-9a-f]{40}$/i);
export const agentIdSchema = z.enum(['portable', 'claude-code', 'codex', 'cursor', 'windsurf']);
export const scopeSchema = z.enum(['project', 'user']);

export const skillDocSchema = z
  .object({
    description: z.string().min(1).max(1024),
    name: skillNameSchema,
  })
  .strict();

export const skillManifestSchema = z
  .object({
    author: z.string().min(1).optional(),
    compatibility: z.array(agentIdSchema).default(['portable', 'claude-code', 'codex', 'cursor', 'windsurf']),
    description: z.string().min(1).max(1024),
    keywords: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(8),
    license: z.string().min(1).optional(),
    name: skillNameSchema,
    version: semVerSchema,
  })
  .strict();

export const registrySkillSchema = z
  .object({
    description: z.string().min(1).max(1024),
    files: z.array(z.string().min(1)).min(2).max(20),
    keywords: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(8),
    name: skillNameSchema,
    path: z.string().min(1),
    sizeBytes: z.number().int().nonnegative(),
    version: semVerSchema,
  })
  .strict();

export const registryIndexSchema = z
  .object({
    commitSha: shaSchema,
    generatedAt: z.string().datetime({ offset: true }),
    skills: z.array(registrySkillSchema),
    version: z.literal(1),
  })
  .strict();

export const lockfileTargetSchema = z
  .object({
    agent: agentIdSchema,
    path: z.string().min(1),
  })
  .strict();

export const lockfileSkillSchema = z
  .object({
    commitSha: shaSchema,
    installedAt: z.string().datetime({ offset: true }),
    name: skillNameSchema,
    scope: scopeSchema,
    targets: z.array(lockfileTargetSchema).min(1),
    version: semVerSchema,
  })
  .strict();

export const lockfileSchema = z
  .object({
    registry: z
      .object({
        ownerRepo: z.string().regex(/^[^/]+\/[^/]+$/),
        ref: z.string().min(1),
      })
      .strict(),
    skills: z.array(lockfileSkillSchema),
    version: z.literal(1),
  })
  .strict();
