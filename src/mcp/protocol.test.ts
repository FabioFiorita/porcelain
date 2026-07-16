import { describe, expect, it, vi } from 'vitest'
import { handleRpc, PROTOCOL_VERSION, TOOLS } from './protocol'

const noTool = vi.fn(async () => 'unused')

describe('handleRpc', () => {
  it('answers initialize with capabilities, echoing the client protocol version', async () => {
    const res = await handleRpc(
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } },
      noTool,
    )
    expect(res).toMatchObject({
      id: 1,
      result: { protocolVersion: '2025-03-26', capabilities: { tools: {} } },
    })
  })

  it('defaults the protocol version when the client omits one', async () => {
    const res = await handleRpc({ jsonrpc: '2.0', id: 1, method: 'initialize' }, noTool)
    expect(res).toMatchObject({ result: { protocolVersion: PROTOCOL_VERSION } })
  })

  it('lists the feature-review, comment, reviewed, artifact, evidence, board, action, notes, and flow-layer tools', async () => {
    const res = await handleRpc({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, noTool)
    expect(res).toMatchObject({ id: 2, result: { tools: TOOLS } })
    expect(TOOLS.map((t) => t.name)).toEqual([
      'set_feature_review',
      'add_review_files',
      'clear_feature_review',
      'get_feature_review',
      'get_feature_view',
      'get_review_comments',
      'resolve_review_comment',
      'answer_review_comment',
      'get_reviewed_files',
      'set_feature_artifact',
      'get_feature_artifact',
      'clear_feature_artifact',
      'set_loop_evidence',
      'get_loop_evidence',
      'clear_loop_evidence',
      'list_cards',
      'create_card',
      'update_card',
      'move_card',
      'delete_card',
      'list_actions',
      'create_action',
      'update_action',
      'delete_action',
      'get_repo_notes',
      'get_flow_layers',
      'set_flow_layers',
      'reset_flow_layers',
    ])
  })

  it('dispatches tools/call and wraps the result as text content', async () => {
    const callTool = vi.fn(async (name: string) => `ran ${name}`)
    const res = await handleRpc(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'set_feature_review', arguments: { repoPath: '/r', files: [] } },
      },
      callTool,
    )
    expect(callTool).toHaveBeenCalledWith('set_feature_review', { repoPath: '/r', files: [] })
    expect(res).toMatchObject({
      id: 3,
      result: { content: [{ type: 'text', text: 'ran set_feature_review' }] },
    })
  })

  it('turns a tool error into an isError result, not a transport error', async () => {
    const callTool = vi.fn(async () => {
      throw new Error('repoPath is required')
    })
    const res = await handleRpc(
      { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'x', arguments: {} } },
      callTool,
    )
    expect(res).toMatchObject({
      id: 4,
      result: { isError: true, content: [{ type: 'text', text: 'repoPath is required' }] },
    })
  })

  it('returns null for notifications (no id) like notifications/initialized', async () => {
    expect(
      await handleRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, noTool),
    ).toBeNull()
  })

  it('ignores a tools/call sent as a notification (no id): no reply, no execution', async () => {
    const callTool = vi.fn(async () => 'ran')
    const res = await handleRpc(
      { jsonrpc: '2.0', method: 'tools/call', params: { name: 'x', arguments: {} } },
      callTool,
    )
    expect(res).toBeNull()
    expect(callTool).not.toHaveBeenCalled()
  })

  it('errors on an unknown method that expects a reply', async () => {
    const res = await handleRpc({ jsonrpc: '2.0', id: 5, method: 'resources/list' }, noTool)
    expect(res).toMatchObject({ id: 5, error: { code: -32601 } })
  })
})
