'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

export const CHALLENGE_SHARE_URL =
  'https://mhtoolkit.vercel.app/?utm_source=referral&utm_medium=referral&utm_campaign=seven_day_check_in&utm_content=member_share';

export function ShareChallengeButton() {
  const [shared, setShared] = useState(false);

  const share = async () => {
    const data = {
      title: 'MHtoolkit 7-Day Private Check-In',
      text: 'I found a private 30-second check-in with no signup required. Try it for seven days:',
      url: CHALLENGE_SHARE_URL,
    };

    try {
      if (navigator.share) {
        await navigator.share(data);
      } else {
        await navigator.clipboard.writeText(CHALLENGE_SHARE_URL);
      }
      setShared(true);
      window.setTimeout(() => setShared(false), 2500);
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') {
        console.warn('Unable to share challenge:', error);
      }
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="inline-flex items-center gap-2 rounded-full border border-[#9db4a6] bg-white px-4 py-2 text-sm font-semibold text-[#24483e] transition hover:bg-[#f8faf7]"
    >
      {shared ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
      {shared ? 'Link copied' : 'Invite someone'}
    </button>
  );
}
