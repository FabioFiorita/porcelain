import { DestinationLayout } from '../../shell/destination-layout';
import { Stack } from 'expo-router';
import { sheetPresentation } from '../../shared/navigation/sheet-presentation';
import { isTablet } from '../../shared/navigation/is-tablet';

export const unstable_settings = { anchor: 'review' };

function ReviewLayout() {
  return (
    <DestinationLayout name="review" title="Review">
      <Stack.Screen
        name="open/reviews/[reviewId]"
        options={{ title: 'Published review', headerBackVisible: !isTablet }}
      />
      <Stack.Screen
        name="reviews/[reviewId]"
        options={{ title: 'Published review', headerBackVisible: !isTablet }}
      />
      <Stack.Screen name="review-file" options={{ title: 'Changed file' }} />
      <Stack.Screen
        name="review-comments"
        options={{ title: 'Comments', ...sheetPresentation }}
      />
    </DestinationLayout>
  );
}

export { ReviewLayout as default };
