/**
 * How a client explains one companion channel's git disposition.
 *
 * The union is spelled locally rather than imported from
 * `@shared/project-porcelain`: that module reaches for `node:path` for its path
 * helpers, and Metro cannot resolve node builtins, so the mobile client could
 * never pull it. Structurally identical, so the daemon's `CompanionDisposition`
 * still passes straight in.
 */
export type Disposition = 'shared' | 'local'

/**
 * One line of plain language for a channel's current git state.
 *
 * It lives in the shared client core because "Local" reads as a *second storage
 * location* to anyone who has not read `companion-disposition.ts` daemon-side.
 * It is not: the file sits in `<repo>/.porcelain/` either way, and Local only
 * means git ignores it. The sentence that corrects that misreading has to be the
 * same sentence on web, Electron and mobile, or three surfaces teach three
 * different mental models of where a user's data went.
 *
 * `trackedCount` used to ride inside the toggle label as `Local (1)`, which read
 * as "1 local item". It counts the opposite: files git tracks today, which
 * choosing Local would untrack. Stated as a consequence, it stops lying.
 */
export function describeDisposition(disposition: Disposition, trackedCount: number): string {
  if (disposition === 'local') return 'Ignored — stays in this clone.'
  if (trackedCount === 0) return 'Shared — nothing committed yet; stage it to reach teammates.'
  const files = trackedCount === 1 ? 'file' : 'files'
  const them = trackedCount === 1 ? 'its' : 'their'
  return `In git · ${trackedCount} ${files} tracked — Local stages ${them} removal.`
}
