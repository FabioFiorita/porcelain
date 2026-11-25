import type { ReactNode } from 'react';
import { toast, Toaster } from '@/components/ui/toast';

type Notice = {
  title: string;
  description?: ReactNode;
  type: 'success' | 'error' | 'info' | 'warning' | 'loading';
  timeout?: number;
  actionProps?: { children: string; onClick: () => void };
};

export function notify({
  title,
  description,
  type,
  timeout,
  actionProps,
}: Notice): string {
  return toast({
    title,
    description,
    type,
    ...(timeout === undefined ? {} : { duration: timeout }),
    ...(actionProps === undefined
      ? {}
      : {
          action: {
            label: actionProps.children,
            onAction: actionProps.onClick,
          },
        }),
  });
}

export function dismissNotice(id: string) {
  toast.dismiss(id);
}

export type CopyTarget =
  | 'address'
  | 'brief'
  | 'command'
  | 'commit id'
  | 'commit message'
  | 'comments'
  | 'device ID'
  | 'draft'
  | 'full path'
  | 'pairing link'
  | 'path'
  | 'project path'
  | 'relative path'
  | 'the command'
  | 'worktree path';

export function notifyCopy(target: CopyTarget, copied: boolean) {
  notify({
    title: copied ? `Copied ${target}` : `Could not copy ${target}`,
    type: copied ? 'success' : 'error',
  });
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  return <Toaster>{children}</Toaster>;
}
