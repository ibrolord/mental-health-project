'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bookmark,
  BookOpen,
  Clock3,
  Feather,
} from 'lucide-react';
import { useDataContext } from '@/lib/hooks/use-data-context';
import { UNIFIED_LIBRARY } from '@/lib/library/content';
import {
  composeSavedCollection,
  type ImportantJournalStateRow,
  type SavedCollection,
  type SavedLibraryStateRow,
  type SavedLibraryViewItem,
} from '@/lib/product-state';
import { supabase } from '@/lib/supabase/client';

const EMPTY_COLLECTION: SavedCollection = {
  upNext: [],
  saved: [],
  importantJournal: [],
};

function dateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Saved recently';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function LibraryCard({ item }: { item: SavedLibraryViewItem }) {
  return (
    <Link
      href={item.route}
      className="group app-panel block p-5 transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {item.mediaType}
        </span>
        <ArrowRight
          className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1"
          aria-hidden="true"
        />
      </div>
      <h3 className="mt-4 font-display text-xl font-medium text-foreground">
        {item.title}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{item.creator}</p>
      <p className="mt-4 text-xs font-medium text-accent">
        {item.topic} · {item.durationLabel}
      </p>
    </Link>
  );
}

export default function SavedPage() {
  const { context, authLoading } = useDataContext();
  const [collection, setCollection] = useState(EMPTY_COLLECTION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const ownerRef = useRef(context.user_id);
  ownerRef.current = context.user_id;

  useEffect(() => {
    if (authLoading) return;
    const ownerId = context.user_id;
    setCollection(EMPTY_COLLECTION);
    setError('');
    if (!ownerId) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    void Promise.all([
      supabase
        .from('user_library_items')
        .select('content_id, media_type, is_saved, priority, updated_at')
        .eq('user_id', ownerId)
        .or('is_saved.eq.true,priority.eq.next'),
      supabase
        .from('journal_entries')
        .select('id, is_favorite, created_at, updated_at')
        .eq('user_id', ownerId)
        .eq('is_favorite', true),
    ]).then(([libraryResult, journalResult]) => {
      if (!active || ownerRef.current !== ownerId) return;
      setLoading(false);
      if (libraryResult.error || journalResult.error) {
        setError('Your saved items could not be loaded.');
        return;
      }
      setCollection(
        composeSavedCollection(
          UNIFIED_LIBRARY,
          (libraryResult.data ?? []) as SavedLibraryStateRow[],
          (journalResult.data ?? []) as ImportantJournalStateRow[]
        )
      );
    });

    return () => {
      active = false;
    };
  }, [authLoading, context.user_id]);

  const total =
    collection.upNext.length +
    collection.saved.length +
    collection.importantJournal.length;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(212,160,72,0.16),_transparent_34%),linear-gradient(180deg,#f7f3e8_0%,#eef3ec_100%)] px-4 py-8 md:px-8 md:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="relative overflow-hidden rounded-[2rem] bg-[#173f38] px-6 py-8 text-white shadow-[0_24px_70px_rgba(23,63,56,0.18)] md:px-10 md:py-11">
          <div className="absolute -right-12 -top-16 h-56 w-56 rounded-full border border-white/15 bg-amber-300/10" />
          <div className="relative max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-emerald-50">
              <Bookmark className="h-4 w-4" aria-hidden="true" />
              Your saved space
            </div>
            <h1 className="mt-4 font-display text-4xl font-medium leading-tight md:text-6xl">
              Return to what mattered.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-emerald-50/75">
              Library choices and important journal markers stay in their original
              private records. This page only brings them together.
            </p>
          </div>
        </header>

        {error ? (
          <p role="alert" className="mt-6 rounded-xl border border-destructive/20 bg-card p-4 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="mt-8 text-sm text-muted-foreground">Loading your saved space...</p>
        ) : total === 0 ? (
          <section className="app-panel mt-8 p-8 text-center md:p-12">
            <Bookmark className="mx-auto h-7 w-7 text-accent" aria-hidden="true" />
            <h2 className="mt-4 font-display text-2xl font-medium text-foreground">
              Nothing saved yet
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
              Save a library resource, add it to Up next, or mark a journal entry
              important.
            </p>
            <Link
              href="/library"
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
            >
              Browse the library
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </section>
        ) : (
          <div className="mt-10 space-y-12">
            {collection.upNext.length > 0 ? (
              <section>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
                      Up next
                    </p>
                    <h2 className="mt-1 font-display text-3xl font-medium text-foreground">
                      Ready when you are
                    </h2>
                  </div>
                  <Clock3 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {collection.upNext.map((item) => (
                    <LibraryCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            ) : null}

            {collection.saved.length > 0 ? (
              <section>
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-accent" aria-hidden="true" />
                  <h2 className="font-display text-3xl font-medium text-foreground">
                    Saved resources
                  </h2>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {collection.saved.map((item) => (
                    <LibraryCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            ) : null}

            {collection.importantJournal.length > 0 ? (
              <section>
                <div className="flex items-center gap-3">
                  <Feather className="h-5 w-5 text-accent" aria-hidden="true" />
                  <div>
                    <h2 className="font-display text-3xl font-medium text-foreground">
                      Important in your journal
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Titles and private writing stay in Journal.
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {collection.importantJournal.map((item) => (
                    <Link
                      key={item.id}
                      href={item.route}
                      className="app-panel flex items-center justify-between gap-4 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <div>
                        <p className="font-medium text-foreground">{item.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Marked important · {dateLabel(item.updatedAt)}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
