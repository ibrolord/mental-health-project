'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  ExternalLink,
  Feather,
  NotebookPen,
  Repeat2,
  Search,
  Target,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  CURATED_LIBRARY,
  type CuratedBook,
  type LibraryIntegration,
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
    description: 'Write private notes that are not sent to AI chat.',
    href: '/journal',
    action: 'Open private journal',
    icon: Feather,
    style: 'border-rose-200 bg-rose-50 text-rose-950',
  },
] as const;

function integrationHref(book: CuratedBook, integration: LibraryIntegration): string {
  const params = new URLSearchParams({
    source: 'library',
    book: book.id,
    bookTitle: book.title,
  });

  if (integration.actionType === 'journal' && integration.prompt) {
    params.set('prompt', integration.prompt);
    return `/journal?${params.toString()}`;
  }
  if (integration.actionType === 'goal' && integration.goalContent) {
    params.set('content', integration.goalContent);
    return `/goals?${params.toString()}`;
  }
  if (integration.actionType === 'habit' && integration.habitName) {
    params.set('name', integration.habitName);
    if (integration.habitDescription) {
      params.set('description', integration.habitDescription);
    }
    return `/habits?${params.toString()}`;
  }

  return '/library';
}

const integrationStyle = {
  journal: {
    icon: NotebookPen,
    card: 'border-rose-200 bg-rose-50',
    label: 'text-rose-900',
  },
  goal: {
    icon: Target,
    card: 'border-sky-200 bg-sky-50',
    label: 'text-sky-900',
  },
  habit: {
    icon: Repeat2,
    card: 'border-amber-200 bg-amber-50',
    label: 'text-amber-900',
  },
} as const;

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
        book.centralPremise,
        book.topic,
        ...book.displayTags,
        ...book.corePremises.flatMap(({ title, premise }) => [title, premise]),
        ...book.practicalTakeaways.flatMap(({ title, description }) => [title, description]),
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
                  Source-backed reading guide
                </p>
                <h1 className="mt-3 max-w-3xl font-[family-name:var(--font-display)] text-4xl leading-tight md:text-6xl">
                  {selectedBook.title}
                </h1>
                <p className="mt-3 text-emerald-50/85">
                  by {selectedBook.author} · {selectedBook.read_time_minutes} min guide
                </p>
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
              <aside className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sm leading-6 text-sky-950">
                The premises below are paraphrased and linked to author, publisher, research, or
                clinical-context sources. They are not quotations and cannot replace the complete
                book.
              </aside>

              <section>
                <h2 className="font-[family-name:var(--font-display)] text-3xl text-slate-950">
                  A useful orientation
                </h2>
                <p className="mt-3 text-lg leading-8 text-slate-700">{selectedBook.summary}</p>
              </section>

              <section className="rounded-2xl bg-emerald-950 p-6 text-white">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-200">
                  Central premise
                </p>
                <p className="mt-3 text-lg leading-8 text-emerald-50">
                  {selectedBook.centralPremise}
                </p>
              </section>

              <section>
                <h2 className="font-[family-name:var(--font-display)] text-3xl text-slate-950">
                  Core premises, unpacked
                </h2>
                <ol className="mt-5 grid gap-5">
                  {selectedBook.corePremises.map((idea, index) => (
                    <li
                      key={idea.title}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-5 md:p-6"
                    >
                      <div className="flex items-start gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-950 text-sm font-semibold text-white">
                          {index + 1}
                        </span>
                        <div>
                          <h3 className="text-lg font-semibold text-slate-950">{idea.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-700">{idea.premise}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                            Why it matters
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">
                            {idea.whyItMatters}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                            Try it
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">
                            {idea.practice}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              <section>
                <h2 className="font-[family-name:var(--font-display)] text-3xl text-slate-950">
                  Takeaways you can use
                </h2>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {selectedBook.practicalTakeaways.map((takeaway) => (
                    <article
                      key={takeaway.title}
                      className="flex flex-col rounded-2xl border border-amber-200 bg-amber-50 p-5"
                    >
                      <h3 className="font-semibold text-amber-950">{takeaway.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-amber-950/80">
                        {takeaway.description}
                      </p>
                      <p className="mt-auto border-t border-amber-200 pt-4 text-sm font-medium leading-6 text-amber-950">
                        {takeaway.nextStep}
                      </p>
                    </article>
                  ))}
                </div>
              </section>

              <section>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">
                  Put the ideas to work
                </p>
                <h2 className="mt-1 font-[family-name:var(--font-display)] text-3xl text-slate-950">
                  Integrate this guide into MHtoolkit
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  Each action opens a prefilled draft for you to review. Nothing is saved until you
                  choose to save it.
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  {selectedBook.integrations.map((integration) => {
                    const style = integrationStyle[integration.actionType];
                    const Icon = style.icon;
                    return (
                      <article
                        key={integration.title}
                        className={`flex flex-col rounded-2xl border p-5 ${style.card}`}
                      >
                        <Icon className={`h-5 w-5 ${style.label}`} aria-hidden="true" />
                        <h3 className="mt-4 font-semibold text-slate-950">{integration.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-700">
                          {integration.description}
                        </p>
                        <Link
                          href={integrationHref(selectedBook, integration)}
                          className={`mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold ${style.label}`}
                        >
                          {integration.actionLabel}
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 p-6">
                <h2 className="font-[family-name:var(--font-display)] text-2xl text-slate-950">
                  Questions to carry forward
                </h2>
                <ol className="mt-4 space-y-3">
                  {selectedBook.reflectionPrompts.map((prompt, index) => (
                    <li key={prompt} className="flex gap-3 text-sm leading-6 text-slate-700">
                      <span className="font-semibold text-emerald-800">{index + 1}.</span>
                      <span>{prompt}</span>
                    </li>
                  ))}
                </ol>
              </section>

              {selectedBook.medicalCaveat && (
                <aside className="rounded-2xl border border-red-200 bg-red-50 p-5">
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className="mt-0.5 h-5 w-5 shrink-0 text-red-800"
                      aria-hidden="true"
                    />
                    <div>
                      <h2 className="font-semibold text-red-950">Important clinical boundary</h2>
                      <p className="mt-2 text-sm leading-6 text-red-900">
                        {selectedBook.medicalCaveat}
                      </p>
                    </div>
                  </div>
                </aside>
              )}

              <section>
                <h2 className="font-[family-name:var(--font-display)] text-2xl text-slate-950">
                  Sources and further reading
                </h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {selectedBook.sources.map((source) => (
                    <a
                      key={source.url}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 text-sm font-semibold text-emerald-900 hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      <span>
                        {source.label}
                        <span className="mt-1 block text-xs font-normal uppercase tracking-[0.1em] text-slate-500">
                          {source.sourceType.replace('-', ' ')}
                        </span>
                      </span>
                      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                    </a>
                  ))}
                </div>
              </section>

              <aside className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h2 className="font-semibold text-slate-950">Editorial scope</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {selectedBook.editorialNote}
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
              Go directly to a tool, or use source-backed guides to understand a book&apos;s core
              premises, apply its useful ideas, and keep its claims within appropriate limits.
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
                Source-backed reading guides
              </p>
              <h2
                id="book-notes-heading"
                className="mt-1 font-[family-name:var(--font-display)] text-3xl text-slate-950"
              >
                Browse by need, not raw tags.
              </h2>
            </div>
            <p className="text-sm text-slate-600">{CURATED_LIBRARY.length} in-depth guides</p>
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
                      Open the full guide
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
            Guides paraphrase authors&apos; premises, link their sources, and flag important
            limitations. They are not diagnoses, treatment recommendations, or substitutes for the
            complete books or professional care.
          </aside>
        </section>
      </div>
    </main>
  );
}
