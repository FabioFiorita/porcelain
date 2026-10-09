import { Empty } from './empty';

const notices = {
  binary: ['Binary file', 'This file cannot be displayed as text.'],
  unsupported: [
    'Preview unavailable',
    'This file type does not have a preview.',
  ],
  unavailable: ['File unavailable', 'The file could not be read.'],
  oversized: ['File too large', 'Choose a smaller file to preview.'],
} as const;
export function FileNotice({
  kind,
  description,
  action,
}: {
  kind: keyof typeof notices;
  description?: string;
  action?: { label: string; onPress: () => void };
}) {
  const [title, fallback] = notices[kind];
  return (
    <Empty
      icon="file"
      title={title}
      description={description ?? fallback}
      action={action}
    />
  );
}
