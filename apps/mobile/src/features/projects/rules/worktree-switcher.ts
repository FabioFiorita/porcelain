import { worktreeSections } from './worktree-section';

export type WorktreeSwitcherForm = 'buttons' | 'menu';

export type WorktreeBarPlace = 'pushed' | 'beside';

const itemSpace = 48;
const titleCharacterWidth = 10;
const titlePadding = 16;
const readableTitleCharacters = 16;
const reservedSectionActions = 1;

const barChrome: Record<WorktreeBarPlace, { leading: number; items: number }> =
  {
    pushed: { leading: 72, items: 0 },
    beside: { leading: 120, items: 1 },
  };

export function worktreeSwitcherItems(form: WorktreeSwitcherForm) {
  return form === 'buttons' ? worktreeSections.length : 1;
}

export function worktreeSwitcherForm({
  barWidth,
  place,
  fontScale,
  title,
  otherItems,
}: {
  barWidth: number;
  place: WorktreeBarPlace;
  fontScale: number;
  title: string | undefined;
  otherItems: number;
}): WorktreeSwitcherForm {
  const chrome = barChrome[place];
  const characters = Math.min(
    title?.length ?? readableTitleCharacters,
    readableTitleCharacters,
  );
  const titleRoom = characters * titleCharacterWidth * fontScale + titlePadding;
  const items =
    worktreeSwitcherItems('buttons') +
    chrome.items +
    Math.max(otherItems, reservedSectionActions);
  const room = barWidth - chrome.leading - items * itemSpace;
  return room >= titleRoom ? 'buttons' : 'menu';
}
