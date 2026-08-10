import { Alert } from 'react-native';
import type { AppleHealthAiSummary } from './apple-health-core';
import { appleHealthAiSharePreview } from './apple-health-ai-preview';

export function confirmAppleHealthAiShare(
  summary: AppleHealthAiSummary
): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Share this Health summary?',
      appleHealthAiSharePreview(summary),
      [
        {
          text: 'Not now',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: 'Share once',
          onPress: () => resolve(true),
        },
      ],
      {
        cancelable: true,
        onDismiss: () => resolve(false),
      }
    );
  });
}
