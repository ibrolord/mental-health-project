import { TogetherPage } from '@/components/accountability/together-page';

export default function AccountabilityPage(): React.ReactElement {
  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-24 pt-20 md:px-8 md:pt-24">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <p className="text-sm font-semibold text-blue-600">Accountability</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Together</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Share a few commitments with one trusted person. Support without surveillance.</p>
        </header>
        <TogetherPage />
      </div>
    </main>
  );
}
