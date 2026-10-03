import {
  ChevronDownIcon,
  ChevronUpIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { FILE_FIND_MAX_MATCHES } from '@/config/limits';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group';
import { findMatches, matchCountLabel, stepMatch } from '../rules/find-in-text';

export function FindBar({
  text,
  focusRequest,
  onReveal,
  onClose,
}: {
  text: string;
  focusRequest: number;
  onReveal: (line: number) => void;
  onClose: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const matches = findMatches(text, query, FILE_FIND_MAX_MATCHES);
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, [focusRequest]);
  const show = (next: number, found = matches) => {
    setIndex(next);
    const match = found[next];
    if (match) onReveal(match.line);
  };
  const step = (direction: 1 | -1) =>
    show(stepMatch(index, matches.length, direction));
  return (
    <div
      role="search"
      className="flex shrink-0 justify-end border-b px-3 py-1.5"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        onClose();
      }}
    >
      <InputGroup className="w-full max-w-sm">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          ref={input}
          aria-label="Find in file"
          placeholder="Find in file"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            show(
              0,
              findMatches(text, event.target.value, FILE_FIND_MAX_MATCHES),
            );
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              step(event.shiftKey ? -1 : 1);
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          {query !== '' && (
            <InputGroupText role="status">
              {matchCountLabel(index, matches.length, FILE_FIND_MAX_MATCHES)}
            </InputGroupText>
          )}
          <InputGroupButton
            size="icon-xs"
            aria-label="Previous match"
            disabled={matches.length === 0}
            onClick={() => step(-1)}
          >
            <ChevronUpIcon />
          </InputGroupButton>
          <InputGroupButton
            size="icon-xs"
            aria-label="Next match"
            disabled={matches.length === 0}
            onClick={() => step(1)}
          >
            <ChevronDownIcon />
          </InputGroupButton>
          <InputGroupButton
            size="icon-xs"
            aria-label="Close find"
            onClick={onClose}
          >
            <XIcon />
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
