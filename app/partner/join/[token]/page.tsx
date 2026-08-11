import { JoinInvitePage } from '@/components/accountability/join-invite-page';

export default async function PartnerJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<React.JSX.Element> {
  const { token } = await params;
  return (
    <main className="min-h-screen bg-slate-50 px-4 pb-24 pt-20 md:px-8 md:pt-24">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 text-center">
          <p className="text-sm font-semibold text-blue-600">MHtoolkit Together</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">A private invitation</h1>
        </header>
        <JoinInvitePage token={token} />
      </div>
    </main>
  );
}
