import { ContentUnavailableView, Host } from '@expo/ui/swift-ui';

export function WorktreeEmpty({ title }: { title: string }) {
  return (
    <Host style={{ flex: 1 }}>
      <ContentUnavailableView
        title={title}
        description="Select a worktree to continue."
      />
    </Host>
  );
}
