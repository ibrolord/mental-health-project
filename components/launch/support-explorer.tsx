'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check } from 'lucide-react';
import { SUPPORT_AREAS } from '@/lib/landing-content';
import styles from '@/app/landing.module.css';

export function SupportExplorer() {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const area = SUPPORT_AREAS[selected];

  function moveFocus(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (index + 1) % SUPPORT_AREAS.length;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next = (index + SUPPORT_AREAS.length - 1) % SUPPORT_AREAS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = SUPPORT_AREAS.length - 1;
    else return;
    event.preventDefault();
    setSelected(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className={styles.explorer}>
      <div role="tablist" aria-label="Choose the support you want" aria-orientation="vertical" className={styles.tabs}>
        {SUPPORT_AREAS.map((item, index) => (
          <button key={item.id} ref={node => { tabs.current[index] = node; }} role="tab" id={`support-tab-${item.id}`} aria-controls="support-panel" aria-selected={selected === index} tabIndex={selected === index ? 0 : -1} onClick={() => setSelected(index)} onKeyDown={event => moveFocus(event, index)}>
            <span className={styles.tabNumber}>0{index + 1}</span><span>{item.label}</span><ArrowRight size={18} aria-hidden="true" />
          </button>
        ))}
      </div>
      <div role="tabpanel" id="support-panel" aria-labelledby={`support-tab-${area.id}`} tabIndex={0} className={styles.supportPanel}>
        <div className={styles.supportCopy}>
          <h3>{area.title}</h3><p>{area.description}</p>
          <ul>{area.tools.map(tool => <li key={tool}><Check size={16} aria-hidden="true" />{tool}</li>)}</ul>
          <Link href={area.href} className={styles.textLink}>{area.linkLabel}<ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
        <figure className={styles.appPreview}>
          <Image src={`/images/landing/${area.image}.png`} alt={area.alt} width={1206} height={2622} sizes="(max-width: 760px) 240px, 260px" />
          <figcaption>From the iOS app</figcaption>
        </figure>
      </div>
    </div>
  );
}
