import { z } from 'zod';

const claudeEnvelopeSchema = z.object({ structured_output: z.unknown() });

export function claudeAnswer(output: string): unknown {
  return claudeEnvelopeSchema.parse(JSON.parse(output)).structured_output;
}

export function codexAnswer(lastMessage: string): unknown {
  return JSON.parse(lastMessage);
}
