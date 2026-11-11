import { worktreeSections } from './worktree-section';

export type WorktreeSwitcherForm = 'buttons' | 'menu';

export type WorktreeBarPlace = 'pushed' | 'beside';

const titleCharacterWidth = 10;
const titlePadding = 16;
const readableTitleCharacters = 16;
const reservedSectionActions = 1;

export type HeaderBarSpace = { leading: number; item: number };

const extraLeadingItems: Record<WorktreeBarPlace, number> = {
  pushed: 0,
  beside: 1,
};

const extraTrailingItems: Record<WorktreeBarPlace, number> = {
  pushed: 0,
  beside: 1,
};

export function worktreeSwitcherItems(form: WorktreeSwitcherForm) {
  return form === 'buttons' ? worktreeSections.length : 1;
}

export function worktreeSwitcherForm({
  barWidth,
  bar,
  place,
  fontScale,
  title,
  otherItems,
}: {
  barWidth: number;
  bar: HeaderBarSpace;
  place: WorktreeBarPlace;
  fontScale: number;
  title: string | undefined;
  otherItems: number;
}): WorktreeSwitcherForm {
  const characters = Math.min(
    title?.length ?? readableTitleCharacters,
    readableTitleCharacters,
  );
  const titleRoom = characters * titleCharacterWidth * fontScale + titlePadding;
  const items =
    worktreeSwitcherItems('buttons') +
    extraTrailingItems[place] +
    Math.max(otherItems, reservedSectionActions);
  const leading = bar.leading + extraLeadingItems[place] * bar.item;
  const room = barWidth - leading - items * bar.item;
  return room >= titleRoom ? 'buttons' : 'menu';
}
