import type { Metadata } from 'next';
import {
  ArrowUpRight,
  Globe,
  HeartHandshake,
  LifeBuoy,
  MessagesSquare,
  Phone,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { AfricaSupportFinder } from '@/components/africa-support-finder';
import {
  AFRICA_SUPPORT,
  COMMUNITY_HELP,
  CRISIS_LINES,
  CRISIS_NOTE,
  GLOBAL_DIRECTORIES,
  ONLINE_COMMUNITIES,
  RESOURCES_DISCLAIMER,
  SUPPORT_GROUPS,
  THERAPIST_DIRECTORIES,
  type ResourceLink,
} from '@/lib/resources';

export const metadata: Metadata = {
  title: 'Finding help - MHtoolkit',
  description:
    'Country-specific crisis directories, African support organizations, moderated peer communities, therapist directories, and support groups.',
};

function RegionChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </span>
  );
}

function ResourceCard({ resource }: { resource: ResourceLink }) {
  return (
    <li>
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="app-panel group flex h-full flex-col gap-2 p-5 transition-shadow hover:shadow-[0_18px_40px_-24px_hsl(var(--brand-ink)/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold leading-snug text-foreground">
            {resource.name}
          </h3>
          <ArrowUpRight
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {resource.description}
        </p>
        {resource.caveat && (
          <p className="rounded-lg border border-border bg-background px-3 py-2 text-xs leading-relaxed text-muted-foreground">
            {resource.caveat}
          </p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
          <RegionChip>{resource.region}</RegionChip>
          {resource.note && (
            <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[0.65rem] font-medium uppercase tracking-[0.08em] text-accent">
              {resource.note}
            </span>
          )}
        </div>
      </a>
    </li>
  );
}

function Section({
  icon: Icon,
  title,
  intro,
  resources,
}: {
  icon: typeof Users;
  title: string;
  intro: string;
  resources: ResourceLink[];
}) {
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border bg-card text-foreground">
          <Icon className="h-[1.1rem] w-[1.1rem]" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-2xl font-medium leading-tight text-foreground">
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {intro}
          </p>
        </div>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {resources.map((resource) => (
          <ResourceCard key={resource.url} resource={resource} />
        ))}
      </ul>
    </section>
  );
}

export default function ResourcesPage() {
  return (
    <main className="px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-4xl">
        <header className="max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
            Finding help
          </div>
          <h1 className="font-display text-4xl font-medium leading-[1.05] tracking-[-0.02em] text-foreground md:text-5xl">
            Support beyond this app.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            MHtoolkit is a self-reflection tool. When you want a person rather than
            an app, these are established directories you can search yourself.
          </p>
        </header>

        {/* Crisis block: deliberately the first thing on the page and visually
            separated from the directory cards below. */}
        <section
          id="crisis"
          aria-labelledby="crisis-heading"
          className="mt-8 overflow-hidden rounded-[var(--radius)] bg-primary text-primary-foreground"
        >
          <div className="p-6 md:p-7">
            <div className="flex items-center gap-2.5">
              <Phone className="h-[1.15rem] w-[1.15rem]" aria-hidden="true" />
              <h2 id="crisis-heading" className="text-lg font-semibold">
                If you need help right now
              </h2>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-primary-foreground/75">
              These lines are free and confidential. You do not need to be in danger
              to call. {CRISIS_NOTE}
            </p>

            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {CRISIS_LINES.map((line) => (
                <li key={line.url}>
                  <a
                    href={line.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-full flex-col gap-1 rounded-xl border border-primary-foreground/15 bg-primary-foreground/[0.07] p-4 transition-colors hover:bg-primary-foreground/[0.13] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold">{line.name}</span>
                      <span className="text-[0.65rem] uppercase tracking-[0.08em] text-primary-foreground/60">
                        {line.region}
                      </span>
                    </div>
                    {line.phone && (
                      <span className="font-display text-2xl leading-tight">
                        {line.phone}
                      </span>
                    )}
                    {/* Hours are per line and genuinely differ. Kenya is weekday
                        office hours, so never imply everything here is 24/7. */}
                    <span className="text-[0.7rem] font-medium uppercase tracking-[0.06em] text-primary-foreground/55">
                      {line.hours}
                    </span>
                    <span className="text-xs leading-relaxed text-primary-foreground/70">
                      {line.description}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <Section
          icon={Globe}
          title="Find help in your country"
          intro="If your country is not listed above, these directories cover most of the world and are kept current by the organizations that run them."
          resources={GLOBAL_DIRECTORIES}
        />

        <Section
          icon={HeartHandshake}
          title="Africa"
          intro="National organizations across the continent. Phone numbers are listed only where we could confirm them from the organization itself, so use the country lookups below for live, verified numbers."
          resources={AFRICA_SUPPORT}
        />

        <section className="mt-8">
          <AfricaSupportFinder />
        </section>

        <Section
          icon={ShieldCheck}
          title="Find a therapist"
          intro="Searchable directories run by non-profits, professional bodies, and public agencies. Most let you filter by cost, insurance, language, and specialty."
          resources={THERAPIST_DIRECTORIES}
        />

        <Section
          icon={Users}
          title="Support groups"
          intro="Peer support is free in most cases and does not require a diagnosis or a referral. Many of these groups meet online."
          resources={SUPPORT_GROUPS}
        />

        <Section
          icon={MessagesSquare}
          title="Moderated online communities"
          intro="Places to talk or vent with peers when you want conversation rather than a tool. Check each community’s rules, age limits, and moderators before posting, and avoid sharing identifying details."
          resources={ONLINE_COMMUNITIES}
        />

        <Section
          icon={LifeBuoy}
          title="Community and practical help"
          intro="Mental health is affected by housing, food, and money. These services connect you to local help across all of it."
          resources={COMMUNITY_HELP}
        />

        <p className="mt-12 rounded-[var(--radius)] border border-border bg-secondary/60 p-5 text-xs leading-relaxed text-muted-foreground">
          {RESOURCES_DISCLAIMER}
        </p>
      </div>
    </main>
  );
}
