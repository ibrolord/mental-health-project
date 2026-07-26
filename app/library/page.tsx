'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  MessageCircle,
  Search,
  Sparkles,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  CURATED_LIBRARY,
  type CuratedBook,
  LIBRARY_TOPICS,
  type LibraryTopic,
} from '@/lib/library/editorial';

const pathways = [
  {
    title: 'Check a symptom pattern',
    description: 'Use published screeners with their original recall periods and scoring.',
    href: '/assessments',
    action: 'Choose a screener',
    icon: Brain,
    style: 'border-sky-200 bg-sky-50 text-sky-950',
  },
  {
    title: 'Notice what changes',
    description: 'Record a quick check-in and look for patterns over time.',
    href: '/tracker',
    action: 'Open mood tracker',
    icon: BarChart3,
    style: 'border-teal-200 bg-teal-50 text-teal-950',
  },
  {
    title: 'Build one repeatable step',
    description: 'Turn a small, realistic action into a routine you can adjust.',
    href: '/habits',
    action: 'Open habits',
    icon: CheckCircle2,
    style: 'border-amber-200 bg-amber-50 text-amber-950',
  },
  {
    title: 'Reflect in writing',
    description: 'Use AI chat for reflection, not diagnosis, treatment, or crisis support.',
    href: '/chat',
    action: 'Open AI chat',
    icon: MessageCircle,
    style: 'border-rose-200 bg-rose-50 text-rose-950',
  },
] as const;

