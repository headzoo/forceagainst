'use client';

import Image from 'next/image';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { AuthControl } from '@/app/auth-control';
import { SiteHeader } from '@/app/site-header';
import { authClient } from '@/lib/auth-client';

export function AccountSettings() {
  const { data: session, isPending } = authClient.useSession();
  const [nameStatus, setNameStatus] = useState('');
  const [nameError, setNameError] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [savedAvatar, setSavedAvatar] = useState<{ userId: string; image: string | null } | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<{ userId: string; image: string } | null>(null);
  const [avatarStatus, setAvatarStatus] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [savingAvatar, setSavingAvatar] = useState(false);

  async function prepareAvatar(file: File) {
    setAvatarError('');
    setAvatarStatus('');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5_000_000) {
      setAvatarError('Choose a JPG, PNG, or WebP image smaller than 5 MB.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const source = new window.Image();
      source.src = objectUrl;
      await source.decode();
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Your browser could not prepare that image.');
      const side = Math.min(source.naturalWidth, source.naturalHeight);
      const sourceX = (source.naturalWidth - side) / 2;
      const sourceY = (source.naturalHeight - side) / 2;
      context.drawImage(source, sourceX, sourceY, side, side, 0, 0, 256, 256);
      const dataUrl = canvas.toDataURL('image/webp', 0.82);
      if (dataUrl.length > 180_000) throw new Error('That image is too detailed. Try a smaller crop or file.');
      if (session) setPendingAvatar({ userId: session.user.id, image: dataUrl });
    } catch (reason) {
      setAvatarError(reason instanceof Error ? reason.message : 'We could not prepare that image.');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function saveAvatar(image: string | null) {
    setSavingAvatar(true);
    setAvatarError('');
    setAvatarStatus('');
    const response = await fetch('/api/account/avatar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });
    const data = await response.json().catch(() => ({})) as { error?: unknown; image?: string | null };
    setSavingAvatar(false);
    if (!response.ok) {
      setAvatarError(String(data.error ?? 'We could not update your avatar.'));
      return;
    }
    setSavedAvatar({ userId: session!.user.id, image: data.image ?? null });
    setPendingAvatar(null);
    setAvatarStatus(image ? 'Your avatar has been updated.' : 'Your avatar has been removed.');
  }

  async function updateName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingName(true);
    setNameError('');
    setNameStatus('');
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') ?? '').trim();
    const result = await authClient.updateUser({ name });
    setSavingName(false);

    if (result.error) {
      setNameError(result.error.message ?? 'We could not update your name.');
      return;
    }
    setNameStatus('Your name has been updated.');
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordError('');
    setPasswordStatus('');
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get('currentPassword') ?? '');
    const newPassword = String(form.get('newPassword') ?? '');
    const confirmPassword = String(form.get('confirmPassword') ?? '');

    if (newPassword !== confirmPassword) {
      setSavingPassword(false);
      setPasswordError('New passwords do not match.');
      return;
    }

    const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true });
    setSavingPassword(false);
    if (result.error) {
      setPasswordError(result.error.message ?? 'We could not change your password.');
      return;
    }

    event.currentTarget.reset();
    setPasswordStatus('Your password has been changed. Other sessions were signed out.');
  }

  return (
    <main className="settings-page">
      <SiteHeader />
      <section className="settings-shell">
        <div className="settings-heading">
          <p className="eyebrow"><span /> ACCOUNT</p>
          <h1>Your<br /><em>profile.</em></h1>
          <p>Keep your member details and password up to date.</p>
          <Link href="/">← Back to the directory</Link>
        </div>
        <div className="settings-panel">
          {isPending && <p className="settings-message">Checking your account…</p>}
          {!isPending && !session && <div className="settings-message"><h2>Sign in first.</h2><p>You need an account to manage these settings.</p><AuthControl /></div>}
          {session && (
            <div className="settings-stack">
              <section className="settings-form avatar-settings" aria-labelledby="avatar-settings-title">
                <div><p className="step">AVATAR</p><h2 id="avatar-settings-title">Your picture</h2></div>
                <div className="avatar-settings-row">
                  <span className="account-avatar-preview" aria-hidden="true">
                    <span>{session.user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
                    {(() => {
                      const pendingImage = pendingAvatar?.userId === session.user.id ? pendingAvatar.image : null;
                      const storedImage = savedAvatar?.userId === session.user.id ? savedAvatar.image : session.user.image;
                      const image = pendingImage ?? storedImage;
                      return image ? <Image src={image} alt="" fill sizes="100px" unoptimized /> : null;
                    })()}
                  </span>
                  <div>
                    <label className="avatar-file-label">Choose a new avatar<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void prepareAvatar(file); }} /></label>
                    <small>JPG, PNG, or WebP up to 5 MB. Images are cropped square.</small>
                  </div>
                </div>
                {avatarError && <p className="form-error" role="alert">{avatarError}</p>}
                {avatarStatus && <p className="form-success" role="status">{avatarStatus}</p>}
                <div className="avatar-settings-actions">
                  <button className="settings-submit" type="button" disabled={savingAvatar || pendingAvatar?.userId !== session.user.id} onClick={() => { if (pendingAvatar?.userId === session.user.id) void saveAvatar(pendingAvatar.image); }}>{savingAvatar ? 'SAVING…' : 'SAVE AVATAR'} <span>→</span></button>
                  {(pendingAvatar?.userId === session.user.id || (savedAvatar?.userId === session.user.id ? savedAvatar.image : session.user.image)) && <button className="avatar-remove" type="button" disabled={savingAvatar} onClick={() => void saveAvatar(null)}>Remove avatar</button>}
                </div>
              </section>
              <form className="settings-form" onSubmit={updateName}>
                <div><p className="step">PROFILE</p><h2>Account details</h2></div>
                <label>Email<input type="email" value={session.user.email} readOnly /></label>
                <label>Username<input type="text" value={`@${session.user.username}`} readOnly /><small>Usernames are permanent.</small></label>
                <label>Name<input name="name" type="text" defaultValue={session.user.name} minLength={2} maxLength={100} autoComplete="name" required /></label>
                {nameError && <p className="form-error" role="alert">{nameError}</p>}
                {nameStatus && <p className="form-success" role="status">{nameStatus}</p>}
                <button className="settings-submit" type="submit" disabled={savingName}>{savingName ? 'SAVING…' : 'SAVE NAME'} <span>→</span></button>
              </form>
              <form className="settings-form" onSubmit={updatePassword}>
                <div><p className="step">SECURITY</p><h2>Change password</h2></div>
                <label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
                <label>New password<input name="newPassword" type="password" minLength={8} autoComplete="new-password" required /></label>
                <label>Confirm new password<input name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required /></label>
                {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
                {passwordStatus && <p className="form-success" role="status">{passwordStatus}</p>}
                <button className="settings-submit" type="submit" disabled={savingPassword}>{savingPassword ? 'CHANGING…' : 'CHANGE PASSWORD'} <span>→</span></button>
              </form>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
