'use client';

import { useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import { AFRICA_COUNTRY_LOOKUPS } from '@/lib/resources';

export function AfricaSupportFinder() {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLocaleLowerCase();
  const visible = AFRICA_COUNTRY_LOOKUPS.filter((lookup) =>
    lookup.region.toLocaleLowerCase().includes(normalized)
  );

  return (
    <div className="rounded-[var(--radius)] border border-border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-xl font-medium text-foreground">
            Find support in an African country
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Search all 54 countries. Dedicated pages open when available; otherwise
            the link opens Find A Helpline&apos;s global country picker.
          </p>
        </div>
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          54 countries
        </span>
      </div>

      <label className="relative mt-4 block">
        <span className="sr-only">Search for an African country</span>
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search Nigeria, Ghana, Kenya..."
          className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      {visible.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No country matches that search. Try the country&apos;s full name.
        </p>
      ) : (
        <ul className="mt-4 grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {visible.map((lookup) => (
            <li key={lookup.region}>
              <a
                href={lookup.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>
                  <span className="block">{lookup.region}</span>
                  <span className="block text-[0.65rem] font-normal uppercase tracking-[0.08em] text-muted-foreground">
                    {lookup.note}
                  </span>
                </span>
                <ArrowUpRight
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
