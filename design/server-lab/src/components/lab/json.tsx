import { ChevronRight } from 'lucide-react';
import { useState } from 'react';

/** Collapsible JSON; long arrays show a prefix so huge responses stay usable. */
export function JsonView({
  value,
  depth = 0,
  name,
}: {
  value: unknown;
  depth?: number;
  name?: string;
}) {
  const [open, setOpen] = useState(depth < 2);
  const label =
    name !== undefined ? (
      <span className="text-muted-foreground">{name}: </span>
    ) : null;
  if (value === null || typeof value !== 'object')
    return (
      <div className="font-mono text-[11px] leading-5">
        {label}
        <Primitive value={value} />
      </div>
    );
  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value as Record<string, unknown>);
  const shown = entries.slice(0, 200);
  return (
    <div className="font-mono text-[11px] leading-5">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center hover:text-foreground"
      >
        <ChevronRight
          className={`size-3 transition-transform ${open ? 'rotate-90' : ''}`}
        />
        {label}
        <span className="text-muted-foreground">
          {Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`}
        </span>
      </button>
      {open && (
        <div className="ml-3 border-l pl-2">
          {shown.map(([key, item]) => (
            <JsonView key={key} name={key} value={item} depth={depth + 1} />
          ))}
          {entries.length > shown.length && (
            <div className="text-muted-foreground">
              … {entries.length - shown.length} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Primitive({ value }: { value: unknown }) {
  if (typeof value === 'string') {
    const text =
      value.length > 400
        ? `${value.slice(0, 400)}… (${value.length} chars)`
        : value;
    return (
      <span className="break-all text-[var(--series-green)]">"{text}"</span>
    );
  }
  if (typeof value === 'number')
    return <span className="text-[var(--series-blue)]">{value}</span>;
  if (typeof value === 'boolean')
    return <span className="text-[var(--series-violet)]">{String(value)}</span>;
  return <span className="text-muted-foreground">null</span>;
}

type Schema = {
  type?: string | string[];
  properties?: Record<string, Schema>;
  required?: string[];
  enum?: unknown[];
  const?: unknown;
  anyOf?: Schema[];
  oneOf?: Schema[];
  items?: Schema;
  pattern?: string;
  format?: string;
  default?: unknown;
  minItems?: number;
};

/** A request body skeleton from JSON Schema, filled with plausible values. */
export function example(
  schema: unknown,
  hints: Record<string, string> = {},
  key = '',
): unknown {
  const node = (schema ?? {}) as Schema;
  if (node.const !== undefined) return node.const;
  if (node.default !== undefined) return node.default;
  if (node.enum?.length) return node.enum[0];
  const union = node.anyOf ?? node.oneOf;
  if (union?.length) {
    const choice = union.find((option) => option.type !== 'null') ?? union[0];
    return example(choice, hints, key);
  }
  const type = Array.isArray(node.type)
    ? node.type.find((item) => item !== 'null')
    : node.type;
  switch (type) {
    case 'object': {
      const out: Record<string, unknown> = {};
      for (const [name, child] of Object.entries(node.properties ?? {}))
        if (
          node.required?.includes(name) ||
          Object.keys(node.properties ?? {}).length <= 4
        )
          out[name] = example(child, hints, name);
      return out;
    }
    case 'array':
      return node.minItems ? [example(node.items, hints, key)] : [];
    case 'integer':
    case 'number':
      return 0;
    case 'boolean':
      return true;
    case 'string':
      if (hints[key]) return hints[key];
      if (node.format === 'uuid') return '00000000-0000-4000-8000-000000000000';
      if (node.pattern === '^[a-f0-9]{64}$')
        return hints.statusToken ?? 'a'.repeat(64);
      if (node.format === 'date-time') return new Date().toISOString();
      return key === 'path' ? 'README.md' : '';
    default:
      return null;
  }
}
