'use client';

import { useEffect } from 'react';
import { captureCampaignFromLocation } from '@/lib/acquisition';

export function CampaignCapture() {
  useEffect(() => {
    captureCampaignFromLocation(window.location.search);
  }, []);

  return null;
}
