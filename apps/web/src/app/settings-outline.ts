import { useState } from 'react';
import { settingsSectionAttribute } from '@/shared/views/settings-section';

export type SettingsOutlineEntry = { id: string; title: string };

const reachedOffset = 24;
const landedAttribute = 'data-outline-landed';
const chosenAttribute = 'data-outline-chosen';
const pinnedAttribute = 'data-outline-pinned';

function sameEntries(
  left: readonly SettingsOutlineEntry[],
  right: readonly SettingsOutlineEntry[],
) {
  return (
    left.length === right.length &&
    left.every(
      (entry, index) =>
        entry.id === right[index]?.id && entry.title === right[index]?.title,
    )
  );
}

function sectionTop(viewport: HTMLElement, section: HTMLElement) {
  const margin = Number.parseFloat(getComputedStyle(section).scrollMarginTop);
  return (
    viewport.scrollTop +
    section.getBoundingClientRect().top -
    viewport.getBoundingClientRect().top -
    (Number.isNaN(margin) ? 0 : margin)
  );
}

function currentSection(viewport: HTMLElement, sections: HTMLElement[]) {
  const last = sections.at(-1);
  if (
    last &&
    viewport.scrollTop > 0 &&
    viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 2
  )
    return last.id;
  const top = viewport.getBoundingClientRect().top;
  let current = sections[0]?.id;
  for (const section of sections)
    if (section.getBoundingClientRect().top - top <= reachedOffset)
      current = section.id;
  return current;
}

export function useSettingsOutline(place: string, hash: string) {
  const [sections, setSections] = useState<readonly SettingsOutlineEntry[]>([]);
  const [active, setActive] = useState<string | undefined>();
  const [content, setContent] = useState<HTMLElement | null>(null);
  const [scroller, setScroller] = useState<HTMLElement | null>(null);
  const attach = (element: HTMLElement | null) => {
    setContent(element);
    if (!element) return;
    const viewport =
      element.closest<HTMLElement>('[data-slot=scroll-area-viewport]') ??
      element;
    setScroller(viewport);
    const target = `${place}#${hash}`;
    const measure = () => {
      const found = [
        ...element.querySelectorAll<HTMLElement>(
          `[${settingsSectionAttribute}]`,
        ),
      ];
      const next = found.map((section) => ({
        id: section.id,
        title: section.getAttribute(settingsSectionAttribute) ?? section.id,
      }));
      setSections((previous) =>
        sameEntries(previous, next) ? previous : next,
      );
      if (hash !== '' && element.getAttribute(landedAttribute) !== target) {
        element.setAttribute(landedAttribute, target);
        element.setAttribute(chosenAttribute, hash);
        element.setAttribute(pinnedAttribute, hash);
      }
      const pinned = element.getAttribute(pinnedAttribute);
      const linked = found.find((section) => section.id === pinned);
      if (linked) viewport.scrollTop = sectionTop(viewport, linked);
      setActive(
        element.getAttribute(chosenAttribute) ??
          currentSection(viewport, found),
      );
    };
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const root =
      viewport.closest<HTMLElement>('[data-slot=scroll-area]') ?? viewport;
    const release = () => {
      element.removeAttribute(chosenAttribute);
      element.removeAttribute(pinnedAttribute);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(element, { childList: true, subtree: true });
    viewport.addEventListener('scroll', schedule, { passive: true });
    for (const name of ['wheel', 'touchmove', 'keydown', 'pointerdown'])
      root.addEventListener(name, release, { passive: true });
    measure();
    return () => {
      setSections([]);
      setActive(undefined);
      cancelAnimationFrame(frame);
      observer.disconnect();
      viewport.removeEventListener('scroll', schedule);
      for (const name of ['wheel', 'touchmove', 'keydown', 'pointerdown'])
        root.removeEventListener(name, release);
    };
  };
  const go = (id: string) => {
    const section = content?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!section || !scroller) return;
    content?.removeAttribute(pinnedAttribute);
    content?.setAttribute(chosenAttribute, id);
    setActive(id);
    scroller.scrollTo({
      top: sectionTop(scroller, section),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
    });
    section.focus({ preventScroll: true });
  };
  return { sections, active, attach, go };
}
