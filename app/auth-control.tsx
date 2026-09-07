'use client';

import { cn, s } from '@/app/tailwind-styles';
import { type FormEvent, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { OPEN_SIGN_IN_DIALOG_EVENT } from '@/lib/auth-dialog';
import { normalizeUsername, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, usernameError } from '@/lib/username';
import { TurnstileWidget } from '@/app/turnstile-widget';

type AuthMode = 'sign-in' | 'sign-up' | 'recover-passkey';
const developmentTurnstileSiteKey = '1x00000000000000000000AA';
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  ?? (process.env.NODE_ENV === 'development' ? developmentTurnstileSiteKey : '');

export function AuthControl({ listenForSignInRequests = false }: { listenForSignInRequests?: boolean }) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaAttempt, setCaptchaAttempt] = useState(0);
  const [recoveryContext, setRecoveryContext] = useState<string | null>(null);
  const ready = useSyncExternalStore(() => () => undefined, () => true, () => false);
  const menuRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [open]);

  useEffect(() => {
    if (!menuOpen) return;

    const closeMenu = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!session) return;

    let active = true;
    fetch('/api/account/context')
      .then(async (response) => response.ok ? await response.json() as { isAdmin?: boolean } : null)
      .then((data) => { if (active) setIsAdmin(Boolean(data?.isAdmin)); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [session]);

  function showAuth(nextMode: AuthMode) {
    setMode(nextMode);
    setError('');
    setRecoveryContext(null);
    setCaptchaToken(null);
    setCaptchaAttempt((current) => current + 1);
    setOpen(true);
  }

  useEffect(() => {
    if (!listenForSignInRequests) return;

    const openSignIn = () => showAuth('sign-in');
    window.addEventListener(OPEN_SIGN_IN_DIALOG_EVENT, openSignIn);
    return () => window.removeEventListener(OPEN_SIGN_IN_DIALOG_EVENT, openSignIn);
  }, [listenForSignInRequests]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const name = String(form.get('name') ?? '').trim();
    const username = normalizeUsername(String(form.get('username') ?? ''));

    if (mode === 'recover-passkey') {
      if (!('PublicKeyCredential' in window)) {
        setSubmitting(false);
        setError('This browser does not support passkeys. Try a current version of Safari, Chrome, Edge, or Firefox.');
        return;
      }

      try {
        let context = recoveryContext;
        if (!context) {
          const response = await fetch('/api/passkey-recovery', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code: String(form.get('recoveryCode') ?? '') }),
          });
          const data = await response.json().catch(() => ({})) as { context?: unknown; error?: unknown };
          if (!response.ok || typeof data.context !== 'string') {
            setError(String(data.error ?? 'We could not start passkey recovery.'));
            return;
          }
          context = data.context;
          setRecoveryContext(context);
        }

        const result = await authClient.passkey.addPasskey({
          name: 'Recovered passkey',
          context,
          createSession: true,
        });
        if (result.error || !result.data) {
          setError(`${result.error?.message ?? 'Passkey setup was canceled or could not be completed.'} Try setup again within 10 minutes; this attempt has already used the recovery code.`);
          return;
        }

        try {
          await downloadPasskeyRecoveryCodes();
        } catch {
          window.alert('Your passkey was reset, but new recovery codes could not be downloaded. Open Account settings to create a new set now.');
        }
        setRecoveryContext(null);
        setOpen(false);
      } catch (problem) {
        setError(problem instanceof Error ? problem.message : 'Passkey recovery could not be completed.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === 'sign-up') {
      const validationError = usernameError(username);
      if (validationError) {
        setSubmitting(false);
        setError(validationError);
        return;
      }
      if (!captchaToken) {
        setSubmitting(false);
        setError('Complete the human verification before creating your account.');
        return;
      }
    }

    const result = mode === 'sign-up'
      ? await authClient.signUp.email({
        email,
        password,
        name,
        username,
        fetchOptions: { headers: { 'x-captcha-response': captchaToken! } },
      })
      : await authClient.signIn.email({ email, password, rememberMe: true });

    setSubmitting(false);
    if (mode === 'sign-up') {
      setCaptchaToken(null);
      setCaptchaAttempt((current) => current + 1);
    }

    if (result.error) {
      setError(result.error.message ?? 'We could not complete that request. Please try again.');
      return;
    }

    setOpen(false);
  }

  async function signInWithPasskey() {
    setSubmitting(true);
    setError('');
    if (!('PublicKeyCredential' in window)) {
      setSubmitting(false);
      setError('This browser does not support passkeys. Try a current version of Safari, Chrome, Edge, or Firefox.');
      return;
    }

    try {
      const result = await authClient.signIn.passkey();
      if (result.error) {
        setError(result.error.message ?? 'Passkey sign-in was canceled or could not be completed.');
        return;
      }
      setOpen(false);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Passkey sign-in was canceled or could not be completed.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || sessionPending) {
    return <span className={s.authLoading} aria-label="Checking account status" />;
  }

  if (session) {
    return (
      <div className={s.accountControl} ref={menuRef}>
        <button className={s.accountMenuTrigger}
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
          title={session.user.email}
        >
          <span>{session.user.name}</span><b aria-hidden="true">⌄</b>
        </button>
        {menuOpen && (
          <div className={s.accountMenu} role="menu">
            <Link className={s.accountMenuLiked} href="/liked" role="menuitem" onClick={() => setMenuOpen(false)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.8-7.7 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>
              Liked
            </Link>
            <Link className={s.accountMenuIcon} href="/comments" role="menuitem" onClick={() => setMenuOpen(false)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v11H9l-5 4v-15Z" /></svg>
              Comments
            </Link>
            <Link className={s.accountMenuIcon} href="/account" role="menuitem" onClick={() => setMenuOpen(false)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c.6-4 3-6 7-6s6.4 2 7 6" /></svg>
              Account
            </Link>
            <Link className={s.accountMenuIcon} href="/organization" role="menuitem" onClick={() => setMenuOpen(false)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V7l8-3 8 3v13M2 20h20M8 10h1M15 10h1M8 14h1M15 14h1M10 20v-3h4v3" /></svg>
              Organization
            </Link>
            {isAdmin && <Link href="/admin" role="menuitem" onClick={() => setMenuOpen(false)}>Review submissions</Link>}
            <button type="button" role="menuitem" onClick={() => authClient.signOut()}>Log out</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button className={s.authTrigger} type="button" onClick={() => showAuth('sign-in')}>Sign in</button>
      {open && (
        <div className={s.authBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className={s.authDialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <button className={s.authClose} type="button" onClick={() => setOpen(false)} aria-label="Close account dialog">×</button>
            <p className={cn(s.eyebrow, s.authDialogEyebrow)}><span /> YOUR ACCOUNT</p>
            <h2 id={titleId}>
              {mode === 'sign-up' ? 'Join the force.' : mode === 'recover-passkey' ? 'Reset passkey.' : 'Welcome back.'}
            </h2>
            <p className={s.authIntro}>
              {mode === 'sign-up'
                ? 'Create your account with an email and password.'
                : mode === 'recover-passkey'
                  ? 'Use one downloaded recovery code to replace every passkey on your account.'
                  : 'Sign in to your Force Against account.'}
            </p>
            <form onSubmit={handleSubmit}>
              {mode === 'recover-passkey' ? (
                <>
                  <label>
                    Email
                    <input name="email" type="email" autoComplete="email" required autoFocus disabled={Boolean(recoveryContext)} />
                  </label>
                  <label>
                    Recovery code
                    <input name="recoveryCode" type="text" autoComplete="off" spellCheck={false} required disabled={Boolean(recoveryContext)} />
                    <small className={s.authFieldHint}>
                      Starting recovery uses this code once. The replacement passkey must be created within 10 minutes.
                    </small>
                  </label>
                </>
              ) : mode === 'sign-up' && (
                <>
                  <label>
                    Name
                    <input name="name" type="text" minLength={2} maxLength={100} autoComplete="name" required autoFocus />
                  </label>
                  <label>
                    Username
                    <input name="username" type="text" minLength={USERNAME_MIN_LENGTH} maxLength={USERNAME_MAX_LENGTH} pattern="[A-Za-z0-9_]+" autoComplete="username" aria-describedby="username-hint" required />
                    <small id="username-hint" className={s.authFieldHint}>Lowercase letters, numbers, and underscores. This cannot be changed later.</small>
                  </label>
                </>
              )}
              {mode !== 'recover-passkey' && (
                <>
                  <label>
                    Email
                    <input name="email" type="email" autoComplete="email" required autoFocus={mode === 'sign-in'} />
                  </label>
                  <label>
                    Password
                    <input name="password" type="password" autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} minLength={8} required />
                  </label>
                </>
              )}
              {mode === 'sign-up' && <TurnstileWidget key={captchaAttempt} siteKey={turnstileSiteKey} onTokenChange={setCaptchaToken} />}
              {error && <p className={s.authError} role="alert">{error}</p>}
              <button className={s.authSubmit} type="submit" disabled={submitting || (mode === 'sign-up' && !captchaToken)}>
                {submitting
                  ? 'WORKING…'
                  : mode === 'sign-up'
                    ? 'CREATE ACCOUNT'
                    : mode === 'recover-passkey'
                      ? recoveryContext ? 'TRY PASSKEY SETUP AGAIN' : 'RESET PASSKEY'
                      : 'SIGN IN'}
                <span aria-hidden="true">→</span>
              </button>
              {mode === 'sign-in' && (
                <>
                  <p className={s.authDivider}><span>OR</span></p>
                  <button className={s.authPasskeyButton} type="button" disabled={submitting} onClick={() => void signInWithPasskey()}>
                    USE A PASSKEY <span aria-hidden="true">⌁</span>
                  </button>
                  <button className={s.authRecoveryButton} type="button" onClick={() => { setMode('recover-passkey'); setError(''); setRecoveryContext(null); }}>
                    Reset a passkey with a recovery code
                  </button>
                </>
              )}
            </form>
            {mode === 'recover-passkey' ? (
              <p className={s.authSwitch}>
                <button type="button" onClick={() => { setMode('sign-in'); setError(''); setRecoveryContext(null); }}>← Back to sign in</button>
              </p>
            ) : (
              <p className={s.authSwitch}>
                {mode === 'sign-up' ? 'Already have an account?' : 'New here?'}{' '}
                <button type="button" onClick={() => { setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up'); setError(''); setRecoveryContext(null); setCaptchaToken(null); setCaptchaAttempt((current) => current + 1); }}>
                  {mode === 'sign-up' ? 'Sign in' : 'Create one'}
                </button>
              </p>
            )}
          </section>
        </div>
      )}
    </>
  );
}

async function downloadPasskeyRecoveryCodes() {
  const response = await fetch('/api/account/passkeys/recovery-codes', { method: 'POST' });
  if (!response.ok) throw new Error('Recovery code download failed.');

  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = 'force-against-passkey-recovery-codes.txt';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
