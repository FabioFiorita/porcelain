import { dirName, fileName } from '@porcelain/client-runtime/paths'
import { FlatList, Pressable, Text, View } from 'react-native'

import { ChromeGlyph } from '@/components/chrome-glyph'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type { CodeSearchFile, CodeSearchLine } from '@/lib/daemon/procedures/files'
import { cn } from '@/lib/utils'

import { pathTestId } from './file-paths'
import { commonIndent, matchSpans } from './search-highlight'

/**
 * Content-search results, grouped by file the way the desktop's Search rail groups them.
 *
 * A group is collapsible because a phone shows about eight lines of a hunk at a time, and a
 * file with forty matches would otherwise bury the next file entirely. Tapping any line —
 * match or context — opens the file there.
 */
export function ContentResults({
  bottomInset = 0,
  caseSensitive,
  files,
  onOpenLine,
  query,
  regex,
  selectedPath,
}: {
  bottomInset?: number
  caseSensitive: boolean
  files: readonly CodeSearchFile[]
  /** Repo-relative path plus the 1-based line the reader tapped. */
  onOpenLine: (path: string, line: number) => void
  query: string
  regex: boolean
  selectedPath: string | null
}): React.JSX.Element {
  return (
    <FlatList
      contentContainerClassName="gap-1 px-2 pb-8"
      contentContainerStyle={{ paddingBottom: bottomInset }}
      data={files}
      keyboardShouldPersistTaps="handled"
      keyExtractor={(file: CodeSearchFile) => file.path}
      renderItem={({ item }) => (
        <FileGroup
          caseSensitive={caseSensitive}
          file={item}
          query={query}
          regex={regex}
          selected={item.path === selectedPath}
          onOpenLine={onOpenLine}
        />
      )}
      testID="porcelain-search-content-results"
    />
  )
}

function FileGroup({
  caseSensitive,
  file,
  onOpenLine,
  query,
  regex,
  selected,
}: {
  caseSensitive: boolean
  file: CodeSearchFile
  onOpenLine: (path: string, line: number) => void
  query: string
  regex: boolean
  selected: boolean
}): React.JSX.Element {
  const directory = dirName(file.path)

  return (
    // `asChild` throughout: the Reusables collapsible is an unstyled primitive, so the classes
    // have to land on real React Native views — the same shape the registry's accordion uses.
    <Collapsible asChild defaultOpen>
      <View
        className={cn(
          'overflow-hidden rounded-xl border border-transparent',
          selected && 'border-border bg-muted/40',
        )}
      >
        <CollapsibleTrigger asChild>
          <Pressable
            accessibilityLabel={`${file.path}, ${file.matchCount} ${
              file.matchCount === 1 ? 'match' : 'matches'
            }`}
            accessibilityRole="button"
            className="min-h-11 flex-row items-center gap-2 px-3 py-2 active:bg-accent"
            testID={pathTestId('porcelain-search-group', file.path)}
          >
            <ChromeGlyph name="file" size={14} />
            <View className="min-w-0 flex-1">
              <Text className="font-mono text-[13px] text-foreground" numberOfLines={1}>
                {fileName(file.path)}
              </Text>
              {directory === '' ? null : (
                <Text
                  className="font-mono text-[11px] text-muted-foreground"
                  ellipsizeMode="head"
                  numberOfLines={1}
                >
                  {directory}
                </Text>
              )}
            </View>
            <Text className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {file.matchCount}
            </Text>
          </Pressable>
        </CollapsibleTrigger>

        <CollapsibleContent asChild>
          <View className="pb-1">
            {file.hunks.map((hunk, index) => {
              const indent = commonIndent(hunk.lines)
              return (
                <View
                  // A hunk's first line number is its identity within the file; the index is
                  // only the tiebreak for the (impossible) empty hunk.
                  key={hunk.lines[0]?.line ?? -index}
                  className={cn(index > 0 && 'mt-1 border-t border-border/40 pt-1')}
                >
                  {hunk.lines.map((line) => (
                    <ResultLine
                      key={line.line}
                      caseSensitive={caseSensitive}
                      indent={indent}
                      line={line}
                      path={file.path}
                      query={query}
                      regex={regex}
                      onOpen={onOpenLine}
                    />
                  ))}
                </View>
              )
            })}
          </View>
        </CollapsibleContent>
      </View>
    </Collapsible>
  )
}

function ResultLine({
  caseSensitive,
  indent,
  line,
  onOpen,
  path,
  query,
  regex,
}: {
  caseSensitive: boolean
  indent: number
  line: CodeSearchLine
  onOpen: (path: string, line: number) => void
  path: string
  query: string
  regex: boolean
}): React.JSX.Element {
  const text = line.text.slice(indent)

  return (
    <Pressable
      accessibilityLabel={`${path} line ${line.line}`}
      accessibilityRole="button"
      className={cn('flex-row gap-2 px-3 py-px active:bg-accent', line.match && 'bg-warning/10')}
      testID={`${pathTestId('porcelain-search-line', path)}-${line.line}`}
      onPress={() => {
        onOpen(path, line.line)
      }}
    >
      <Text className="w-9 shrink-0 text-right font-mono text-[10px] leading-4 tabular-nums text-muted-foreground/60">
        {line.line}
      </Text>
      <HighlightedText
        caseSensitive={caseSensitive}
        match={line.match}
        query={query}
        regex={regex}
        text={text}
      />
    </Pressable>
  )
}

/**
 * The line, with the literal query picked out.
 *
 * Nested `Text` rather than sibling views so a long line wraps at a sensible column instead of
 * at a span boundary — the same reason the source viewer nests its syntax spans.
 */
function HighlightedText({
  caseSensitive,
  match,
  query,
  regex,
  text,
}: {
  caseSensitive: boolean
  match: boolean
  query: string
  regex: boolean
  text: string
}): React.JSX.Element {
  const base = cn(
    'min-w-0 flex-1 font-mono text-[11px] leading-4',
    match ? 'text-foreground' : 'text-muted-foreground',
  )
  const spans = match ? matchSpans(text, query, regex, caseSensitive) : []
  if (spans.length === 0) {
    // An empty line still needs a glyph or the row collapses to zero height.
    return <Text className={base}>{text === '' ? ' ' : text}</Text>
  }

  const parts: { key: string; hit: boolean; content: string }[] = []
  let from = 0
  for (const span of spans) {
    if (span.start > from) {
      parts.push({ content: text.slice(from, span.start), hit: false, key: `t${from}` })
    }
    parts.push({ content: text.slice(span.start, span.end), hit: true, key: `m${span.start}` })
    from = span.end
  }
  if (from < text.length) parts.push({ content: text.slice(from), hit: false, key: `t${from}` })

  return (
    <Text className={base}>
      {parts.map((part) => (
        <Text
          key={part.key}
          className={part.hit ? 'bg-warning/30 font-semibold text-foreground' : undefined}
        >
          {part.content}
        </Text>
      ))}
    </Text>
  )
}
