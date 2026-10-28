import { View } from 'react-native';
import { Icon } from './icon';

export function ReviewStatus({
  status,
  phone = false,
}: {
  phone?: boolean;
  status: 'needs-you' | 'waiting' | 'ready' | 'none' | 'closed' | 'failed';
}) {
  switch (status) {
    case 'needs-you':
      return (
        <View accessible={false} className="size-2.25 rounded-full bg-brand" />
      );
    case 'waiting':
      return (
        <View
          accessible={false}
          className="size-3.5 rounded-full border-[1.5px] border-dashed border-muted-foreground"
        >
          <View className="absolute -top-0.375 -left-0.375 size-3.5 rotate-45 rounded-full border-[1.5px] border-transparent border-t-foreground" />
        </View>
      );
    case 'ready':
      return (
        <View
          accessible={false}
          className="size-3.5 items-center justify-center rounded-full bg-foreground"
        >
          <Icon name="check" size="tiny" tone="background" />
        </View>
      );
    case 'none':
      return (
        <View
          accessible={false}
          className={
            phone
              ? 'size-2.5 rounded-full border-[1.5px] border-muted-foreground'
              : 'size-2.5 rounded-full border-[1.5px] border-border-strong'
          }
        />
      );
    case 'closed':
      return <Icon name="closed" size="small" tone="muted" />;
    case 'failed':
      return <Icon name="warning" size="small" tone="destructive" />;
  }
}
