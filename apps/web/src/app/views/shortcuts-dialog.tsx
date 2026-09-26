import { formatForDisplay } from '@tanstack/react-hotkeys';
import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DialogIcon } from '@/app/views/dialog-icon';
import { SHORTCUT_GROUPS } from '@/shared/workspace/shortcuts';

function Keys({ keys }: { keys: string }) {
  return (
    <KbdGroup>
      {keys.split('+').map((key) => (
        <Kbd key={key} className="min-w-6 justify-center">
          {formatForDisplay(key)}
        </Kbd>
      ))}
    </KbdGroup>
  );
}

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-xl">
        <DialogHeader className="flex-row items-center text-left">
          <DialogIcon icon={Keyboard} />
          <div className="flex flex-col gap-0.5">
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>
              None of them fire while you are typing.
            </DialogDescription>
          </div>
        </DialogHeader>

        <ScrollArea className="-mr-3 min-h-0">
          <div className="flex flex-col gap-5 pr-3">
            {SHORTCUT_GROUPS.map((group) => (
              <section
                key={group.title}
                aria-labelledby={`shortcuts-${group.title}`}
              >
                <h3
                  id={`shortcuts-${group.title}`}
                  className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase"
                >
                  {group.title}
                </h3>
                <dl className="divide-y rounded-xl border">
                  {group.items.map((item) => (
                    <div
                      key={item.keys}
                      className="flex items-center justify-between gap-4 px-3 py-2"
                    >
                      <dt className="text-sm">{item.label}</dt>
                      <dd className="shrink-0">
                        <Keys keys={item.keys} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
