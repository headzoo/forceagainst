'use client';

import { cn, s } from '@/app/tailwind-styles';
import Image from 'next/image';
import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';
import { AuthControl } from '@/app/auth-control';
import { SiteFooter } from '@/app/site-footer';
import { SiteHeader } from '@/app/site-header';
import { authClient } from '@/lib/auth-client';

type Organization = { id: number; name: string; avatar: string | null; website: string | null; description: string };
type OrganizationAction = { id: number; type: 'Petition' | 'Lawsuit' | 'Campaign'; title: string; detail: string; approved: boolean; published: boolean };
type OrganizationCommentBan = {
  scope: 'action' | 'organization';
  user: { id: string; name: string; username: string; image: string | null };
  action: { id: number; title: string } | null;
  bannedAt: string;
};

export function OrganizationSettings() {
  const { data: session, isPending } = authClient.useSession();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loadedForUser, setLoadedForUser] = useState('');
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [description, setDescription] = useState('');
  const [actions, setActions] = useState<OrganizationAction[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [commentBans, setCommentBans] = useState<OrganizationCommentBan[]>([]);
  const [commentBansForOrganizationId, setCommentBansForOrganizationId] = useState<number | null>(null);
  const [commentBansError, setCommentBansError] = useState('');
  const [removingBanKey, setRemovingBanKey] = useState('');
  const [pendingAvatar, setPendingAvatar] = useState<{ organizationId: number; image: string } | null>(null);
  const [avatarStatus, setAvatarStatus] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const [savingAvatar, setSavingAvatar] = useState(false);
  const organizationId = organization?.id ?? null;

  useEffect(() => {
    if (!session) return;
    let active = true;

    fetch('/api/account/context')
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as { error?: unknown; organization?: Organization | null; actions?: OrganizationAction[] };
        if (!response.ok) throw new Error(String(data.error ?? 'Could not load your organization.'));
        if (!active) return;
        const nextOrganization = data.organization ?? null;
        setOrganization(nextOrganization);
        setName(nextOrganization?.name ?? '');
        setWebsite(nextOrganization?.website ?? '');
        setDescription(nextOrganization?.description ?? '');
        setActions(data.actions ?? []);
        setPendingAvatar(null);
        setAvatarStatus('');
        setAvatarError('');
        setLoadedForUser(session.user.id);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load your organization.'); });

    return () => { active = false; };
  }, [session]);

  useEffect(() => {
    if (!session || !organizationId) return;
    let active = true;

    fetch('/api/organization/comment-bans', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as { error?: unknown; bans?: OrganizationCommentBan[] };
        if (!response.ok) throw new Error(String(data.error ?? 'Could not load comment bans.'));
        return data.bans ?? [];
      })
      .then((bans) => {
        if (!active) return;
        setCommentBans(bans);
        setCommentBansForOrganizationId(organizationId);
        setCommentBansError('');
      })
      .catch((reason) => {
        if (active) setCommentBansError(reason instanceof Error ? reason.message : 'Could not load comment bans.');
      });

    return () => { active = false; };
  }, [organizationId, session]);

  async function saveOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setStatus('');
    const response = await fetch('/api/orgs', {
      method: organization ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, website, description }),
    });
    const data = await response.json().catch(() => ({})) as { error?: unknown; organization?: Organization };
    setSaving(false);

    if (!response.ok || !data.organization) {
      setError(String(data.error ?? 'Could not save your organization.'));
      return;
    }

    setOrganization(data.organization);
    setName(data.organization.name);
    setWebsite(data.organization.website ?? '');
    setDescription(data.organization.description);
    setStatus(organization ? 'Your organization has been updated.' : 'Your organization has been created. You can now submit actions.');
  }

  async function removeCommentBan(ban: OrganizationCommentBan) {
    const key = `${ban.scope}:${ban.user.id}:${ban.action?.id ?? 'organization'}`;
    setRemovingBanKey(key);
    setCommentBansError('');
    try {
      const response = await fetch('/api/organization/comment-bans', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: ban.scope, userId: ban.user.id, actionId: ban.action?.id ?? null }),
      });
      const data = await response.json().catch(() => ({})) as { error?: unknown };
      if (!response.ok) throw new Error(String(data.error ?? 'Could not remove that ban.'));
      setCommentBans((current) => current.filter((item) => `${item.scope}:${item.user.id}:${item.action?.id ?? 'organization'}` !== key));
    } catch (reason) {
      setCommentBansError(reason instanceof Error ? reason.message : 'Could not remove that ban.');
    } finally {
      setRemovingBanKey('');
    }
  }

  async function prepareAvatar(file: File) {
    setAvatarError('');
    setAvatarStatus('');
    if (!organization) return;
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
      setPendingAvatar({ organizationId: organization.id, image: dataUrl });
    } catch (reason) {
      setAvatarError(reason instanceof Error ? reason.message : 'We could not prepare that image.');
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function saveAvatar(image: string | null) {
    if (!organization) return;
    setSavingAvatar(true);
    setAvatarError('');
    setAvatarStatus('');
    const response = await fetch('/api/organization/avatar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image }),
    });
    const data = await response.json().catch(() => ({})) as { error?: unknown; image?: string | null };
    setSavingAvatar(false);
    if (!response.ok) {
      setAvatarError(String(data.error ?? 'We could not update your organization avatar.'));
      return;
    }
    setOrganization((current) => current?.id === organization.id ? { ...current, avatar: data.image ?? null } : current);
    setPendingAvatar(null);
    setAvatarStatus(image ? 'Your organization avatar has been updated.' : 'Your organization avatar has been removed.');
  }

  const loadingOrganization = Boolean(session && loadedForUser !== session.user.id);
  const organizationAvatar = organization
    ? pendingAvatar?.organizationId === organization.id ? pendingAvatar.image : organization.avatar
    : null;

  return (
    <main>
      <SiteHeader />
      <section className={s.settingsShell}>
        <div className={s.settingsHeading}>
          <p className={s.eyebrow}><span /> ORGANIZATION</p>
          <h1 className={s.settingsTitle}>Your<br /><em>force.</em></h1>
          {organization && (
            <div className={s.organizationActionList}>
              <p className={cn(s.step, s.organizationActionListLabel)}>YOUR ACTIONS / {String(actions.length).padStart(2, '0')}</p>
              {actions.map((action, index) => (
                <Link className={s.organizationActionRow} href={`/organization/actions/${action.id}`} key={action.id}>
                  <span className={s.organizationActionNumber}>{String(index + 1).padStart(2, '0')}</span>
                  <span className={s.organizationActionCopy}>
                    <span className={s.organizationActionMeta}><b>{action.type}</b><i>{action.approved && action.published ? 'Published' : 'Awaiting approval'}</i></span>
                    <strong>{action.title}</strong>
                    <small>{action.detail}</small>
                  </span>
                  <span className={s.organizationActionArrow} aria-hidden="true">→</span>
                </Link>
              ))}
              {actions.length === 0 && <p className={s.organizationActionsEmpty}>No actions submitted yet.</p>}
            </div>
          )}
          <Link className={s.settingsHeadingLink} href="/">← Back to the directory</Link>
        </div>
        <div className={s.settingsPanel}>
          {(isPending || loadingOrganization) && <p className={s.settingsMessage}>Loading your organization…</p>}
          {!isPending && !session && <div className={s.settingsMessage}><h2>Sign in first.</h2><p>You need an account to manage an organization.</p><AuthControl /></div>}
          {session && !loadingOrganization && (
            <div className={s.settingsStack}>
              {organization && (
                <section className={s.settingsForm} aria-labelledby="organization-avatar-settings-title">
                  <div><p className={cn(s.step, s.settingsStep)}>AVATAR</p><h2 id="organization-avatar-settings-title">Organization picture</h2></div>
                  <div className={s.avatarSettingsRow}>
                    <span className={s.accountAvatarPreview} aria-hidden="true">
                      <span>{organization.name.trim().charAt(0).toUpperCase()}</span>
                      {organizationAvatar && <Image src={organizationAvatar} alt="" fill sizes="100px" unoptimized />}
                    </span>
                    <div>
                      <label className={s.avatarFileLabel}>Choose a new avatar<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void prepareAvatar(file); }} /></label>
                      <small>JPG, PNG, or WebP up to 5 MB. Images are cropped square.</small>
                    </div>
                  </div>
                  {avatarError && <p className={s.formError} role="alert">{avatarError}</p>}
                  {avatarStatus && <p className={s.formSuccess} role="status">{avatarStatus}</p>}
                  <div className={s.avatarSettingsActions}>
                    <button className={s.settingsSubmit} type="button" disabled={savingAvatar || pendingAvatar?.organizationId !== organization.id} onClick={() => { if (pendingAvatar?.organizationId === organization.id) void saveAvatar(pendingAvatar.image); }}>{savingAvatar ? 'SAVING…' : 'SAVE AVATAR'} <span>→</span></button>
                    {(pendingAvatar?.organizationId === organization.id || organization.avatar) && <button className={s.avatarRemove} type="button" disabled={savingAvatar} onClick={() => void saveAvatar(null)}>Remove avatar</button>}
                  </div>
                </section>
              )}
              <form className={cn(s.settingsForm, s.organizationForm)} onSubmit={saveOrganization}>
                <div><p className={cn(s.step, s.settingsStep)}>{organization ? 'ORGANIZATION DETAILS' : 'GET STARTED'}</p><h2>{organization ? 'Edit organization' : 'Create organization'}</h2></div>
                <p className={s.settingsIntro}>{organization ? 'Changes update the organization name shown on all of its actions.' : 'Create an organization before submitting your first action.'}</p>
                <label>Organization name<input name="name" type="text" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} autoComplete="organization" required autoFocus /></label>
                <label>Organization website <small>Optional</small><input name="website" type="url" value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://example.org" /></label>
                <label>Long description <small>Optional · Markdown supported</small><textarea name="description" value={description} onChange={(event) => setDescription(event.target.value)} rows={12} maxLength={20_000} placeholder={'Tell people about your organization, its mission, and its work.\n\n## What we do\n\nUse Markdown to add headings, links, and lists.'} /></label>
                {error && <p className={s.formError} role="alert">{error}</p>}
                {status && <p className={s.formSuccess} role="status">{status}</p>}
                <button className={s.settingsSubmit} type="submit" disabled={saving}>{saving ? 'SAVING…' : organization ? 'SAVE ORGANIZATION' : 'CREATE ORGANIZATION'} <span>→</span></button>
                {organization && <Link className={s.secondaryLink} href="/submit">Submit an action →</Link>}
              </form>
              {organization && (
                <section className={s.settingsForm} aria-labelledby="organization-comment-bans-title">
                  <div><p className={cn(s.step, s.settingsStep)}>COMMENT MODERATION</p><h2 id="organization-comment-bans-title">Banned users</h2></div>
                  <p className={s.settingsIntro}>Review bans from individual actions and organization-wide bans. Removing one ban does not remove any other bans for the same user.</p>
                  {commentBansError && <p className={s.formError} role="alert">{commentBansError}</p>}
                  {commentBansForOrganizationId !== organization.id && !commentBansError && <p className={s.settingsIntro}>Loading banned users…</p>}
                  {commentBansForOrganizationId === organization.id && commentBans.length === 0 && <p className={s.settingsIntro}>No users are banned from your organization’s action discussions.</p>}
                  {commentBansForOrganizationId === organization.id && commentBans.length > 0 && (
                    <ul className={s.settingsBlockList}>
                      {commentBans.map((ban) => {
                        const key = `${ban.scope}:${ban.user.id}:${ban.action?.id ?? 'organization'}`;
                        return (
                          <li key={key}>
                            <span className={s.settingsBlockAvatar} aria-hidden="true">
                              <span>{ban.user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?'}</span>
                              {ban.user.image && <Image src={ban.user.image} alt="" fill sizes="44px" unoptimized />}
                            </span>
                            <span className={s.settingsBlockIdentity}>
                              <strong>{ban.user.name}</strong>
                              <small>@{ban.user.username} · {ban.scope === 'organization' ? 'All organization actions' : `Action: ${ban.action?.title ?? 'Unknown action'}`}</small>
                            </span>
                            <button type="button" disabled={removingBanKey === key} onClick={() => void removeCommentBan(ban)}>{removingBanKey === key ? 'REMOVING…' : 'REMOVE BAN'}</button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              )}
            </div>
          )}
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
