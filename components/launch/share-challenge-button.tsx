'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

export const CHALLENGE_SHARE_URL =
  'https://mhtoolkit.vercel.app/?utm_source=referral&utm_medium=referral&utm_campaign=seven_day_check_in&utm_content=member_share';

export function ShareChallengeButton() {
  const [result, setResult] = useState<'idle' | 'shared' | 'copied'>('idle');

  const share = async () => {
    const data = {
      title: 'MHtoolkit 7-Day Private Check-In',
      text: 'I found a private 30-second check-in with no signup required. Try it for seven days:',
      url: CHALLENGE_SHARE_URL,
    };

    try {
      if (navigator.share) {
        await navigator.share(data);
        setResult('shared');
      } else {
        await navigator.clipboard.writeText(CHALLENGE_SHARE_URL);
        setResult('copied');
      }
      window.setTimeout(() => setResult('idle'), 2500);
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
      aria-label="Invite someone to try the 7-day private check-in"
      className="inline-flex items-center gap-2 rounded-full border border-[#9db4a6] bg-white px-4 py-2 text-sm font-semibold text-[#24483e] transition hover:bg-[#f8faf7]"
    >
      {result === 'idle' ? (
        <Share2 className="h-4 w-4" />
      ) : (
        <Check className="h-4 w-4" />
      )}
      <span aria-live="polite">
        {result === 'shared'
          ? 'Shared'
          : result === 'copied'
            ? 'Link copied'
            : 'Invite someone'}
      </span>
    </button>
  );
}
