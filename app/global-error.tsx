'use client';

import { useEffect } from 'react';
import { recordOperationalEvent } from '@/lib/observability';

export default function GlobalError({ reset }: { reset: () => void }) {
  useEffect(() => {
    void recordOperationalEvent('global_error');
  }, []);

  return (
    <html lang="en">
      <body>
        <main
          style={{
            alignItems: 'center',
            background: '#f6f1e8',
            color: '#243126',
            display: 'flex',
            fontFamily: 'Georgia, serif',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '24px',
          }}
        >
          <section style={{ maxWidth: '520px', textAlign: 'center' }}>
            <h1 style={{ fontSize: '32px', margin: 0 }}>MHtoolkit needs a reset</h1>
            <p style={{ fontFamily: 'sans-serif', lineHeight: 1.6 }}>
              The app could not finish loading. Your saved information has not
              been changed.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                background: '#24533d',
                border: 0,
                borderRadius: '10px',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: 700,
                padding: '12px 20px',
              }}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
