import { Leaf } from 'lucide-react';

import { TogetherPage } from '@/components/accountability/together-page';

export default function AccountabilityPage(): React.ReactElement {
  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-24 pt-20 md:px-8 md:pt-24">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-start justify-between gap-5">
          <div>
            <p className="text-sm font-semibold text-blue-600">Accountability</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Together</h1>
            <p className="mt-2 max-w-2xl text-slate-600">Share a few commitments with one trusted person. Support without surveillance.</p>
          </div>
          <div
            aria-label="Together leaf"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.15rem] bg-emerald-100 text-emerald-800 shadow-sm ring-1 ring-emerald-200/80 sm:h-16 sm:w-16"
            role="img"
          >
            <Leaf aria-hidden="true" className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={1.8} />
          </div>
        </header>
        <TogetherPage />
      </div>
    </main>
  );
}
