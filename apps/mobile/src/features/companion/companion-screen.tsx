import { PlaceholderScreen } from '@/components/placeholder-screen'
import { SheetCloseToolbar } from '@/components/sheet-close-toolbar'

/**
 * The renderer's right sidebar. On the desktop it is a second column that retitles itself
 * to whatever the active tab is doing — Commit, Timeline, Now reading, Focus, Actions. A
 * phone has room for one surface at a time, so here it is a sheet raised from the header,
 * and it previews rather than duplicates: staging and committing stay in Changes.
 */
export function CompanionScreen(): React.JSX.Element {
  return (
    <>
      <PlaceholderScreen
        description="The companion panel, following whichever tab raised it."
        details={[
          'Changes — the commit composer’s companion',
          'Review — the card in focus',
          'Files — pins and notes',
          'Terminal — saved Actions',
        ]}
      />
      <SheetCloseToolbar />
    </>
  )
}
