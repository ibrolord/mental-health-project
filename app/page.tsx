import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Eye,
  HeartHandshake,
  LockKeyhole,
  Sparkles,
} from 'lucide-react';

const week = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function Home() {
  return (
    <main className="launch-page">
      <div className="launch-orb launch-orb-one" aria-hidden="true" />
      <div className="launch-orb launch-orb-two" aria-hidden="true" />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-6 sm:px-8 lg:px-12">
        <Link href="/" className="flex items-center gap-3" aria-label="MHtoolkit home">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[#163a32] text-sm font-bold text-[#f7f1df]">
            MH
          </span>
          <span className="text-sm font-semibold tracking-[0.12em] text-[#163a32]">
            MHTOOLKIT
          </span>
        </Link>
        <div className="flex items-center gap-4 text-sm font-medium text-[#35584f]">
          <Link className="hidden hover:text-[#163a32] sm:inline" href="/support">
            Support
          </Link>
          <Link
            className="rounded-full border border-[#b9c9bf] bg-white/55 px-4 py-2 transition hover:bg-white"
            href="/auth/login"
          >
            Existing user
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid w-full max-w-7xl items-center gap-14 px-5 pb-20 pt-8 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:px-12 lg:pb-28 lg:pt-14">
        <div className="launch-reveal">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#afc3b4] bg-[#edf3e9]/80 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#315c4d]">
            <Sparkles className="h-3.5 w-3.5" />
            The 7-day private check-in
          </div>
          <h1 className="font-display max-w-3xl text-[clamp(3.4rem,8vw,7.5rem)] font-medium leading-[0.86] tracking-[-0.055em] text-[#163a32]">
            Notice how you&apos;re doing.
            <span className="mt-3 block italic text-[#c65f3d]">Without the noise.</span>
          </h1>
          <p className="mt-8 max-w-xl text-lg leading-8 text-[#48675f] sm:text-xl">
            A private 30-second check-in that helps you pause, log the moment,
            and spot patterns over seven days. No signup required.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/onboarding"
              className="group inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[#163a32] px-7 text-base font-bold text-[#fffdf4] shadow-[0_18px_45px_rgba(22,58,50,0.22)] transition hover:-translate-y-0.5 hover:bg-[#204c41]"
            >
              Start day one
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex min-h-14 items-center justify-center rounded-full border border-[#9fb4a7] bg-white/55 px-7 text-base font-bold text-[#24483e] transition hover:bg-white"
            >
              See how it works
            </a>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-[#58736c]">
            {['Works in your browser', 'No ads', 'Delete anytime'].map((item) => (
              <span key={item} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-[#c65f3d]" />
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="launch-reveal launch-delay-1 relative mx-auto w-full max-w-[520px]">
          <div className="absolute -left-8 top-10 hidden rotate-[-7deg] rounded-2xl bg-[#f4bf75] px-5 py-4 text-sm font-bold leading-5 text-[#4e351d] shadow-lg sm:block">
            30 seconds.
            <br />
            That&apos;s the habit.
          </div>
          <div className="launch-device">
            <div className="mb-10 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#6b7f77]">
                  Day 1 of 7
                </p>
                <p className="font-display mt-1 text-3xl font-medium text-[#163a32]">
                  Right now
                </p>
              </div>
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[#e6efe4]">
                <LockKeyhole className="h-5 w-5 text-[#315c4d]" />
              </span>
            </div>

            <p className="text-lg font-semibold text-[#274b41]">How does today feel?</p>
            <div className="mt-5 grid grid-cols-5 gap-2">
              {[
                ['Great', '01'],
                ['Good', '02'],
                ['Okay', '03'],
                ['Low', '04'],
                ['Heavy', '05'],
              ].map(([label, number], index) => (
                <div
                  key={label}
                  className={`rounded-2xl border px-2 py-4 text-center ${
                    index === 2
                      ? 'border-[#c65f3d] bg-[#fff1e8] text-[#9f4228]'
                      : 'border-[#d8ded7] bg-[#faf9f3] text-[#66766f]'
                  }`}
                >
                  <span className="block text-[10px] font-bold tracking-[0.12em]">{number}</span>
                  <span className="mt-2 block text-xs font-semibold">{label}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-3xl bg-[#173d34] p-5 text-[#f7f1df]">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Your seven-day rhythm</p>
                <p className="text-xs text-[#b8cec4]">1 complete</p>
              </div>
              <div className="mt-5 grid grid-cols-7 gap-2">
                {week.map((day, index) => (
                  <div key={`${day}-${index}`} className="text-center">
                    <div
                      className={`mx-auto h-2.5 w-2.5 rounded-full ${
                        index === 0 ? 'bg-[#f4bf75]' : 'bg-[#46675e]'
                      }`}
                    />
                    <span className="mt-2 block text-[10px] text-[#b8cec4]">{day}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="relative z-10 border-y border-[#cdd8cf] bg-[#f8f4e8]/75"
      >
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr]">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#b14f34]">
                Small enough to keep
              </p>
              <h2 className="font-display mt-4 text-5xl font-medium leading-[0.95] tracking-[-0.04em] text-[#163a32] sm:text-6xl">
                Seven days.
                <br />
                One honest moment at a time.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  number: '01',
                  title: 'Pause',
                  copy: 'Choose the feeling that fits. Add a private note only if you want to.',
                },
                {
                  number: '02',
                  title: 'Return',
                  copy: 'Come back for one quick check-in each day. Missing a day is not failure.',
                },
                {
                  number: '03',
                  title: 'Notice',
                  copy: 'Look back at your week and notice patterns worth carrying forward.',
                },
              ].map((step) => (
                <article
                  key={step.number}
                  className="rounded-[2rem] border border-[#cad6cc] bg-white/70 p-6"
                >
                  <span className="font-display text-3xl italic text-[#c65f3d]">
                    {step.number}
                  </span>
                  <h3 className="mt-12 text-xl font-bold text-[#163a32]">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#5a7069]">{step.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="grid gap-5 lg:grid-cols-3">
          {[
            {
              icon: LockKeyhole,
              title: 'Private by default',
              copy: 'Start with a random anonymous account. No email is needed for the challenge.',
            },
            {
              icon: Eye,
              title: 'No attention traps',
              copy: 'No ads, public feed, likes, or streak shame. The product is built for reflection.',
            },
            {
              icon: HeartHandshake,
              title: 'Clear boundaries',
              copy: 'MHtoolkit is a self-help tool, not therapy, diagnosis, medical advice, or crisis care.',
            },
          ].map(({ icon: Icon, title, copy }) => (
            <article
              key={title}
              className="rounded-[2rem] border border-[#c4d1c8] bg-[#edf3e9]/65 p-7 sm:p-8"
            >
              <Icon className="h-6 w-6 text-[#b14f34]" />
              <h3 className="mt-10 text-xl font-bold text-[#163a32]">{title}</h3>
              <p className="mt-3 leading-7 text-[#587169]">{copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative z-10 px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-[#173d34] px-6 py-14 text-center text-[#fffdf4] sm:px-12 sm:py-20">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#f4bf75]">
            Start where you are
          </p>
          <h2 className="font-display mx-auto mt-5 max-w-3xl text-5xl font-medium leading-[0.95] tracking-[-0.04em] sm:text-7xl">
            One check-in. No performance required.
          </h2>
          <p className="mx-auto mt-6 max-w-xl leading-7 text-[#c6d8d0]">
            Your first entry stays private and takes about 30 seconds.
          </p>
          <Link
            href="/onboarding"
            className="mt-9 inline-flex min-h-14 items-center justify-center gap-3 rounded-full bg-[#f4bf75] px-7 font-bold text-[#3f2a18] transition hover:-translate-y-0.5 hover:bg-[#ffd49a]"
          >
            Start day one
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-[#ccd7cf] px-5 py-9 text-sm text-[#60766f] sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row">
          <p>MHtoolkit is free, private by default, and built by Bolaji Agunbiade.</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-[#163a32]">
              Privacy
            </Link>
            <Link href="/support" className="hover:text-[#163a32]">
              Support
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
