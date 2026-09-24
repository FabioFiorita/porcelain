import { isAbsolute } from 'node:path';
import { z } from 'zod';

const repositoryPath = z
  .string()
  .min(1)
  .refine(
    (path) => !isAbsolute(path) && !path.split('/').includes('..'),
    'a probe edits a path inside the repository',
  );

const probeEditSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('create'),
    path: repositoryPath,
    content: z.string(),
  }),
  z.strictObject({
    kind: z.literal('append'),
    path: repositoryPath,
    content: z.string(),
  }),
  z.strictObject({
    kind: z.literal('prepend'),
    path: repositoryPath,
    content: z.string(),
  }),
  z.strictObject({
    kind: z.literal('replace'),
    path: repositoryPath,
    old: z.string().min(1),
    new: z.string(),
    all: z.literal(true).optional(),
  }),
]);

export const probeGates = ['lint', 'arch', 'typecheck', 'test'] as const;

export const probeSchema = z.strictObject({
  decision: z.string().min(1),
  plants: z.string().min(1),
  gate: z.enum(probeGates),
  rule: z.string().min(1),
  edits: z.array(probeEditSchema).min(1),
});

export type Probe = z.input<typeof probeSchema>;
export type ProbeEdit = z.output<typeof probeEditSchema>;
export type ProbeGate = (typeof probeGates)[number];
