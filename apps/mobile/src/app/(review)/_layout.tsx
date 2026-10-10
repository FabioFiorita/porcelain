import { DestinationLayout } from '../../shell/destination-layout';
import { Stack } from 'expo-router';

function ReviewLayout() {
  return (
    <DestinationLayout name="review" title="Review">
      <Stack.Screen name="review-file" options={{ title: 'Changed file' }} />
      <Stack.Screen
        name="review-comments"
        options={{
          title: 'Comments',
          presentation: 'formSheet',
          sheetAllowedDetents: [0.75, 1],
          sheetGrabberVisible: true,
        }}
      />
    </DestinationLayout>
  );
}

export { ReviewLayout as default };
