import { SkillsSection } from './skills-section'

/**
 * Settings → Companion: agent companion skill install/upgrade (shell-only).
 * Split out of General so prefs stay viewer-focused and skills have a home.
 */
export function CompanionSection(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">
        Companion skills teach your agent how to push feature reviews (Intent, Execution, Evidence),
        read comments, manage the board, and curate actions. They ship through skills.sh. Commands
        use <span className="font-mono">-g</span> so the skill is available in every project, not
        only one working directory.
      </p>
      <SkillsSection />
    </div>
  )
}
