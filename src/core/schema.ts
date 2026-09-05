import z from 'zod';

const agentIdSchema = z.enum(['portable', 'claude-code', 'codex', 'cursor', 'windsurf']);

const scopeSchema = z.enum(['project', 'user']);

const skillNameSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(
    /^[a-z][a-z0-9-]*$/,
    'Must start with a lowercase letter and contain only lowercase letters, numbers, and hyphens'
  );

const shaSchema = z.string().min(1).max(64);

export const hookNameSchema = z.enum(['preUninstall', 'postUninstall', 'postInstall']);

const hooksSchema = z
  .object({
    postInstall: z.string().min(1).optional(),
    postUninstall: z.string().min(1).optional(),
    preUninstall: z.string().min(1).optional(),
  })
  .strict();

export const skillManifestSchema = z
  .object({
    author: z.string().min(1).optional(),
    compatibility: z.array(agentIdSchema).default(['portable', 'claude-code', 'codex', 'cursor', 'windsurf']),
    description: z.string().min(1).max(1024),
    hooks: hooksSchema.optional(),
    keywords: z.array(z.string().regex(/^[a-z0-9-]+$/)).max(8),
    license: z.string().min(1).optional(),
    name: skillNameSchema,
    version: z.string().min(1),
  })
  .strict();

export const skillDocSchema = z
  .object({
    description: z.string().min(1).max(1024),
    name: skillNameSchema,
  })
  .strict();

export const registrySkillSchema = z
  .object({
    description: z.string().min(1).max(1024),
    files: z.array(z.string()),
    keywords: z.array(z.string().regex(/^[a-z0-9-]+$/)),
    name: skillNameSchema,
    path: z.string(),
    sizeBytes: z.number(),
    version: z.string(),
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

export const installTargetSchema = z
  .object({
    agent: agentIdSchema,
    path: z.string(),
  })
  .strict();

export const fileOperationSchema = z
  .object({
    action: z.enum(['write', 'delete']),
    content: z.string().optional(),
    path: z.string(),
  })
  .strict();

export const lockfileTargetSchema = z
  .object({
    agent: agentIdSchema,
    path: z.string(),
  })
  .strict();

export const lockfileSkillSchema = z
  .object({
    commitSha: shaSchema,
    hooks: z
      .object({
        postInstall: z.string().optional(),
        postUninstall: z.string().optional(),
        preUninstall: z.string().optional(),
      })
      .strict()
      .optional(),
    installedAt: z.string().datetime({ offset: true }),
    name: skillNameSchema,
    scope: scopeSchema,
    targets: z.array(lockfileTargetSchema),
    version: z.string(),
  })
  .strict();

export const lockfileSchema = z
  .object({
    registry: z.object({
      ownerRepo: z.string(),
      ref: z.string(),
    }),
    skills: z.array(lockfileSkillSchema),
    version: z.literal(1),
  })
  .strict();
