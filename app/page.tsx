import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowUpRight, Check, Code2, HeartHandshake, LockKeyhole } from 'lucide-react';
import { SupportExplorer } from '@/components/launch/support-explorer';
import { APP_SCREENS, APP_SCREEN_SIZE, APP_STORE_BADGE, APP_STORE_URL, LANDING_EVIDENCE, SOURCE_REPOSITORY, TRUSTED_RESOURCES } from '@/lib/landing-content';
import styles from './landing.module.css';

export const metadata: Metadata = {
  description: 'A free iPhone app for burnout and everyday mental health. Check in, write one line, pick one small step. Open source (AGPL-3.0) and not for profit. No ads, and your data is never sold.',
};

function AppStoreBadge({ size = 'large' }: { size?: 'large' | 'small' }) {
  const height = size === 'large' ? 52 : 44;
  const width = size === 'large' ? 156 : 132;
  return (
    <a href={APP_STORE_URL} className={styles.badgeLink}>
      {/* Apple's official badge artwork, shown unmodified as their marketing guidelines require. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={APP_STORE_BADGE.src} alt="Download on the App Store" width={width} height={height} className={styles.badge} />
    </a>
  );
}

export default function Home() {
  return (
    <main className={styles.page}>
      <a className={styles.skipLink} href="#main-content">Skip to content</a>
      <header className={`${styles.wrap} ${styles.header}`}>
        <Link href="/" className={styles.brand} aria-label="MHtoolkit home">
          <Image src="/icon.png" width={42} height={42} alt="" /><span>MHtoolkit</span>
        </Link>
        <nav aria-label="Main navigation" className={styles.nav}>
          <a href="#our-mission" className={styles.desktopLink}>Our mission</a>
          <a href="#your-toolkit" className={styles.desktopLink}>Your toolkit</a>
          <Link href="/auth/login">Sign in</Link>
          <a href={APP_STORE_URL} className={styles.navCta}>Get the app <ArrowUpRight size={16} aria-hidden="true" /></a>
        </nav>
      </header>
      <section id="main-content" className={`${styles.wrap} ${styles.hero}`}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>A FREE APP FOR IPHONE</p>
          <h1>Burned out? <em>A 2-minute daily reset</em></h1>
          <p className={styles.lead}>Check in, write one line, pick one small step.</p>
          <AppStoreBadge />
          <p className={styles.browserLine}>No iPhone? <Link href="/daily-reset">Use it in your browser</Link></p>
          <p className={styles.androidHint}>On Android, you can add it to your home screen from the browser menu.</p>
          <p className={styles.openNote}>
            <Code2 size={18} aria-hidden="true" />
            <span>Free, open source (AGPL-3.0) and not for profit. No ads, no subscriptions, and your data is never sold. <a href={SOURCE_REPOSITORY}>See the code on GitHub</a></span>
          </p>
        </div>
        <div className={styles.heroArt}>
          <div className={`${styles.phone} ${styles.phoneBack}`} aria-hidden="true">
            <Image src={APP_SCREENS[1].src} alt="" width={APP_SCREEN_SIZE.width} height={APP_SCREEN_SIZE.height} sizes="240px" loading="lazy" />
          </div>
          <div className={styles.phone}>
            <Image src={APP_SCREENS[0].src} alt={APP_SCREENS[0].alt} width={APP_SCREEN_SIZE.width} height={APP_SCREEN_SIZE.height} sizes="(max-width: 760px) 260px, 300px" priority />
          </div>
        </div>
        <a href="#your-toolkit" className={styles.scrollLink}>Find what would help today <ArrowDown size={16} aria-hidden="true" /></a>
      </section>
      <section id="our-mission" className={styles.mission} aria-labelledby="mission-title">
        <div className={`${styles.wrap} ${styles.missionGrid}`}>
          <div>
            <p className={styles.eyebrow}>WHY WE&apos;RE HERE</p>
            <h2 id="mission-title">Support should be easier to reach.</h2>
            <p>Mental health touches how we feel, sleep, connect, and get through the day. Yet cost, stigma, and access can put support out of reach.</p>
            <p>Our mission is to make everyday mental-health support more accessible. MHtoolkit brings practical tools together in one free, open-source app, with room for your culture, your priorities, and your pace.</p>
            <a href={SOURCE_REPOSITORY} className={styles.lightLink}>Explore our open-source project <ArrowUpRight size={16} aria-hidden="true" /></a>
          </div>
          <div className={styles.stats}>
            {LANDING_EVIDENCE.map(stat => <article key={stat.id}>
              <p className={styles.statNumber}>{stat.value}</p><p>{stat.description}</p>
              <a href={stat.url} target="_blank" rel="noopener noreferrer">{stat.source} <ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>
            </article>)}
            <p className={styles.statNote}>Global figures describe the need for support, not results from using MHtoolkit.</p>
          </div>
        </div>
      </section>
      <section id="your-toolkit" className={`${styles.wrap} ${styles.toolkit}`} aria-labelledby="toolkit-title">
        <div className={styles.sectionIntro}>
          <div><p className={styles.eyebrow}>A TOOLKIT FOR REAL LIFE</p><h2 id="toolkit-title">What would help<br /><em>you today?</em></h2></div>
          <p>You don&apos;t need to use everything. Start with what matters to you, and make space for more when you&apos;re ready.</p>
        </div>
        <SupportExplorer />
      </section>
      <section className={styles.path} aria-labelledby="path-title">
        <div className={styles.wrap}>
          <p className={styles.eyebrow}>YOUR PACE, NOT A PERFECT ROUTINE</p>
          <h2 id="path-title">A small place to start.<br />Something to come back to.</h2>
          <ol className={styles.steps}>
            <li><span>01</span><h3>Start with what matters.</h3><p>Choose a feeling, a goal, or a practice. You can explore without creating a named account.</p></li>
            <li><span>02</span><h3>Make the next step manageable.</h3><p>Turn a goal into a small action, take a grounding break, or put a thought into words.</p></li>
            <li><span>03</span><h3>Notice what works for you.</h3><p>Return to your check-ins and routines. Keep what helps, adjust what doesn&apos;t, and invite support if you want it.</p></li>
          </ol>
        </div>
      </section>
      <section className={`${styles.wrap} ${styles.screens}`} aria-labelledby="screens-title">
        <p className={styles.eyebrow}>INSIDE THE IPHONE APP</p>
        <h2 id="screens-title">Three screens you will use most.</h2>
        <ul className={styles.screenList} tabIndex={0} aria-labelledby="screens-title">
          {APP_SCREENS.map(screen => <li key={screen.id}>
            <div className={`${styles.phone} ${styles.phoneSmall}`}>
              <Image src={screen.src} alt={screen.alt} width={APP_SCREEN_SIZE.width} height={APP_SCREEN_SIZE.height} sizes="(max-width: 760px) 62vw, 240px" loading="lazy" />
            </div>
            <h3>{screen.title}</h3>
            <p>{screen.caption}</p>
          </li>)}
        </ul>
      </section>
      <section className={`${styles.wrap} ${styles.principles}`} aria-labelledby="principles-title">
        <div><p className={styles.eyebrow}>BUILT AROUND PEOPLE</p><h2 id="principles-title">Your wellbeing isn&apos;t<br />a performance metric.</h2></div>
        <div className={styles.principleList}>
          <article><LockKeyhole aria-hidden="true" size={22} /><div><h3>You choose what to share.</h3><p>Partner sharing and AI context are choices, not assumptions. Manage them in the app.</p></div></article>
          <article><HeartHandshake aria-hidden="true" size={22} /><div><h3>Support has more than one shape.</h3><p>Explore country-specific support resources, including African and diaspora communities, and invite a trusted person to back you up.</p></div></article>
          <article><Check aria-hidden="true" size={22} /><div><h3>You can see what&apos;s behind the tools.</h3><p>Explore the research behind our approaches and the source code behind the app.</p><Link href="/research" className={styles.textLink}>Read the research <ArrowUpRight size={16} aria-hidden="true" /></Link></div></article>
        </div>
      </section>
      <section className={`${styles.wrap} ${styles.openSource}`} aria-labelledby="open-source-title">
        <Code2 size={26} aria-hidden="true" />
        <div>
          <h2 id="open-source-title">Open source and not for profit.</h2>
          <p>MHtoolkit is a not-for-profit project. There are no ads, no subscriptions, and your data is never sold. The code is public under the <span className={styles.nowrap}>AGPL-3.0</span> licence, so anyone can check how the app works and what it does with your data.</p>
          <div className={styles.openLinks}>
            <a href={SOURCE_REPOSITORY} className={styles.textLink}>See the code on GitHub <ArrowUpRight size={16} aria-hidden="true" /></a>
            <Link href="/privacy" className={styles.textLink}>Read our privacy notice <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </div>
        </div>
      </section>
      <section className={`${styles.wrap} ${styles.faq}`} aria-labelledby="faq-title">
        <h2 id="faq-title">A few things you might be wondering.</h2>
        <details><summary>Who is MHtoolkit for?</summary><p>Adults who want practical support with everyday mental wellbeing: understanding feelings, managing overwhelm, building routines, and staying connected. Choose the tools that fit you.</p></details>
        <details><summary>Is it really free?</summary><p>Yes. There are no ads and no subscriptions. MHtoolkit is a not-for-profit, open-source project, and its source code is available under the AGPL-3.0 licence.</p></details>
        <details><summary>Do I need an iPhone?</summary><p>No. The app is on the App Store for iPhone, and you can also <Link href="/daily-reset">use it in your browser</Link> on Android or a computer.</p></details>
        <details><summary>Do I need to create an account?</summary><p>You can start without an email. Anything you save is still stored with a private session ID until you delete it. Create an account if you want to keep that data across devices or invite a trusted person.</p></details>
        <details><summary>How does AI support work?</summary><p>Advisor and AI chat are optional support companions. They can listen, offer simple coping ideas, and point you to human or crisis help. They are not therapy, and they do not replace a person. Nothing is sent to an AI provider until you agree in the app. Personal details stay off unless you switch a category on.</p></details>
        <details><summary>Can I use this alongside professional support?</summary><p>Yes. MHtoolkit provides everyday self-help tools, not diagnosis, treatment, or emergency care. You can prepare a Visit Brief to review and share with a professional. For urgent help, <Link href="/resources">find local support</Link>.</p></details>
      </section>
      <section className={`${styles.wrap} ${styles.trusted}`} aria-labelledby="trusted-title">
        <p className={styles.eyebrow}>MORE SUPPORT</p>
        <h2 id="trusted-title">Resources we trust</h2>
        <ul className={styles.trustedList}>
          {TRUSTED_RESOURCES.map(resource => <li key={resource.id}>
            <a href={resource.url} target="_blank" rel="noopener noreferrer" className={styles.trustedCard}>
              <h3>{resource.name}</h3>
              <p className={styles.trustedBy}>By {resource.by} ({resource.region})</p>
              <p>{resource.description}</p>
              <span className={styles.trustedLink}>Visit site <ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></span>
            </a>
          </li>)}
        </ul>
      </section>
      <section className={`${styles.wrap} ${styles.download}`} aria-labelledby="download-title">
        <Image src="/icon.png" alt="" width={64} height={64} className={styles.downloadIcon} />
        <p className={styles.eyebrow}>START WHERE YOU ARE</p>
        <h2 id="download-title">You don&apos;t have to figure<br />everything out today.</h2>
        <p>Make a little room for yourself. Two minutes is enough to start.</p>
        <AppStoreBadge />
        <p className={styles.browserLine}>No iPhone? <Link href="/daily-reset">Use it in your browser</Link></p>
      </section>
      <footer className={`${styles.wrap} ${styles.footer}`}>
        <div><Link href="/" className={styles.brand}>MHtoolkit</Link><p>Free, open-source support for everyday mental health. A not-for-profit project, licensed AGPL-3.0.</p></div>
        <nav aria-label="Footer navigation"><Link href="/onboarding">Web app</Link><Link href="/privacy">Privacy</Link><Link href="/support">Support &amp; feedback</Link><a href={SOURCE_REPOSITORY}>Source code</a><Link href="/resources">Find urgent support</Link></nav>
      </footer>
    </main>
  );
}
