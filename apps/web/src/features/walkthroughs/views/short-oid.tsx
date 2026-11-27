export function ShortOid({ label }: { label: string }) {
  const match = /^(.*\s)([0-9a-f]{7})$/.exec(label);
  if (!match) return label;
  return (
    <>
      {match[1]}
      <span className="font-mono">{match[2]}</span>
    </>
  );
}
