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

function dismissOnUnmount() {
  return () => toast.dismiss();
}

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
        ref={dismissOnUnmount}
        toaster={toast}
        aria-label="Notifications"
        side="bottom"
        align="end"
        className="pointer-events-none fixed inset-x-4 bottom-4 m-0 mx-auto block w-auto max-w-sm overflow-visible bg-transparent p-0 outline-none sm:right-4 sm:left-auto sm:mx-0 sm:w-full [&>ol]:relative"
      >
        {(data) => (
          <Toast
            data-slot="toast"
            className={cn(
              'group/toast pointer-events-auto absolute right-0 bottom-0 z-[calc(1000-var(--toast-index))] w-full origin-bottom rounded-md border bg-popover text-popover-foreground shadow-lg will-change-transform outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
              '[--gap:0.75rem] [--height:var(--toast-front-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset,0px)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-y,0px))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))]',
              'h-(--height) [transform:translateX(var(--toast-swipe-x,0px))_translateY(calc(var(--toast-swipe-y,0px)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] [transition:transform_500ms_cubic-bezier(0.22,1,0.36,1),opacity_500ms,height_150ms] data-swiping:transition-none motion-reduce:transition-none',
              "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
              'data-expanded:h-(--toast-height) data-expanded:[transform:translateX(var(--toast-swipe-x,0px))_translateY(var(--offset-y))]',
              'data-starting-style:[transform:translateY(150%)]',
              '[&[data-ending-style]:not([data-swipe-direction])]:[transform:translateY(150%)]',
              'data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-y,0px)+150%))]',
              'data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-x,0px)-150%))_translateY(var(--offset-y))]',
              'data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-x,0px)+150%))_translateY(var(--offset-y))]',
              'data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-y,0px)-150%))]',
            )}
          >
            <div
              data-slot="toast-content"
              className="flex h-full items-center gap-3 overflow-hidden p-4 transition-opacity duration-250 ease-[cubic-bezier(0.22,1,0.36,1)] group-[:not([data-front]):not([data-expanded])]/toast:opacity-0"
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
