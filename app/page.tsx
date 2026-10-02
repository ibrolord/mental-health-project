import Image from 'next/image';
import Link from 'next/link';
import { ArrowDown, ArrowUpRight, Check, HeartHandshake, LockKeyhole, Smartphone } from 'lucide-react';
import { SupportExplorer } from '@/components/launch/support-explorer';
import { APP_STORE_URL, LANDING_EVIDENCE, SOURCE_REPOSITORY } from '@/lib/landing-content';
import styles from './landing.module.css';

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
          <p className={styles.eyebrow}>FREE, OPEN-SOURCE MENTAL-HEALTH SUPPORT</p>
          <h1>Make room for <em>your mental health.</em></h1>
          <p className={styles.lead}>When life feels like a lot, finding support shouldn&apos;t. Understand your feelings, build a little structure, and find a next step that fits today.</p>
          <div className={styles.actions}>
            <a href={APP_STORE_URL} className={styles.primary}><Smartphone size={20} aria-hidden="true" />Get MHtoolkit for iOS<ArrowUpRight size={18} aria-hidden="true" /></a>
            <Link href="/onboarding" className={styles.textLink}>Try it in your browser <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </div>
          <ul className={styles.trust} aria-label="What to expect">
            {['Free to use', 'No ads', 'Start without an email'].map(item => <li key={item}><Check size={15} aria-hidden="true" />{item}</li>)}
          </ul>
        </div>
        <figure className={styles.heroArt}>
          <Image src="/launch-hero-2026.png" alt="Illustration of friends making time for reflection and supporting one another" width={1732} height={909} sizes="(max-width: 760px) 100vw, 52vw" priority />
          <figcaption><HeartHandshake size={20} aria-hidden="true" /><span>For the hard days, the ordinary days,<br />and the days you&apos;re finding your way.</span></figcaption>
        </figure>
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
      <section className={`${styles.wrap} ${styles.principles}`} aria-labelledby="principles-title">
        <div><p className={styles.eyebrow}>BUILT AROUND PEOPLE</p><h2 id="principles-title">Your wellbeing isn&apos;t<br />a performance metric.</h2></div>
        <div className={styles.principleList}>
          <article><LockKeyhole aria-hidden="true" size={22} /><div><h3>You choose what to share.</h3><p>Partner sharing and AI context are choices, not assumptions. Manage them in the app.</p></div></article>
          <article><HeartHandshake aria-hidden="true" size={22} /><div><h3>Support has more than one shape.</h3><p>Explore country-specific support resources, including African and diaspora communities, and bring a trusted person into your journey.</p></div></article>
          <article><Check aria-hidden="true" size={22} /><div><h3>You can see what&apos;s behind the tools.</h3><p>Explore the research behind our approaches and the source code behind the app.</p><Link href="/research" className={styles.textLink}>Read the research <ArrowUpRight size={16} aria-hidden="true" /></Link></div></article>
        </div>
      </section>
      <section className={`${styles.wrap} ${styles.faq}`} aria-labelledby="faq-title">
        <h2 id="faq-title">A few things you might be wondering.</h2>
        <details><summary>Who is MHtoolkit for?</summary><p>Adults who want practical support with everyday mental wellbeing: understanding feelings, managing overwhelm, building routines, and staying connected. Choose the tools that fit you.</p></details>
        <details><summary>Is it really free?</summary><p>Yes. MHtoolkit is free to use, with no advertising. Its source code is available under the AGPL-3.0 licence.</p></details>
        <details><summary>Do I need to create an account?</summary><p>You can start anonymously. Create an account when you want to keep your data across devices or connect with an accountability partner.</p></details>
        <details><summary>How does AI support work?</summary><p>Advisor offers a practical next step from the context you choose to share. AI chat is also available if you want to talk things through. AI processing is optional.</p></details>
        <details><summary>Can I use this alongside professional support?</summary><p>Yes. MHtoolkit provides everyday self-help tools, not diagnosis, treatment, or emergency care. You can prepare a Visit Brief to review and share with a professional. For urgent help, <Link href="/resources">find local support</Link>.</p></details>
      </section>
      <section className={`${styles.wrap} ${styles.download}`} aria-labelledby="download-title">
        <Image src="/icon.png" alt="" width={64} height={64} />
        <p className={styles.eyebrow}>START WHERE YOU ARE</p>
        <h2 id="download-title">You don&apos;t have to figure<br />everything out today.</h2>
        <p>Make a little room for yourself. Your toolkit is here.</p>
        <div className={styles.actions}>
          <a href={APP_STORE_URL} className={styles.primary}><Smartphone size={20} aria-hidden="true" />Get MHtoolkit for iOS<ArrowUpRight size={18} aria-hidden="true" /></a>
          <Link href="/onboarding" className={styles.textLink}>Try the web app <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
      </section>
      <footer className={`${styles.wrap} ${styles.footer}`}>
        <div><Link href="/" className={styles.brand}>MHtoolkit</Link><p>Free, open-source support for everyday mental health.</p></div>
        <nav aria-label="Footer navigation"><Link href="/privacy">Privacy</Link><Link href="/support">Support &amp; feedback</Link><a href={SOURCE_REPOSITORY}>Source code</a><Link href="/resources">Find urgent support</Link></nav>
      </footer>
    </main>
  );
}
