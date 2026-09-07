'use client';

import { cn, s } from '@/app/tailwind-styles';
import Image from 'next/image';
import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';
import { AuthControl } from '@/app/auth-control';
import { SiteFooter } from '@/app/site-footer';
import { SiteHeader } from '@/app/site-header';
import { authClient } from '@/lib/auth-client';
import { PasskeySettings } from './passkey-settings';

type OrganizationSummary = { id: number; name: string; isOwner: boolean };
type AccountContext = { error?: unknown; organizations?: OrganizationSummary[] };

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
  const [blockedUsers, setBlockedUsers] = useState<Array<{ id: string; name: string; username: string; image: string | null }>>([]);
  const [blockedUsersForUserId, setBlockedUsersForUserId] = useState<string | null>(null);
  const [blockedUsersError, setBlockedUsersError] = useState<{ userId: string; message: string } | null>(null);
  const [unblockingUserId, setUnblockingUserId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationSummary[]>([]);
  const [organizationsForUserId, setOrganizationsForUserId] = useState<string | null>(null);
  const [organizationsError, setOrganizationsError] = useState<{ userId: string; message: string } | null>(null);
  const blockedUsersLoading = Boolean(session?.user.id && blockedUsersForUserId !== session.user.id && blockedUsersError?.userId !== session.user.id);
  const currentBlockedUsersError = blockedUsersError && blockedUsersError.userId === session?.user.id ? blockedUsersError.message : '';
  const organizationsLoading = Boolean(session?.user.id && organizationsForUserId !== session.user.id && organizationsError?.userId !== session.user.id);
  const currentOrganizationsError = organizationsError && organizationsError.userId === session?.user.id ? organizationsError.message : '';

  useEffect(() => {
    if (!session?.user.id) return;

    let active = true;
    const userId = session.user.id;
    fetch('/api/account/blocked-users', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as {
          error?: unknown;
          blockedUsers?: Array<{ id: string; name: string; username: string; image: string | null }>;
        };
        if (!response.ok) throw new Error(String(data.error ?? 'We could not load your blocked accounts.'));
        return data.blockedUsers ?? [];
      })
      .then((users) => {
        if (active) {
          setBlockedUsers(users);
          setBlockedUsersForUserId(userId);
          setBlockedUsersError(null);
        }
      })
      .catch((problem) => {
        if (active) setBlockedUsersError({ userId, message: problem instanceof Error ? problem.message : 'We could not load your blocked accounts.' });
      });

    return () => { active = false; };
  }, [session?.user.id]);

  useEffect(() => {
    if (!session?.user.id) return;

    let active = true;
    const userId = session.user.id;
    fetch('/api/account/context', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as AccountContext;
        if (!response.ok) throw new Error(String(data.error ?? 'We could not load your organizations.'));
        return data.organizations ?? [];
      })
      .then((nextOrganizations) => {
        if (active) {
          setOrganizations(nextOrganizations);
          setOrganizationsForUserId(userId);
          setOrganizationsError(null);
        }
      })
      .catch((problem) => {
        if (active) setOrganizationsError({ userId, message: problem instanceof Error ? problem.message : 'We could not load your organizations.' });
      });

    return () => { active = false; };
  }, [session?.user.id]);

  async function unblockUser(userId: string) {
    setUnblockingUserId(userId);
    setBlockedUsersError(null);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(userId)}/block`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({})) as { error?: unknown };
      if (!response.ok) throw new Error(String(data.error ?? 'We could not unblock that account.'));
      setBlockedUsers((current) => current.filter((blockedUser) => blockedUser.id !== userId));
    } catch (problem) {
      setBlockedUsersError({ userId: session!.user.id, message: problem instanceof Error ? problem.message : 'We could not unblock that account.' });
    } finally {
      setUnblockingUserId(null);
    }
  }

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
    <main>
      <SiteHeader />
      <section className={s.settingsShell}>
        <div className={s.settingsHeading}>
          <p className={s.eyebrow}><span /> ACCOUNT</p>
          <h1 className={s.settingsTitle}>Your<br /><em>profile.</em></h1>
          <p className={s.settingsHeadingCopy}>Keep your member details, password, and passkey up to date.</p>
          {session && (
            <section className={s.accountOrganizationsPanel} aria-labelledby="account-organizations-title">
              <p className={cn(s.step, s.accountOrganizationsEyebrow)}>ORGANIZATIONS</p>
              <h2 id="account-organizations-title">Your orgs.</h2>
              {organizationsLoading && <p className={s.accountOrganizationsIntro}>Loading organizations...</p>}
              {currentOrganizationsError && <p className={s.organizationModeratorError} role="alert">{currentOrganizationsError}</p>}
              {!organizationsLoading && organizationsForUserId === session.user.id && organizations.length === 0 && (
                <p className={s.accountOrganizationsIntro}>You do not own or moderate any organizations yet.</p>
              )}
              {!organizationsLoading && organizationsForUserId === session.user.id && organizations.length > 0 && (
                <ul className={s.accountOrganizationsList}>
                  {organizations.map((organization) => (
                    <li key={organization.id}>
                      <Link href={`/organization?organizationId=${organization.id}`}>
                        <strong>{organization.name}</strong>
                        <small>{organization.isOwner ? 'Creator' : 'Moderator'}</small>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          {session && (
            <section className={s.accountBlockedPanel} aria-labelledby="blocked-accounts-title">
              <p className={cn(s.step, s.accountOrganizationsEyebrow)}>COMMENTS</p>
              <h2 id="blocked-accounts-title">Blocked accounts.</h2>
              <p className={s.accountSidebarIntro}>Comments from blocked accounts are hidden for you.</p>
              {blockedUsersLoading && <p className={s.accountSidebarIntro}>Loading blocked accounts...</p>}
              {currentBlockedUsersError && <p className={s.organizationModeratorError} role="alert">{currentBlockedUsersError}</p>}
              {!blockedUsersLoading && blockedUsersForUserId === session.user.id && blockedUsers.length === 0 && <p className={s.accountSidebarIntro}>You have not blocked anyone.</p>}
              {!blockedUsersLoading && blockedUsersForUserId === session.user.id && blockedUsers.length > 0 && (
                <ul className={s.accountBlockedList}>
                  {blockedUsers.map((blockedUser) => (
                    <li key={blockedUser.id}>
                      <span className={s.accountBlockedAvatar} aria-hidden="true">
                        <span>{blockedUser.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
                        {blockedUser.image && <Image src={blockedUser.image} alt="" fill sizes="38px" unoptimized />}
                      </span>
                      <span className={s.accountBlockedIdentity}><strong>{blockedUser.name}</strong><small>@{blockedUser.username}</small></span>
                      <button type="button" disabled={unblockingUserId === blockedUser.id} onClick={() => void unblockUser(blockedUser.id)}>{unblockingUserId === blockedUser.id ? 'UNBLOCKING...' : 'UNBLOCK'}</button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <Link className={s.settingsHeadingLink} href="/">← Back to the directory</Link>
        </div>
        <div className={s.settingsPanel}>
          {isPending && <p className={s.settingsMessage}>Checking your account…</p>}
          {!isPending && !session && <div className={s.settingsMessage}><h2>Sign in first.</h2><p>You need an account to manage these settings.</p><AuthControl /></div>}
          {session && (
            <div className={s.settingsStack}>
              <section className={s.settingsForm} aria-labelledby="avatar-settings-title">
                <div><p className={cn(s.step, s.settingsStep)}>AVATAR</p><h2 id="avatar-settings-title">Your picture</h2></div>
                <div className={s.avatarSettingsRow}>
                  <span className={s.accountAvatarPreview} aria-hidden="true">
                    <span>{session.user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
                    {(() => {
                      const pendingImage = pendingAvatar?.userId === session.user.id ? pendingAvatar.image : null;
                      const storedImage = savedAvatar?.userId === session.user.id ? savedAvatar.image : session.user.image;
                      const image = pendingImage ?? storedImage;
                      return image ? <Image src={image} alt="" fill sizes="100px" unoptimized /> : null;
                    })()}
                  </span>
                  <div>
                    <label className={s.avatarFileLabel}>Choose a new avatar<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void prepareAvatar(file); }} /></label>
                    <small>JPG, PNG, or WebP up to 5 MB. Images are cropped square.</small>
                  </div>
                </div>
                {avatarError && <p className={s.formError} role="alert">{avatarError}</p>}
                {avatarStatus && <p className={s.formSuccess} role="status">{avatarStatus}</p>}
                <div className={s.avatarSettingsActions}>
                  <button className={s.settingsSubmit} type="button" disabled={savingAvatar || pendingAvatar?.userId !== session.user.id} onClick={() => { if (pendingAvatar?.userId === session.user.id) void saveAvatar(pendingAvatar.image); }}>{savingAvatar ? 'SAVING…' : 'SAVE AVATAR'} <span>→</span></button>
                  {(pendingAvatar?.userId === session.user.id || (savedAvatar?.userId === session.user.id ? savedAvatar.image : session.user.image)) && <button className={s.avatarRemove} type="button" disabled={savingAvatar} onClick={() => void saveAvatar(null)}>Remove avatar</button>}
                </div>
              </section>
              <form className={s.settingsForm} onSubmit={updateName}>
                <div><p className={cn(s.step, s.settingsStep)}>PROFILE</p><h2>Account details</h2></div>
                <label>Email<input type="email" value={session.user.email} readOnly /></label>
                <label>Username<input type="text" value={`@${session.user.username}`} readOnly /><small>Usernames are permanent.</small></label>
                <label>Name<input name="name" type="text" defaultValue={session.user.name} minLength={2} maxLength={100} autoComplete="name" required /></label>
                {nameError && <p className={s.formError} role="alert">{nameError}</p>}
                {nameStatus && <p className={s.formSuccess} role="status">{nameStatus}</p>}
                <button className={s.settingsSubmit} type="submit" disabled={savingName}>{savingName ? 'SAVING…' : 'SAVE NAME'} <span>→</span></button>
              </form>
              <form className={s.settingsForm} onSubmit={updatePassword}>
                <div><p className={cn(s.step, s.settingsStep)}>SECURITY</p><h2>Change password</h2></div>
                <label>Current password<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
                <label>New password<input name="newPassword" type="password" minLength={8} autoComplete="new-password" required /></label>
                <label>Confirm new password<input name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required /></label>
                {passwordError && <p className={s.formError} role="alert">{passwordError}</p>}
                {passwordStatus && <p className={s.formSuccess} role="status">{passwordStatus}</p>}
                <button className={s.settingsSubmit} type="submit" disabled={savingPassword}>{savingPassword ? 'CHANGING…' : 'CHANGE PASSWORD'} <span>→</span></button>
              </form>
              <PasskeySettings />
            </div>
          )}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
