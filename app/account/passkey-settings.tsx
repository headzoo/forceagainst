'use client';

import { cn, s } from '@/app/tailwind-styles';
import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';

type PasskeySummary = {
  id: string;
  name?: string | null;
  createdAt?: Date | string | null;
};

type PasskeyAction = 'enable' | 'disable' | 'recovery-codes' | null;

function supportsPasskeys() {
  return typeof window !== 'undefined' && 'PublicKeyCredential' in window;
}

async function downloadRecoveryCodes() {
  const response = await fetch('/api/account/passkeys/recovery-codes', { method: 'POST' });
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: unknown };
    throw new Error(String(data.error ?? 'We could not create recovery codes.'));
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'force-against-something-passkey-recovery-codes.txt';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function PasskeySettings() {
  const [passkeys, setPasskeys] = useState<PasskeySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<PasskeyAction>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const enabled = passkeys.length > 0;

  useEffect(() => {
    let active = true;
    authClient.passkey.listUserPasskeys()
      .then((result) => {
        if (!active) return;
        if (result.error) throw new Error(result.error.message ?? 'We could not check your passkeys.');
        setPasskeys(result.data ?? []);
      })
      .catch((problem) => {
        if (active) setError(problem instanceof Error ? problem.message : 'We could not check your passkeys.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  async function enablePasskey() {
    setAction('enable');
    setError('');
    setStatus('');

    if (!supportsPasskeys()) {
      setAction(null);
      setError('This browser does not support passkeys. Try a current version of Safari, Chrome, Edge, or Firefox.');
      return;
    }

    try {
      const result = await authClient.passkey.addPasskey({ name: 'Primary passkey' });
      if (result.error || !result.data) {
        setError(result.error?.message ?? 'Passkey setup was canceled or could not be completed.');
        return;
      }

      setPasskeys([result.data]);
      try {
        await downloadRecoveryCodes();
        setStatus('Your passkey is enabled. Five one-time recovery codes were downloaded.');
      } catch (problem) {
        setError(`${problem instanceof Error ? problem.message : 'Recovery codes could not be downloaded.'} Your passkey is enabled; use the button below to try the download again.`);
      }
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Passkey setup was canceled or could not be completed.');
    } finally {
      setAction(null);
    }
  }

  async function disablePasskey() {
    if (!window.confirm('Disable passkey sign-in and invalidate every passkey recovery code?')) return;

    setAction('disable');
    setError('');
    setStatus('');
    try {
      const response = await fetch('/api/account/passkeys', { method: 'DELETE' });
      const data = await response.json().catch(() => ({})) as { error?: unknown };
      if (!response.ok) {
        setError(String(data.error ?? 'We could not disable passkeys.'));
        return;
      }

      setPasskeys([]);
      setStatus('Passkey sign-in has been disabled.');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'We could not disable passkeys.');
    } finally {
      setAction(null);
    }
  }

  async function createRecoveryCodes() {
    setAction('recovery-codes');
    setError('');
    setStatus('');
    try {
      await downloadRecoveryCodes();
      setStatus('Five new recovery codes were downloaded. Every older recovery code is now invalid.');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'We could not create recovery codes.');
    } finally {
      setAction(null);
    }
  }

  return (
    <section className={s.settingsForm} aria-labelledby="passkey-settings-title">
      <div>
        <p className={cn(s.step, s.settingsStep)}>SECURITY</p>
        <h2 id="passkey-settings-title">Passkey sign-in</h2>
      </div>
      <p className={s.settingsIntro}>
        Sign in without entering your email or password. We request the least intrusive verification,
        but your browser, password manager, or device may still require its own biometric, unlock, PIN,
        or security-key gesture.
      </p>
      {!loading && (
        <p className={cn(s.passkeyState, enabled ? s.passkeyStateEnabled : s.passkeyStateDisabled)}>
          {enabled ? 'PASSKEY ENABLED' : 'PASSKEY DISABLED'}
        </p>
      )}
      {loading && <p className={s.settingsIntro}>Checking your passkey…</p>}
      {error && <p className={s.formError} role="alert">{error}</p>}
      {status && <p className={s.formSuccess} role="status">{status}</p>}
      <div className={s.passkeyActions}>
        <button
          className={s.settingsSubmit}
          type="button"
          disabled={loading || action !== null}
          onClick={() => void (enabled ? disablePasskey() : enablePasskey())}
        >
          {action === 'enable' && 'ENABLING…'}
          {action === 'disable' && 'DISABLING…'}
          {action !== 'enable' && action !== 'disable' && (enabled ? 'DISABLE PASSKEY' : 'ENABLE PASSKEY')}
          <span aria-hidden="true">→</span>
        </button>
        {enabled && (
          <button
            className={s.settingsSecondaryButton}
            type="button"
            disabled={action !== null}
            onClick={() => void createRecoveryCodes()}
          >
            {action === 'recovery-codes' ? 'CREATING…' : 'DOWNLOAD NEW RECOVERY CODES'}
          </button>
        )}
      </div>
      {enabled && (
        <p className={s.passkeyRecoveryNote}>
          Recovery codes are shown only in the downloaded file. Each works once. Creating a new set
          immediately invalidates the old set.
        </p>
      )}
    </section>
  );
}