export default function LibraryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<LibraryTopic>('All');
  const [selectedBook, setSelectedBook] = useState<CuratedBook | null>(null);

  const filteredBooks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return CURATED_LIBRARY.filter((book) => {
      const matchesTopic = selectedTopic === 'All' || book.topic === selectedTopic;
      if (!matchesTopic) return false;
      if (!query) return true;

      return [
        book.title,
        book.author,
        book.summary,
        book.topic,
        ...book.displayTags,
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [searchQuery, selectedTopic]);

  if (selectedBook) {
    return (
      <main className="min-h-screen bg-[#f4f1e8] px-4 py-10 pb-28 md:py-14">
        <article className="mx-auto max-w-4xl">
          <button
            type="button"
            onClick={() => setSelectedBook(null)}
            className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-emerald-900"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to library
          </button>

          <div className="overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-white shadow-[0_24px_70px_rgba(23,63,56,0.12)]">
            <header className="relative overflow-hidden bg-[#173f38] px-6 py-9 text-white md:px-10 md:py-12">
              <div className="absolute -right-14 -top-16 h-52 w-52 rounded-full bg-amber-300/20 blur-2xl" />
              <div className="relative">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-200">
                  Reviewed book note
                </p>
                <h1 className="mt-3 max-w-3xl font-[family-name:var(--font-display)] text-4xl leading-tight md:text-6xl">
                  {selectedBook.title}
                </h1>
                <p className="mt-3 text-emerald-50/85">by {selectedBook.author}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {selectedBook.displayTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </header>

            <div className="space-y-9 p-6 md:p-10">
              <section>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">
                  What the book argues
                </p>
                <p className="mt-3 text-lg leading-8 text-slate-700">{selectedBook.summary}</p>
              </section>

              <section>
                <h2 className="font-[family-name:var(--font-display)] text-3xl text-slate-950">
                  Ideas to consider
                </h2>
                <ol className="mt-5 grid gap-4">
                  {selectedBook.takeaways.map((takeaway, index) => (
                    <li
                      key={takeaway}
                      className="grid grid-cols-[2.25rem_1fr] gap-3 rounded-xl bg-slate-50 p-4"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-950 text-sm font-semibold text-white">
                        {index + 1}
                      </span>
                      <span className="pt-1 text-sm leading-6 text-slate-700">{takeaway}</span>
                    </li>
                  ))}
                </ol>
              </section>

              {selectedBook.action_step && (
                <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                  <div className="flex items-start gap-3">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-900" aria-hidden="true" />
                    <div>
                      <h2 className="font-semibold text-amber-950">A small experiment</h2>
                      <p className="mt-2 text-sm leading-6 text-amber-950/85">
                        {selectedBook.action_step}
                      </p>
                    </div>
                  </div>
                </section>
              )}

              <aside className="rounded-2xl border border-slate-200 p-5">
                <h2 className="font-semibold text-slate-950">How to use this note</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {selectedBook.editorialNote} A summary cannot capture the full book or assess
                  whether its ideas are appropriate for you.
                </p>
              </aside>
            </div>
          </div>
        </article>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f1e8] px-4 py-10 pb-28 md:py-14">
      <div className="mx-auto max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] border border-emerald-950/10 bg-[#173f38] px-6 py-9 text-white shadow-[0_24px_70px_rgba(23,63,56,0.18)] md:px-10 md:py-12">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-amber-300/20 blur-2xl" />
          <div className="relative max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm text-emerald-50">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Resource library
            </div>
            <h1 className="font-[family-name:var(--font-display)] text-4xl leading-tight md:text-6xl">
              Start with what you need.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-emerald-50/90 md:text-lg">
              Go directly to a tool, or browse carefully reviewed notes from popular self-help
              books. The library separates an author&apos;s ideas from clinical guidance.
            </p>
          </div>
        </section>

        <section className="mt-10" aria-labelledby="next-step-heading">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
            Find a next step
          </p>
          <h2
            id="next-step-heading"
            className="mt-1 font-[family-name:var(--font-display)] text-3xl text-slate-950"
          >
            What would help right now?
          </h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {pathways.map((pathway) => {
              const Icon = pathway.icon;
              return (
                <Link
                  key={pathway.href}
                  href={pathway.href}
                  className={`group flex min-h-56 flex-col rounded-2xl border p-5 transition-transform hover:-translate-y-1 ${pathway.style}`}
                >
                  <Icon className="h-6 w-6" aria-hidden="true" />
                  <h3 className="mt-5 text-lg font-semibold">{pathway.title}</h3>
                  <p className="mt-2 text-sm leading-6 opacity-75">{pathway.description}</p>
                  <span className="mt-auto flex items-center gap-2 pt-5 text-sm font-semibold">
                    {pathway.action}
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mt-12" aria-labelledby="book-notes-heading">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
                Reviewed reading notes
              </p>
              <h2
                id="book-notes-heading"
                className="mt-1 font-[family-name:var(--font-display)] text-3xl text-slate-950"
              >
                Browse by need, not raw tags.
              </h2>
            </div>
            <p className="text-sm text-slate-600">{CURATED_LIBRARY.length} reviewed notes</p>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
            <label htmlFor="library-search" className="sr-only">
              Search reviewed book notes
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <Input
                id="library-search"
                placeholder="Search title, author, or topic"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-11 pl-10"
              />
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Library topics">
              {LIBRARY_TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => setSelectedTopic(topic)}
                  aria-pressed={selectedTopic === topic}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    selectedTopic === topic
                      ? 'bg-emerald-950 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {topic}
                </button>
              ))}
            </div>
          </div>

          {filteredBooks.length === 0 && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <p className="font-semibold text-slate-950">No reviewed notes match that search.</p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedTopic('All');
                }}
                className="mt-3 text-sm font-semibold text-emerald-800 underline underline-offset-4"
              >
                Clear filters
              </button>
            </div>
          )}

          {filteredBooks.length > 0 && (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {filteredBooks.map((book) => (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => setSelectedBook(book)}
                  className="group flex min-h-64 flex-col rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-emerald-800/30 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
                      {book.topic}
                    </span>
                    <span className="text-xs text-slate-500">{book.read_time_minutes} min note</span>
                  </div>
                  <h3 className="mt-5 font-[family-name:var(--font-display)] text-3xl leading-tight text-slate-950">
                    {book.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">by {book.author}</p>
                  <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{book.summary}</p>
                  <span className="mt-auto flex items-center gap-2 pt-5 text-sm font-semibold text-emerald-800">
                    Read reviewed note
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </span>
                </button>
              ))}
            </div>
          )}

          <aside className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
            Book notes summarize authors&apos; ideas and flag important limitations. They are not
            diagnoses, treatment recommendations, or substitutes for the complete books or
            professional care.
          </aside>
        </section>
      </div>
    </main>
  );
}
