import * as React from 'react';
import {
  Dialog as DialogRoot,
  DialogBackdrop,
  DialogClose as DialogClosePrimitive,
  DialogContent as DialogContentPrimitive,
  DialogDescription as DialogDescriptionPrimitive,
  DialogTitle as DialogTitlePrimitive,
  DialogTrigger as DialogTriggerPrimitive,
  createDialogController,
  type DialogController,
} from '@ui-sdk/react/dialog';
import { cn } from 'cn';

import { Button } from '@/components/ui/button';
import { XIcon } from 'lucide-react';

function focusMarkedField(event: React.FocusEvent<HTMLElement>) {
  const content = event.currentTarget;
  if (content.hasAttribute('data-focused')) return;
  content.setAttribute('data-focused', '');
  const field = content.querySelector<HTMLElement>('[data-autofocus]');
  if (field && field !== event.target) field.focus();
}

type RootProps = Omit<
  React.ComponentProps<typeof DialogRoot>,
  'children' | 'controller'
>;

function Dialog<Payload = unknown>({
  controller,
  children,
  onOpenChange,
  onPayloadChange,
  ...props
}: RootProps & {
  controller?: DialogController<Payload>;
  children?:
    | React.ReactNode
    | ((payload: Payload | undefined) => React.ReactNode);
}) {
  const [payload, setPayload] = React.useState<Payload | undefined>(undefined);
  return (
    <DialogRoot
      data-slot="dialog"
      {...(controller === undefined ? {} : { controller })}
      onOpenChange={(open, details) => {
        if (open && controller) setPayload(controller.getPayload());
        onOpenChange?.(open, details);
      }}
      onPayloadChange={(next, details) => {
        setPayload(next as Payload);
        onPayloadChange?.(next, details);
      }}
      {...props}
    >
      {typeof children === 'function' ? children(payload) : children}
    </DialogRoot>
  );
}

function DialogTrigger(
  props: React.ComponentProps<typeof DialogTriggerPrimitive>,
) {
  return <DialogTriggerPrimitive data-slot="dialog-trigger" {...props} />;
}

function DialogClose(props: React.ComponentProps<typeof DialogClosePrimitive>) {
  return <DialogClosePrimitive data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogBackdrop>) {
  return (
    <DialogBackdrop
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 data-closed:pointer-events-none isolate bg-black/80 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onFocus,
  ...props
}: Omit<React.ComponentProps<typeof DialogContentPrimitive>, 'children'> & {
  showCloseButton?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <>
      <DialogOverlay />
      <DialogContentPrimitive
        onFocus={(event) => {
          onFocus?.(event);
          focusMarkedField(event);
        }}
        data-slot="dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 m-0 data-closed:pointer-events-none grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-xs/relaxed text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none backdrop:bg-transparent sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogClosePrimitive
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogClosePrimitive>
        )}
      </DialogContentPrimitive>
    </>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="dialog-header"
      className={cn('flex flex-col gap-1', className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogClosePrimitive render={<Button variant="outline" />}>
          Close
        </DialogClosePrimitive>
      )}
    </div>
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitlePrimitive>) {
  return (
    <DialogTitlePrimitive
      data-slot="dialog-title"
      className={cn('font-heading text-sm font-medium', className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescriptionPrimitive>) {
  return (
    <DialogDescriptionPrimitive
      data-slot="dialog-description"
      className={cn(
        'text-xs/relaxed text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export {
  createDialogController,
  focusMarkedField,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
};
