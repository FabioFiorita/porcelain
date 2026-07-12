import { describe, expect, it } from 'vitest'
import {
  mapProvidersConfig,
  parseAuthProviders,
  parseModelsCli,
  splitModelId,
} from './opencode-catalog'

describe('splitModelId', () => {
  it('splits on the first slash', () => {
    expect(splitModelId('anthropic/claude-sonnet-4-5')).toEqual({
      providerID: 'anthropic',
      modelID: 'claude-sonnet-4-5',
    })
  })

  it('keeps later slashes in the model id', () => {
    expect(splitModelId('openrouter/meta/llama-3')).toEqual({
      providerID: 'openrouter',
      modelID: 'meta/llama-3',
    })
  })

  it('returns null without a provider segment', () => {
    expect(splitModelId('sonnet')).toBeNull()
    expect(splitModelId('/leading')).toBeNull()
    expect(splitModelId('trailing/')).toBeNull()
  })
})

describe('mapProvidersConfig', () => {
  // Trimmed real GET /config/providers capture (opencode 1.17.18).
  const config = {
    default: { opencode: 'big-pickle' },
    providers: [
      {
        id: 'opencode',
        name: 'OpenCode Zen',
        models: {
          'mimo-v2.5-free': {
            id: 'mimo-v2.5-free',
            providerID: 'opencode',
            name: 'MiMo V2.5 Free',
          },
          'deepseek-v4-flash-free': {
            id: 'deepseek-v4-flash-free',
            name: 'DeepSeek V4 Flash (free)',
          },
        },
      },
      {
        id: 'openai',
        name: 'OpenAI',
        models: { 'gpt-5.6': { id: 'gpt-5.6', name: 'GPT-5.6' } },
      },
    ],
  }

  it('flattens providers into providerID/modelID ModelInfo with human labels', () => {
    expect(mapProvidersConfig(config)).toEqual([
      {
        id: 'opencode/mimo-v2.5-free',
        label: 'MiMo V2.5 Free',
        provider: 'opencode',
        description: 'OpenCode Zen',
      },
      {
        id: 'opencode/deepseek-v4-flash-free',
        label: 'DeepSeek V4 Flash (free)',
        provider: 'opencode',
        description: 'OpenCode Zen',
      },
      { id: 'openai/gpt-5.6', label: 'GPT-5.6', provider: 'opencode', description: 'OpenAI' },
    ])
  })

  it('maps a model variants object onto ModelInfo.efforts, hiding it when empty', () => {
    const models = mapProvidersConfig({
      providers: [
        {
          id: 'openai',
          name: 'OpenAI',
          models: {
            'gpt-5.6': {
              id: 'gpt-5.6',
              name: 'GPT-5.6',
              variants: { none: {}, low: {}, medium: {}, high: {}, xhigh: {} },
            },
            'qwen3.7-plus': { id: 'qwen3.7-plus', name: 'Qwen 3.7 Plus', variants: {} },
          },
        },
      ],
    })
    expect(models[0]).toEqual({
      id: 'openai/gpt-5.6',
      label: 'GPT-5.6',
      provider: 'opencode',
      description: 'OpenAI',
      efforts: { values: ['none', 'low', 'medium', 'high', 'xhigh'], default: 'medium' },
    })
    // Empty variants → no efforts descriptor.
    expect(models[1].efforts).toBeUndefined()
  })

  it('falls back to the model id when no human name is present', () => {
    const models = mapProvidersConfig({
      providers: [{ id: 'p', models: { m: { id: 'raw-model' } } }],
    })
    expect(models).toEqual([
      { id: 'p/raw-model', label: 'raw-model', provider: 'opencode', description: 'p' },
    ])
  })

  it('tolerates malformed shapes without throwing', () => {
    expect(mapProvidersConfig(null)).toEqual([])
    expect(mapProvidersConfig({ providers: 'nope' })).toEqual([])
    expect(mapProvidersConfig({ providers: [{ name: 'no id' }, 42] })).toEqual([])
  })
})

describe('parseAuthProviders', () => {
  it('returns the provider keys with credential objects, order preserved', () => {
    // Real auth.json shape: keys are provider ids, values are {type, ...} credentials.
    expect(
      parseAuthProviders({
        anthropic: { type: 'oauth' },
        openai: { type: 'oauth' },
        'opencode-go': { type: 'api' },
      }),
    ).toEqual(['anthropic', 'openai', 'opencode-go'])
  })

  it('skips non-object values and tolerates junk', () => {
    expect(parseAuthProviders({ good: { type: 'api' }, bad: 'x' })).toEqual(['good'])
    expect(parseAuthProviders(null)).toEqual([])
    expect(parseAuthProviders('nope')).toEqual([])
  })
})

describe('parseModelsCli', () => {
  it('parses provider/model lines, ignoring blanks and non-id lines', () => {
    const stdout = 'opencode/big-pickle\nopencode-go/deepseek-v4-flash\n\nnot-a-model\n'
    expect(parseModelsCli(stdout)).toEqual([
      { id: 'opencode/big-pickle', label: 'big-pickle', provider: 'opencode' },
      { id: 'opencode-go/deepseek-v4-flash', label: 'deepseek-v4-flash', provider: 'opencode' },
    ])
  })
})
