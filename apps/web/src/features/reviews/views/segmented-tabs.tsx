import type { ReactNode } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/shared/lib/utils';

export function SegmentedTabs<Value extends string>({
  label,
  value,
  options,
  onValue,
  className,
}: {
  label: string;
  value: Value;
  options: readonly { value: Value; label: ReactNode }[];
  onValue: (value: Value) => void;
  className?: string;
}) {
  return (
    <div className={cn('segmented-tabs shrink-0', className)}>
      <Tabs
        value={value}
        onValueChange={(next: unknown) => {
          const option = options.find((item) => item.value === next);
          if (option) onValue(option.value);
        }}
      >
        <TabsList aria-label={label}>
          {options.map((option) => (
            <TabsTrigger
              key={option.value}
              value={option.value}
              className="min-w-0"
            >
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}
