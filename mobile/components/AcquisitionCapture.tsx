import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { captureCampaignFromUrl } from '@/lib/acquisition';

export function AcquisitionCapture() {
  useEffect(() => {
    void Linking.getInitialURL().then(captureCampaignFromUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => {
      void captureCampaignFromUrl(url);
    });

    return () => subscription.remove();
  }, []);

  return null;
}
