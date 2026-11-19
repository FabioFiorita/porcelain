export function ReservedCode({ count }: { count: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="min-h-40" />
      ))}
    </div>
  );
}
