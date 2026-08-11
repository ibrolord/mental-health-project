import { JoinInvitePage } from '@/components/accountability/join-invite-page';

interface JoinPageProps {
  searchParams: Promise<{ token?: string | string[] }>;
}

export default async function PartnerJoinPage({ searchParams }: JoinPageProps): Promise<React.ReactElement> {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : null;
  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-24 pt-20 md:px-8 md:pt-24">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 text-center"><p className="text-sm font-semibold text-blue-600">MHtoolkit Together</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">A private invitation</h1></header>
        <JoinInvitePage token={token} />
      </div>
    </main>
  );
}
