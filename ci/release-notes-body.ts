import { Schema } from 'effect';

const NoteSection = Schema.Struct({
  kind: Schema.Literals(['new', 'improved', 'fixed']),
  items: Schema.Array(
    Schema.Struct({
      text: Schema.String,
      pulls: Schema.Array(Schema.Int),
    }),
  ),
});

export const ReleaseNotes = Schema.Struct({
  highlight: Schema.String,
  sections: Schema.Array(NoteSection),
});
export type ReleaseNotes = typeof ReleaseNotes.Type;

export const releaseNotesJsonSchema = Schema.toJsonSchemaDocument(
  ReleaseNotes,
  { onExcessProperty: 'error' },
).schema;

const headings: Record<(typeof NoteSection.Type)['kind'], string> = {
  new: 'New',
  improved: 'Improved',
  fixed: 'Fixed',
};
const order = ['new', 'improved', 'fixed'] as const;
const whatAndWhyCharacters = 1_500;

export function pullRequestNumbers(
  repository: string,
  generated: string,
): number[] {
  const link = new RegExp(
    `https://github\\.com/${repository.replaceAll('.', '\\.')}/pull/(\\d+)`,
    'g',
  );
  return [
    ...new Set([...generated.matchAll(link)].map((match) => Number(match[1]))),
  ];
}

export function whatAndWhy(body: string): string {
  const section = /^## What and why\s*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(
    body,
  )?.[1];
  return (section ?? body).trim().slice(0, whatAndWhyCharacters);
}

export function releaseBody(
  repository: string,
  notes: ReleaseNotes,
  generated: string,
  model: string,
): string {
  const sections = order.flatMap((kind) => {
    const items = notes.sections
      .filter((section) => section.kind === kind)
      .flatMap((section) => section.items);
    if (items.length === 0) return [];
    const lines = items.map((item) => {
      const links = item.pulls
        .map(
          (number) =>
            `[#${number}](https://github.com/${repository}/pull/${number})`,
        )
        .join(', ');
      return links ? `- ${item.text} (${links})` : `- ${item.text}`;
    });
    return [`### ${headings[kind]}`, lines.join('\n')];
  });
  return [
    notes.highlight,
    ...sections,
    `<details>\n<summary>Every pull request</summary>\n\n${generated.trim()}\n\n</details>`,
    `<sub>Drafted by \`${model}\` from the pull requests above.</sub>`,
  ].join('\n\n');
}
