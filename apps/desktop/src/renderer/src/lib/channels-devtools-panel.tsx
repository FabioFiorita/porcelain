import { useActions } from '@renderer/hooks/use-actions'
import { useBoardCards } from '@renderer/hooks/use-board'
import { useReviewComments } from '@renderer/hooks/use-comments'
import { useFeatureView } from '@renderer/hooks/use-feature-view'
import { useRepoNotes } from '@renderer/hooks/use-repo-notes'
import { useSkillsInfo } from '@renderer/hooks/use-skills'
import { useRepoStore } from '@renderer/stores/repo'

/**
 * A product-specific devtools panel that inspects Porcelain's agent channels — the
 * five surfaced here (review set, comments, board, actions, notes) plus the bundled
 * skills version. Each channel is a `~/.porcelain/*.json` file the porcelain CLI
 * (`src/cli/`) reads/writes; the renderer sees them through the same domain hooks
 * the UI uses, so this panel is a live mirror of what the agent can currently
 * see/do. Registered as a `plugins` entry in {@link DevtoolsShell}.
 */
export function ChannelsDevtoolsPanel(): React.JSX.Element {
  const repo = useRepoStore((s) => s.repo)
  const skills = useSkillsInfo()
  const { view } = useFeatureView()
  const comments = useReviewComments()
  const { cards } = useBoardCards()
  const actions = useActions()
  const notes = useRepoNotes()

  if (!repo) {
    return <div style={WRAP}>No repo open — the agent channels are repo-keyed.</div>
  }

  const reviewFiles = view?.groups.flatMap((g) => g.files) ?? []
  const bySource = (s: 'changed' | 'context' | 'shipped'): number =>
    reviewFiles.filter((f) => f.source === s).length
  const byStatus = (s: 'todo' | 'doing' | 'done'): number =>
    cards.filter((c) => c.status === s).length

  return (
    <div style={WRAP}>
      <Section title="Skills (skills.sh)">
        <Row label="Version" value={skills?.version ?? '—'} />
        <Row label="Install" value={skills?.installCommand ?? '—'} />
      </Section>

      <Section title="Review set (agent → app)">
        <Row
          label="Files"
          value={
            view
              ? `${reviewFiles.length} · ${bySource('changed')} changed / ${bySource('context')} context / ${bySource('shipped')} shipped${view.fromAgent ? ' · agent-fed' : ''}`
              : 'none set'
          }
        />
      </Section>

      <Section title="Comments (app → agent)">
        <Row
          label="Total"
          value={`${comments.length} · ${comments.filter((c) => c.resolved).length} resolved`}
        />
      </Section>

      <Section title="Board (two-way)">
        <Row
          label="Cards"
          value={`${cards.length} · ${byStatus('todo')} todo / ${byStatus('doing')} doing / ${byStatus('done')} done`}
        />
      </Section>

      <Section title="Actions (two-way)">
        <Row label="Saved" value={String(actions.length)} />
      </Section>

      <Section title="Notes (app → agent, read-only)">
        <Row label="Length" value={notes ? `${notes.length} chars` : 'empty'} />
      </Section>
    </div>
  )
}

const WRAP: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: 12,
  fontSize: 12,
  lineHeight: 1.5,
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <div style={{ fontWeight: 600, opacity: 0.5, textTransform: 'uppercase', fontSize: 10 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span style={{ minWidth: 80, opacity: 0.6 }}>{label}</span>
      <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}
