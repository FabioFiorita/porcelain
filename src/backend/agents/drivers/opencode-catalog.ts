import type { ModelInfo } from '../../../shared/agent-protocol'

/**
 * Pure parsers for opencode's catalog + auth surfaces, split out of the driver so the
 * shapes are unit-testable without a running server: `GET /config/providers` → ModelInfo[],
 * `~/.local/share/opencode/auth.json` → connected provider ids, and the `opencode models`
 * CLI fallback. All tolerant — a malformed field is skipped, never thrown.
 */

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/**
 * The advertised model id is `providerID/modelID` — exactly how a prompt addresses a
 * model (`model.providerID` + `model.modelID`). Split on the FIRST slash (a modelID may
 * itself contain slashes). Returns null when there's no provider segment.
 */
export function splitModelId(id: string): { providerID: string; modelID: string } | null {
  const slash = id.indexOf('/')
  if (slash <= 0 || slash === id.length - 1) return null
  return { providerID: id.slice(0, slash), modelID: id.slice(slash + 1) }
}

/**
 * A model's reasoning effort is expressed as a "variant" in OpenCode; each model's
 * `variants` object keys ARE its allowed effort values. Map them onto ModelInfo.efforts,
 * hiding the control when the model advertises none. Default: `medium` if offered, else
 * `high`, else the first variant.
 */
function effortsFromVariants(model: Record<string, unknown>): ModelInfo['efforts'] {
  const variants = asRecord(model.variants)
  if (!variants) return undefined
  const values = Object.keys(variants)
  if (values.length === 0) return undefined
  const preferred = values.includes('medium')
    ? 'medium'
    : values.includes('high')
      ? 'high'
      : values[0]
  return { values, default: preferred }
}

/**
 * Map `GET /config/providers` into the flat ModelInfo catalog. Each provider's `models`
 * map is a `{modelKey: Model}` object; we address models as `providerID/modelID` and label
 * them by the model's human `name` (falling back to the id), tagged with the provider name.
 * A model's `variants` become its reasoning-effort choices (see effortsFromVariants).
 */
export function mapProvidersConfig(config: unknown): ModelInfo[] {
  const root = asRecord(config)
  const providers = root?.providers
  if (!Array.isArray(providers)) return []
  const models: ModelInfo[] = []
  for (const entry of providers) {
    const provider = asRecord(entry)
    const providerId = provider ? asString(provider.id) : undefined
    if (providerId === undefined) continue
    const providerName = (provider ? asString(provider.name) : undefined) ?? providerId
    const modelMap = provider ? asRecord(provider.models) : undefined
    if (!modelMap) continue
    for (const value of Object.values(modelMap)) {
      const model = asRecord(value)
      const modelId = model ? asString(model.id) : undefined
      if (modelId === undefined || !model) continue
      const efforts = effortsFromVariants(model)
      models.push({
        id: `${providerId}/${modelId}`,
        label: asString(model.name) ?? modelId,
        provider: 'opencode',
        description: providerName,
        ...(efforts !== undefined ? { efforts } : {}),
      })
    }
  }
  return models
}

/**
 * Connected providers from `auth.json`: its top-level keys are provider ids, each mapped
 * to a credential object. Presence of a key = that provider is authenticated (§10). Order
 * preserved for a stable account label.
 */
export function parseAuthProviders(auth: unknown): string[] {
  const root = asRecord(auth)
  if (!root) return []
  return Object.keys(root).filter((key) => asRecord(root[key]) !== undefined)
}

/**
 * Fallback catalog from `opencode models` stdout — one `providerID/modelID` per line when
 * the server can't be reached. No human names available, so the label is the model segment.
 */
export function parseModelsCli(stdout: string): ModelInfo[] {
  const models: ModelInfo[] = []
  for (const raw of stdout.split('\n')) {
    const line = raw.trim()
    if (line === '' || line.indexOf('/') === -1) continue
    const split = splitModelId(line)
    models.push({
      id: line,
      label: split ? split.modelID : line,
      provider: 'opencode',
    })
  }
  return models
}
