import type { ModelInfo } from '@shared/agent-protocol'
import { describe, expect, it } from 'vitest'
import { modelChipLabel } from './agent-model-label'

const models: ModelInfo[] = [
  { id: 'claude-opus-4-8', label: 'Opus 4.8', provider: 'claude' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5', provider: 'claude' },
]

describe('modelChipLabel', () => {
  it('uses the friendly catalog label for a chosen model', () => {
    expect(modelChipLabel('claude-opus-4-8', undefined, models)).toBe('Opus 4.8')
  })

  it('falls back to the raw id for a chosen but uncatalogued model', () => {
    expect(modelChipLabel('some-slug', undefined, models)).toBe('some-slug')
  })

  it('shows the resolved model (prefix-matched) with a default tag when no model was chosen', () => {
    expect(modelChipLabel('', 'claude-haiku-4-5-20251001', models)).toBe('Haiku 4.5 · default')
  })

  it('falls back to the raw resolved id when it matches no catalog slug', () => {
    expect(modelChipLabel('', 'gpt-mystery-1', models)).toBe('gpt-mystery-1 · default')
  })

  it('shows Default model when neither a chosen nor a resolved model is known', () => {
    expect(modelChipLabel('', undefined, models)).toBe('Default model')
    expect(modelChipLabel('', '', models)).toBe('Default model')
  })
})
