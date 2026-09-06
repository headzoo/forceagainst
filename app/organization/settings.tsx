'use client';

import { cn, s } from '@/app/tailwind-styles';
import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';
import { AuthControl } from '@/app/auth-control';
import { SiteHeader } from '@/app/site-header';
import { authClient } from '@/lib/auth-client';

type Organization = { id: number; name: string; website: string | null; description: string };
type OrganizationAction = { id: number; type: 'Petition' | 'Lawsuit' | 'Campaign'; title: string; detail: string; approved: boolean; published: boolean };

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
        setLoadedForUser(session.user.id);
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Could not load your organization.'); });

    return () => { active = false; };
  }, [session]);

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

  const loadingOrganization = Boolean(session && loadedForUser !== session.user.id);

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
          )}
        </div>
      </section>
    </main>
  );
}
