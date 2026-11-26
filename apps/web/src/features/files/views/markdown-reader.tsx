import type { MarkdownDocument } from '@tanstack/markdown';
import { ListTreeIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/shared/lib/utils';
import { TruncatedText } from '@/shared/views/truncated-text';
import { useReaderPlaces } from '../store';
import { markdownOutline, topHeadingLevel } from '../rules/markdown-outline';
import { parseMarkdownDocument, type MarkdownOutline } from './markdown-html';
import {
  MarkdownView,
  scrollToFragment,
  type MarkdownFile,
} from './markdown-view';

export function useMarkdownDocument(text: string) {
  const document = parseMarkdownDocument(text);
  const outline: MarkdownOutline = markdownOutline(document.headings ?? []);
  return { document, outline };
}

function jump(root: Element | null | undefined, id: string) {
  const target = root?.querySelector('[data-markdown-root]');
  if (target) scrollToFragment(target, `#${id}`);
}

function OutlineList({ outline }: { outline: MarkdownOutline }) {
  const top = topHeadingLevel(outline);
  return (
    <nav aria-label="On this page" className="text-caption">
      <p className="mb-2 font-medium text-foreground">On this page</p>
      <ul className="flex flex-col border-l">
        {outline.map((heading) => (
          <li key={heading.id}>
            <a
              href={`#${heading.id}`}
              onClick={(event) => {
                event.preventDefault();
                jump(
                  event.currentTarget.closest('[data-reader-scroll]'),
                  heading.id,
                );
              }}
              style={{
                paddingLeft: `${(heading.level - top) * 0.75 + 0.75}rem`,
              }}
              className="-ml-px block border-l border-transparent py-1 text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            >
              <TruncatedText text={heading.text} className="block" />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function MarkdownOutlineMenu({
  outline,
  root,
}: {
  outline: MarkdownOutline;
  root: Element | null;
}) {
  if (outline.length === 0) return null;
  const top = topHeadingLevel(outline);
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Outline"
                  className="@5xl/document:hidden"
                />
              }
            />
          }
        >
          <ListTreeIcon />
        </TooltipTrigger>
        <TooltipContent role="tooltip">Outline</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="max-h-96 w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>On this page</DropdownMenuLabel>
          {outline.map((heading) => (
            <DropdownMenuItem
              key={heading.id}
              onSelect={() => jump(root, heading.id)}
              style={{
                paddingLeft: `${(heading.level - top) * 0.75 + 0.5}rem`,
              }}
            >
              <TruncatedText text={heading.text} className="min-w-0 flex-1" />
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const USER_SCROLL = ['wheel', 'touchstart', 'keydown', 'pointerdown'];

function restorePlace(
  node: HTMLElement,
  place: { scrollTop: number; anchor: string },
  settle: () => void,
) {
  const content = node.querySelector('[data-markdown-root]');
  if (!content) return undefined;
  let expected = node.scrollTop;
  const apply = () => {
    if (place.anchor) scrollToFragment(content, place.anchor);
    else node.scrollTop = place.scrollTop;
    expected = node.scrollTop;
  };
  apply();
  if (!place.anchor && place.scrollTop === 0) return undefined;
  const observer = new ResizeObserver(apply);
  observer.observe(content);
  observer.observe(node);
  const moved = () => {
    if (Math.abs(node.scrollTop - expected) > 2) interrupt();
  };
  const stop = () => {
    observer.disconnect();
    node.removeEventListener('scroll', moved);
    for (const name of USER_SCROLL) node.removeEventListener(name, interrupt);
  };
  const interrupt = () => {
    stop();
    settle();
  };
  for (const name of USER_SCROLL)
    node.addEventListener(name, interrupt, { passive: true });
  node.addEventListener('scroll', moved, { passive: true });
  return stop;
}

export function MarkdownReader({
  document,
  outline,
  file,
  attach,
}: {
  document: MarkdownDocument;
  outline: MarkdownOutline;
  file: MarkdownFile;
  attach: (element: HTMLDivElement | null) => void;
}) {
  const places = useReaderPlaces();
  const key = `${file.scope.worktreeId}:${file.path}`;
  return (
    <div
      data-reader-scroll
      ref={(node) => {
        attach(node);
        if (!node) return;
        const place = places.place(key);
        const stopRestoring =
          place.anchor || Math.abs(node.scrollTop - place.scrollTop) > 1
            ? restorePlace(node, place, () => places.clearAnchor(key))
            : undefined;
        const remember = () => {
          if (node.offsetParent !== null)
            places.rememberScroll(key, node.scrollTop);
        };
        node.addEventListener('scroll', remember, { passive: true });
        return () => {
          stopRestoring?.();
          node.removeEventListener('scroll', remember);
        };
      }}
      className="min-h-0 flex-1 overflow-auto [overflow-anchor:none]"
    >
      <div
        className={cn(
          'mx-auto flex w-full justify-center gap-10 px-6 pt-6 pb-16',
          outline.length > 0 && '@5xl/document:max-w-5xl',
        )}
      >
        <MarkdownView
          text={document}
          file={file}
          variant="reader"
          className="w-full max-w-(--container-reading) min-w-0 flex-1"
        />
        {outline.length > 0 && (
          <aside className="sticky top-6 hidden max-h-[calc(100svh-10rem)] w-52 shrink-0 self-start overflow-y-auto overscroll-contain @5xl/document:block">
            <OutlineList outline={outline} />
          </aside>
        )}
      </div>
    </div>
  );
}
