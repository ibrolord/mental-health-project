import type { Metadata } from 'next';
import { DailyResetFlow } from '@/components/daily-reset/daily-reset-flow';

export const metadata: Metadata = {
  title: 'Daily reset - MHtoolkit',
  description:
    'Burned out? Take a 2-minute reset: check in, write one line, and pick one small step. Free, no sign-in needed.',
  alternates: { canonical: '/daily-reset' },
};

export default function DailyResetPage() {
  return <DailyResetFlow />;
}
