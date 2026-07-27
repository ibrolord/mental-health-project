# Contributing to MHtoolkit

Thanks for wanting to help. This document covers the rules that are not
obvious from reading the code, and that automated checks will reject if you
break them.

MHtoolkit is licensed under **AGPL-3.0-only**. By contributing you agree
your work is licensed the same way. If you run a modified version as a
network service, the AGPL requires you to publish your changes.

## Getting set up

```bash
npm install
cp .env.example .env.local   # fill in Supabase and model provider keys
npm run dev
```

The Expo app lives in `mobile/` with its own `package.json`.

Before opening a pull request:

```bash
npx tsc --noEmit
npm run lint
npm test
```

## The rules that matter

These exist because of real incidents, real App Store rejections, or real
privacy exposure. Please do not work around them.

### 1. Never commit anything under `docs/launch/`

It holds outreach material including named contacts. It is gitignored, with
a deliberate exception for `campaign-links.csv`, which is campaign taxonomy
with no personal data and is read by tests.

**Never run `git add -A` in this repo.** Stage explicit paths.

### 2. Crisis helpline numbers must be verified from the source

Every number in `lib/resources.ts` must be confirmed from the operating
organization's own website, or from a vetting federation such as LifeLine
International or Befrienders Worldwide. Not from a search result, a blog
post, a business directory, or memory.

If you cannot confirm a number, add the organization with its URL and **no
phone number**, and let the per-country Find A Helpline links carry it.

Hours are stored per line and rendered per line. Never write copy claiming
the whole list is available 24/7, because it is not.

`npm run verify:resource-links` checks every URL and runs in the release
gate.

### 3. Partners never see raw data

Accountability partners have no `SELECT` policy on `moods`, `assessments`,
`goals`, `habits`, or `journal_entries`. Their only read path is the
`partner_snapshot` SECURITY DEFINER function, which returns derived counts
gated per scope.

Journal entries, AI chat history, assessment scores, and the free-text notes
on mood entries are **never shareable under any combination of scopes**. Do
not add a policy, a view, or a column that widens this.

`npm run verify:partner-rls` proves it against a real Postgres instance in
Docker. Run it if you touch anything in that area.

### 4. Library entries carry no quotations

Every entry in the reading library has `quote === null`, enforced across the
whole catalog by `tests/library/editorial.test.ts`. This is a copyright
guard. Summaries must be original, premise-level paraphrase, never condensed
reproduction of a book's text or structure.

`mobile/lib/library/additional-books.ts` is the single source of truth and
the **web** app imports from it. Adding a book means updating the hardcoded
counts in the editorial test, and web and mobile catalogs must stay equal.

### 5. Do not reintroduce PSS-4

The PSS-4 screener is deliberately withheld. There is no documented usage
permission from the rights administrator. The release gate fails if `PSS4`
appears in either `definitions.ts`.

### 6. Watch the language around clinical claims

This app has been rejected under App Store Guideline 1.4.1. The gate fails
the build on phrases including `CBT-informed`, `AI therapist`, `voice
therapy`, `clinical-grade`, and `clinician-grade`.

Assessment results describe **symptom ranges**, never diagnoses. Every
screener shows its recall period, scoring limitation, and published source
before and after use. A positive response to PHQ-9 item 9 must surface
safety guidance before the result.

### 7. iOS does not get expo-notifications

`mobile/plugins/exclude-notifications-ios.js` excludes `expo-notifications`
and `expo-device` from iOS autolinking. Their native initialization crashes
on iPad at bridge startup, before any JavaScript runs, which caused two
rejections. JS-level lazy loading does not fix it.

Only `.android.ts` files may import those modules. The iOS variants are
inert stubs. If you need to check what the iOS bundle actually contains, use
the sourcemap:

```bash
npx expo export --platform ios --dump-sourcemap
```

`strings` on the Hermes `.hbc` output gives false negatives.

## Pull requests

Keep them focused, explain the reasoning rather than restating the diff, and
say what you did to verify. If you changed anything touching privacy,
crisis content, or App Store surface area, say so explicitly.

Security issues go through `SECURITY.md`, not a public pull request.
