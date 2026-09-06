'use client';

import { type FormEvent, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { normalizeUsername, USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, usernameError } from '@/lib/username';

type AuthMode = 'sign-in' | 'sign-up';

export function AuthControl() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
    setOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const form = new FormData(event.currentTarget);
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    const name = String(form.get('name') ?? '').trim();
    const username = normalizeUsername(String(form.get('username') ?? ''));

    if (mode === 'sign-up') {
      const validationError = usernameError(username);
      if (validationError) {
        setSubmitting(false);
        setError(validationError);
        return;
      }
    }

    const result = mode === 'sign-up'
      ? await authClient.signUp.email({ email, password, name, username })
      : await authClient.signIn.email({ email, password, rememberMe: true });

    setSubmitting(false);

    if (result.error) {
      setError(result.error.message ?? 'We could not complete that request. Please try again.');
      return;
    }

    setOpen(false);
  }

  if (!ready || sessionPending) {
    return <span className="auth-loading" aria-label="Checking account status" />;
  }

  if (session) {
    return (
      <div className="account-control" ref={menuRef}>
        <button
          className="account-menu-trigger"
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
          title={session.user.email}
        >
          <span>{session.user.name}</span><b aria-hidden="true">⌄</b>
        </button>
        {menuOpen && (
          <div className="account-menu" role="menu">
            <Link className="account-menu-liked" href="/liked" role="menuitem" onClick={() => setMenuOpen(false)}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.8-7.7 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" /></svg>
              Liked
            </Link>
            <Link href="/account" role="menuitem" onClick={() => setMenuOpen(false)}>Account</Link>
            <Link href="/organization" role="menuitem" onClick={() => setMenuOpen(false)}>Organization</Link>
            {isAdmin && <Link href="/admin" role="menuitem" onClick={() => setMenuOpen(false)}>Review submissions</Link>}
            <button type="button" role="menuitem" onClick={() => authClient.signOut()}>Log out</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button className="auth-trigger" type="button" onClick={() => showAuth('sign-in')}>Sign in</button>
      {open && (
        <div className="auth-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <button className="auth-close" type="button" onClick={() => setOpen(false)} aria-label="Close account dialog">×</button>
            <p className="eyebrow"><span /> YOUR ACCOUNT</p>
            <h2 id={titleId}>{mode === 'sign-up' ? 'Join the force.' : 'Welcome back.'}</h2>
            <p className="auth-intro">
              {mode === 'sign-up'
                ? 'Create your account with an email and password.'
                : 'Sign in to your Force Against Something account.'}
            </p>
            <form onSubmit={handleSubmit}>
              {mode === 'sign-up' && (
                <>
                  <label>
                    Name
                    <input name="name" type="text" minLength={2} maxLength={100} autoComplete="name" required autoFocus />
                  </label>
                  <label>
                    Username
                    <input name="username" type="text" minLength={USERNAME_MIN_LENGTH} maxLength={USERNAME_MAX_LENGTH} pattern="[A-Za-z0-9_]+" autoComplete="username" aria-describedby="username-hint" required />
                    <small id="username-hint" className="auth-field-hint">Lowercase letters, numbers, and underscores. This cannot be changed later.</small>
                  </label>
                </>
              )}
              <label>
                Email
                <input name="email" type="email" autoComplete="email" required autoFocus={mode === 'sign-in'} />
              </label>
              <label>
                Password
                <input name="password" type="password" autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'} minLength={8} required />
              </label>
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button className="auth-submit" type="submit" disabled={submitting}>
                {submitting ? 'WORKING…' : mode === 'sign-up' ? 'CREATE ACCOUNT' : 'SIGN IN'}
                <span aria-hidden="true">→</span>
              </button>
            </form>
            <p className="auth-switch">
              {mode === 'sign-up' ? 'Already have an account?' : 'New here?'}{' '}
              <button type="button" onClick={() => { setMode(mode === 'sign-up' ? 'sign-in' : 'sign-up'); setError(''); }}>
                {mode === 'sign-up' ? 'Sign in' : 'Create one'}
              </button>
            </p>
          </section>
        </div>
      )}
    </>
  );
}
