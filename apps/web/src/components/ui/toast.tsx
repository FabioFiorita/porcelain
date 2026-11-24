import * as React from 'react';
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastRegion,
  ToastTitle,
  createToaster,
} from '@ui-sdk/react/toast';
import { cn } from 'cn';

import { Button } from '@/components/ui/button';
import {
  XIcon,
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from 'lucide-react';

const toast = createToaster({ duration: 5000 });

function ToastIcon({ type }: { type: string | undefined }) {
  let icon: React.ReactNode = null;
  if (type === 'success') icon = <CircleCheckIcon aria-hidden="true" />;
  if (type === 'info') icon = <InfoIcon aria-hidden="true" />;
  if (type === 'warning') icon = <TriangleAlertIcon aria-hidden="true" />;
  if (type === 'error')
    icon = <OctagonXIcon className="text-destructive" aria-hidden="true" />;
  if (type === 'loading')
    icon = <Loader2Icon className="animate-spin" aria-hidden="true" />;
  if (!icon) return null;
  return (
    <span
      data-slot="toast-icon"
      className="shrink-0 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4"
    >
      {icon}
    </span>
  );
}

function Toaster({ children }: { children?: React.ReactNode }) {
  return (
    <>
      {children}
      <ToastRegion
        toaster={toast}
        aria-label="Notifications"
        side="bottom"
        align="end"
        className="pointer-events-none fixed inset-x-4 bottom-4 m-0 mx-auto flex w-auto max-w-sm flex-col-reverse gap-3 overflow-visible bg-transparent p-0 outline-none sm:right-4 sm:left-auto sm:mx-0 sm:w-full"
      >
        {(data) => (
          <Toast
            data-slot="toast"
            className={cn(
              'group/toast pointer-events-auto w-full rounded-md border bg-popover text-popover-foreground shadow-lg outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
            )}
          >
            <div
              data-slot="toast-content"
              className="flex h-full items-center gap-3 overflow-hidden p-4"
            >
              <ToastIcon type={data.type} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <ToastTitle
                  data-slot="toast-title"
                  className="text-sm font-medium"
                />
                <ToastDescription
                  data-slot="toast-description"
                  className="text-sm text-muted-foreground"
                />
              </div>
              <ToastAction
                data-slot="toast-action"
                className="shrink-0"
                render={<Button variant="outline" size="sm" />}
              />
              <ToastClose
                data-slot="toast-close"
                aria-label="Close toast"
                className="relative shrink-0 text-muted-foreground after:absolute after:-inset-2 after:content-[''] hover:text-foreground"
                render={<Button variant="ghost" size="icon-sm" />}
              >
                <XIcon aria-hidden="true" />
              </ToastClose>
            </div>
          </Toast>
        )}
      </ToastRegion>
    </>
  );
}

export { Toaster, toast };
