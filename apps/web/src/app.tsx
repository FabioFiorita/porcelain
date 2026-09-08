import { FolderGit2Icon, MoonIcon, SunIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export function App() {
  const [dark, setDark] = useState(false);
  return (
    <div
      className={cn('min-h-svh bg-background text-foreground', dark && 'dark')}
    >
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <h1 className="font-medium">Porcelain</h1>
        <Button
          variant="ghost"
          size="icon"
          aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={() => setDark(!dark)}
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </Button>
      </header>
      <Separator />
      <main className="mx-auto flex min-h-[70svh] max-w-6xl items-center justify-center px-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FolderGit2Icon />
            </EmptyMedia>
            <EmptyTitle>No environment connected</EmptyTitle>
            <EmptyDescription>
              Your projects, worktrees, and reviews will appear here.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </main>
    </div>
  );
}
