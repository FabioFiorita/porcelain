import type { ModelInfo } from '@shared/agent-protocol'

/**
 * The label for a thread's model chip. Three cases:
 * - the user picked a model → its friendly catalog label (or the raw id if uncatalogued);
 * - no pick (`model === ''`) but the CLI reported a resolved id → the friendly label of the
 *   catalog model whose slug PREFIXES that full id (init echoes a date-suffixed form like
 *   `claude-opus-4-8-20260115`; the catalog uses the `claude-opus-4-8` slug), tagged
 *   `· default` so it still reads as the CLI's own choice — falls back to the raw id;
 * - neither → `Default model`.
 */
export function modelChipLabel(
  model: string,
  resolvedModel: string | undefined,
  models: ModelInfo[],
): string {
  if (model !== '') return models.find((m) => m.id === model)?.label ?? model
  if (resolvedModel !== undefined && resolvedModel !== '') {
    const match = models.find((m) => resolvedModel.startsWith(m.id))
    return `${match?.label ?? resolvedModel} · default`
  }
  return 'Default model'
}
