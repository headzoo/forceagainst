'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
import { s } from '@/app/tailwind-styles';

type TurnstileApi = {
  render(container: HTMLElement, options: {
    sitekey: string;
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
    theme: 'light';
  }): string;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export function TurnstileWidget({ siteKey, onTokenChange }: {
  siteKey: string;
  onTokenChange: (token: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!ready || !siteKey || !containerRef.current || !window.turnstile || widgetIdRef.current) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: (token) => {
        setFailed(false);
        onTokenChange(token);
      },
      'expired-callback': () => onTokenChange(null),
      'error-callback': () => {
        setFailed(true);
        onTokenChange(null);
      },
      theme: 'light',
    });

    return () => {
      if (widgetIdRef.current && window.turnstile) window.turnstile.remove(widgetIdRef.current);
      widgetIdRef.current = null;
    };
  }, [onTokenChange, ready, siteKey]);

  if (!siteKey) {
    return <p className={s.authError}>Registration protection is temporarily unavailable.</p>;
  }

  return (
    <div className={s.turnstileField}>
      <Script
        id="cloudflare-turnstile"
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
        onReady={() => setReady(true)}
      />
      <div ref={containerRef} aria-label="Human verification" />
      {failed && <p className={s.authError}>Human verification failed. Please try again.</p>}
    </div>
  );
}
