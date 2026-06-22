import { describe, expect, it } from 'vitest'
import {
  ACTIONS_SKILL,
  BOARD_SKILL,
  installCommands,
  LAYERS_SKILL,
  MARKETPLACE_NAME,
  marketplaceManifest,
  NOTES_SKILL,
  PLUGIN_NAME,
  pluginManifest,
  pluginMarketplaceDir,
  REVIEW_SKILL,
  SKILLS,
} from './plugin-assets'

describe('plugin assets', () => {
  it('marketplace lists the porcelain plugin by relative source', () => {
    const m = marketplaceManifest()
    expect(m.name).toBe(MARKETPLACE_NAME)
    expect(m.owner).toMatchObject({ name: expect.any(String) })
    expect(m.plugins).toEqual([
      expect.objectContaining({ name: PLUGIN_NAME, source: `./${PLUGIN_NAME}` }),
    ])
  })

  it('plugin manifest declares the stdio MCP server via CLAUDE_PLUGIN_ROOT', () => {
    const p = pluginManifest('1.2.3')
    expect(p.name).toBe(PLUGIN_NAME)
    expect(p.version).toBe('1.2.3')
    expect(p.mcpServers).toEqual({
      // biome-ignore lint/suspicious/noTemplateCurlyInString: literal placeholder Claude Code expands at runtime, not a JS template
      porcelain: { command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/server.js'] },
    })
  })

  it('install commands register, then both install and update so re-runs upgrade', () => {
    const [add, marketplaceUpdate, install, update] = installCommands()
    expect(add).toBe(`claude plugin marketplace add ${pluginMarketplaceDir()}`)
    expect(marketplaceUpdate).toBe(`claude plugin marketplace update ${MARKETPLACE_NAME}`)
    expect(install).toBe(`claude plugin install ${PLUGIN_NAME}@${MARKETPLACE_NAME}`)
    expect(update).toBe(`claude plugin update ${PLUGIN_NAME}@${MARKETPLACE_NAME}`)
  })

  it('bundles five focused skills, each with frontmatter naming itself', () => {
    expect(SKILLS.map((s) => s.name)).toEqual([
      'review-with-porcelain',
      'project-board',
      'saved-actions',
      'repo-notes',
      'flow-layers',
    ])
    for (const skill of SKILLS) {
      expect(skill.content).toMatch(new RegExp(`^---\\nname: ${skill.name}\\ndescription: .+`))
    }
  })

  it('the review skill teaches review sets + comments + reviewed files and the shipped/context tagging', () => {
    expect(REVIEW_SKILL).toContain('set_feature_review')
    expect(REVIEW_SKILL).toContain('get_review_comments')
    expect(REVIEW_SKILL).toContain('get_reviewed_files')
    expect(REVIEW_SKILL).toContain('"shipped"')
    expect(REVIEW_SKILL).toContain('"context"')
    expect(REVIEW_SKILL).toMatch(/^---\nname: review-with-porcelain/)
    // board/action tools moved out to their own skills, so their triggers fire independently
    expect(REVIEW_SKILL).not.toContain('list_cards')
    expect(REVIEW_SKILL).not.toContain('list_actions')
  })

  it('the board skill teaches the card tools', () => {
    for (const tool of ['list_cards', 'create_card', 'update_card', 'move_card', 'delete_card']) {
      expect(BOARD_SKILL).toContain(tool)
    }
  })

  it('the actions skill teaches the action tools and the human-runs-only rule', () => {
    for (const tool of ['list_actions', 'create_action', 'update_action', 'delete_action']) {
      expect(ACTIONS_SKILL).toContain(tool)
    }
    expect(ACTIONS_SKILL).toContain('only the human runs them')
  })

  it('the notes skill teaches the read-only get_repo_notes tool', () => {
    expect(NOTES_SKILL).toContain('get_repo_notes')
    expect(NOTES_SKILL).toMatch(/^---\nname: repo-notes/)
    // read-only channel: no write/edit tool exists for notes
    expect(NOTES_SKILL).toContain('read-only')
  })

  it('the flow-layers skill teaches the whole-set layer tools and the read-first rule', () => {
    for (const tool of ['get_flow_layers', 'set_flow_layers', 'reset_flow_layers']) {
      expect(LAYERS_SKILL).toContain(tool)
    }
    expect(LAYERS_SKILL).toMatch(/^---\nname: flow-layers/)
    // whole-set replace: the agent always sends the full ordered list
    expect(LAYERS_SKILL).toContain('whole-set replace')
  })
})
