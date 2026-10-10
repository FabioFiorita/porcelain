import { Box } from '../../../components/ui/box';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-screens/experimental';
import { Text } from '../../../components/ui/text';
import { Button } from '../../../components/ui/button';
import { CodeView } from '../../../components/ui/code-view';
import { DiffView } from '../../../components/ui/diff-view';
import { MarkdownView } from '../../../components/ui/markdown-view';
import { ImageView } from '../../../components/ui/image-view';
import { HtmlPreview } from '../../../components/ui/html-preview';
import type { ReviewRange } from '../../../components/ui/review-annotation';

export default function NativePreview({ name }: { name: string }) {
  const [range, setRange] = useState<ReviewRange>();
  const [expanded, setExpanded] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [large, setLarge] = useState(false);
  const [language, setLanguage] = useState('typescript');
  const sample = (() => {
    if (language === 'swift') {
      return '// Read-only Swift preview\nlet ready = true\nlet message = "Porcelain"\n\nfunc review() -> String {\n  return message\n}';
    }
    if (language === 'kotlin') {
      return '// Read-only Kotlin preview\nval ready = true\nval message = "Porcelain"\n\nfun review(): String {\n  return message\n}';
    }
    return '// Read-only file preview\nconst ready = true;\nconst message = "Porcelain";\n\nexport function review() {\n  return message;\n}';
  })();
  const [link, setLink] = useState('none');
  const [brokenImage, setBrokenImage] = useState(false);
  return (
    <SafeAreaView edges={{ bottom: true }} style={{ flex: 1 }}>
      <Box className="flex-1" surface="background">
        <Box gap={2} paddingX={4} paddingY={3}>
          <Text variant="heading">{name}</Text>
          {name === 'CodeView' || name === 'DiffView' ? (
            <>
              <Text variant="caption">
                Selected:{' '}
                {range
                  ? `${range.side ?? 'file'} lines ${range.startLine}–${range.endLine}`
                  : 'none'}
              </Text>
              <Box className="flex-row flex-wrap" gap={2}>
                {range ? (
                  <Button
                    label="Clear selection"
                    variant="outline"
                    size="sm"
                    onPress={() => setRange(undefined)}
                  />
                ) : null}
                <Button
                  label={wrap ? 'Horizontal scroll' : 'Wrap lines'}
                  variant="outline"
                  size="sm"
                  onPress={() => setWrap(!wrap)}
                />
                {name === 'CodeView' ? (
                  <>
                    <Button
                      label={(() => {
                        if (language === 'typescript') {
                          return 'TypeScript';
                        }
                        if (language === 'swift') {
                          return 'Swift';
                        }
                        return 'Kotlin';
                      })()}
                      size="sm"
                      variant="outline"
                      onPress={() => {
                        setRange(undefined);
                        setLarge(false);
                        setLanguage(
                          (() => {
                            if (language === 'typescript') {
                              return 'swift';
                            }
                            if (language === 'swift') {
                              return 'kotlin';
                            }
                            return 'typescript';
                          })(),
                        );
                      }}
                    />
                    <Button
                      label={large ? 'Small file' : 'Large file'}
                      variant="outline"
                      size="sm"
                      onPress={() => {
                        setRange(undefined);
                        setLarge(!large);
                      }}
                    />
                  </>
                ) : null}
              </Box>
            </>
          ) : null}
          {name === 'MarkdownView' || name === 'HtmlPreview' ? (
            <Text variant="caption">Link: {link}</Text>
          ) : null}
          {name === 'ImageView' ? (
            <Button
              label={brokenImage ? 'Valid image' : 'Invalid image'}
              variant="outline"
              size="sm"
              onPress={() => setBrokenImage(!brokenImage)}
            />
          ) : null}
        </Box>
        {name === 'CodeView' ? (
          <CodeView
            language={language}
            wrap={wrap}
            selection={range}
            onSelect={setRange}
            source={
              large
                ? Array.from(
                    { length: 5000 },
                    (_, index) =>
                      `const line${index + 1} = "${'long content '.repeat(12)}";`,
                  ).join('\n')
                : sample
            }
          />
        ) : null}
        {name === 'DiffView' ? (
          <DiffView
            language="typescript"
            wrap={wrap}
            selection={range}
            onSelect={setRange}
            onExpand={() => setExpanded(true)}
            lines={[
              {
                id: 'one',
                text: 'function review() {',
                oldLine: 1,
                newLine: 1,
                kind: 'context',
              },
              {
                id: 'old',
                text: '  return false;',
                oldLine: 2,
                kind: 'removed',
                tokens: [
                  { text: '  return ' },
                  { text: 'false', changed: true },
                  { text: ';' },
                ],
              },
              {
                id: 'new',
                text: '  return true;',
                newLine: 2,
                kind: 'added',
                tokens: [
                  { text: '  return ' },
                  { text: 'true', changed: true },
                  { text: ';' },
                ],
              },
              ...(expanded
                ? [
                    {
                      id: 'middle',
                      text: '  // Previously collapsed context',
                      oldLine: 3,
                      newLine: 3,
                    },
                  ]
                : [
                    {
                      id: 'gap',
                      text: 'Show 1 unchanged line',
                      kind: 'gap' as const,
                    },
                  ]),
              {
                id: 'last',
                text: '}',
                oldLine: 4,
                newLine: 4,
                kind: 'context',
              },
            ]}
          />
        ) : null}
        {name === 'MarkdownView' ? (
          <MarkdownView
            onLink={setLink}
            source={
              '# Review changes\n\nRead **bold**, *italic*, and `inline code`.\n\n## Files\n\n- button.tsx\n- input.tsx\n\n> Keep native navigation.\n\n```ts\nconst ready = true;\n```\n\n[Documentation](https://docs.expo.dev)'
            }
          />
        ) : null}
        {name === 'HtmlPreview' ? (
          <HtmlPreview
            onLink={setLink}
            html={
              '<style>body{font:16px system-ui;padding:16px;color:#222}h1{font-size:24px}</style><h1>Isolated HTML</h1><p id="status">Scripts are disabled</p><script>document.getElementById("status").textContent="SCRIPT EXECUTED";fetch("http://127.0.0.1:61991/script")</script><img src="http://127.0.0.1:61991/image"><iframe src="http://127.0.0.1:61991/frame"></iframe><link rel="stylesheet" href="http://127.0.0.1:61991/style"><p><a href="https://docs.expo.dev">Documentation link</a></p>'
            }
          />
        ) : null}
        {name === 'ImageView' ? (
          <ImageView
            label="Sample pixel image"
            data={
              brokenImage
                ? 'invalid'
                : 'iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAIAAABMXPacAAABc0lEQVR4nO3ZsQ0DMQwEwS/RzbhOt+IS3IGBj1aPG4HxgsKEvL433+v9uTX6/+d6+gee3gcAYLsPAMB2HwCA7T4AANt9AAC2+wAAbPcBANjuX6cttNYHEPcBxH0AcR9A3AcQ9wHEfQBxH0DcBxD3AcR9AHEfQNwHEPcBxH0Acd9BJu4DALDdBwBguw8AwHYfAIDtPgAA230AALb7AABs9wHUAKcttNYHEPcBxH0AcR9A3AcQ9wHEfQBxH0DcBxD3AcR9AHEfQNwHEPcBxH0Acd9BJu4DALDdBwBguw8AwHYfAIDtPgAA230AALb7AABs9wHUAKcttNYHEPcBxH0AcR9A3AcQ9wHEfQBxH0DcBxD3AcR9AHEfQNwHEPcBxH0Acd9BJu4DALDdBwBguw8AwHYfAIDtPgAA230AALb7AABs9wHUAKcttNYHEPcBxH0AcR9A3AcQ9wHEfQBxH0DcBxD3AcR9AHEfQNwHEPcBxH0Acf8HbOeINfQy0wEAAAAASUVORK5CYII='
            }
          />
        ) : null}
      </Box>
    </SafeAreaView>
  );
}
