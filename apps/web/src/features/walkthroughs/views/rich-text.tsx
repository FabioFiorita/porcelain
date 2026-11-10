import { richParts } from '@porcelain/client/walkthroughs/rules';

export function RichText({ text }: { text: string }) {
  return (
    <>
      {richParts(text).map((part, index) =>
        part.kind === 'code' ? (
          <code
            key={index}
            className="rounded bg-muted px-1 py-px font-mono text-[0.86em]"
          >
            {part.text}
          </code>
        ) : (
          part.text
        ),
      )}
    </>
  );
}
