'use client';

import { cn, s } from '@/app/tailwind-styles';
import Link from 'next/link';
import { type FormEvent, useEffect, useState } from 'react';
import { AuthControl } from '@/app/auth-control';
import { SiteHeader } from '@/app/site-header';
import { authClient } from '@/lib/auth-client';

type IssueOption = { id: number; name: string; slug: string };
type EditableAction = {
  id: number;
  issueId: number;
  type: 'Petition' | 'Lawsuit' | 'Campaign';
  title: string;
  detail: string;
  description: string;
  href: string;
  effort: string;
  approved: boolean;
  published: boolean;
};

export function ActionEditor({ actionId, issues }: { actionId: number; issues: IssueOption[] }) {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [action, setAction] = useState<EditableAction | null>(null);
  const [issueId, setIssueId] = useState(issues[0]?.id ?? 0);
  const [type, setType] = useState<EditableAction['type']>('Petition');
  const [title, setTitle] = useState('');
  const [detail, setDetail] = useState('');
  const [description, setDescription] = useState('');
  const [href, setHref] = useState('');
  const [loadedActionKey, setLoadedActionKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!session) return;

    let active = true;
    const actionKey = `${session.user.id}:${actionId}`;
    fetch(`/api/actions/${actionId}`)
      .then(async (response) => {
        const data = await response.json().catch(() => ({})) as { error?: unknown; action?: EditableAction };
        if (!response.ok || !data.action) throw new Error(String(data.error ?? 'Could not load that action.'));
        if (!active) return;
        setAction(data.action);
        setIssueId(data.action.issueId);
        setType(data.action.type);
        setTitle(data.action.title);
        setDetail(data.action.detail);
        setDescription(data.action.description);
        setHref(data.action.href);
        setLoadedActionKey(actionKey);
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'Could not load that action.');
        setLoadedActionKey(actionKey);
      });

    return () => { active = false; };
  }, [actionId, session, sessionPending]);

  const loading = Boolean(session && loadedActionKey !== `${session.user.id}:${actionId}`);
  const urlChanged = Boolean(action && href.trim() !== action.href);

  async function saveAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setStatus('');

    const response = await fetch(`/api/actions/${actionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ issueId, type, title, detail, description, href }),
    });
    const data = await response.json().catch(() => ({})) as { error?: unknown; action?: Partial<EditableAction>; needsReapproval?: boolean };
    setSaving(false);

    if (!response.ok || !data.action) {
      setError(String(data.error ?? 'Could not save that action.'));
      return;
    }

    setAction((current) => current ? { ...current, ...data.action } : current);
    setHref(data.action.href ?? href);
    setStatus(data.needsReapproval
      ? 'Changes saved. The new URL sent this action back for admin approval.'
      : 'Your action has been updated.');
  }

  return (
    <main>
      <SiteHeader />

      <section className={s.submissionShell}>
        <div className={s.submissionHeading}>
          <p className={s.eyebrow}><span /> EDIT ACTION</p>
          <h1 className={s.submissionTitle}>Shape the<br /><em>action.</em></h1>
          <p className={s.submissionHeadingCopy}>{action?.approved && action.published ? 'This action is currently published.' : 'This action is awaiting admin approval.'}</p>
          <Link className={s.submissionHeadingLink} href="/organization">← Back to your organization</Link>
        </div>

        <div className={s.submissionPanel}>
          {(sessionPending || loading) && <div className={s.submissionStatus}><p className={s.submissionStatusCopy}>Loading action…</p></div>}
          {!sessionPending && !session && <div className={s.submissionStatus}><p className={cn(s.step, s.submissionStep)}>ACCOUNT REQUIRED</p><h2>Sign in first.</h2><p className={s.submissionStatusCopy}>You need to sign in as this organization’s owner to edit its actions.</p><AuthControl /></div>}
          {!loading && session && error && !action && <div className={s.submissionStatus}><p className={cn(s.step, s.submissionStep)}>ACTION UNAVAILABLE</p><h2>Couldn’t open it.</h2><p className={s.submissionStatusCopy}>{error}</p><Link className={s.formSubmit} href="/organization">BACK TO ORGANIZATION <span>→</span></Link></div>}
          {session && action && (
            <form className={s.submissionForm} onSubmit={saveAction}>
              <p className={cn(s.step, s.submissionStep)}>ACTION DETAILS</p>
              <h2>Edit action.</h2>
              <p className={s.formIntro}>Update the public details below. The action URL has an additional review requirement.</p>
              <label>Action URL<input name="href" type="url" value={href} onChange={(event) => setHref(event.target.value)} required /></label>
              {urlChanged && <p className={s.reapprovalWarning} role="alert"><strong>Changing the URL requires reapproval.</strong> Saving will remove this action from the public directory until an admin approves the new destination.</p>}
              <div className={s.formGrid}>
                <label>Type<select name="type" value={type} onChange={(event) => setType(event.target.value as EditableAction['type'])} required><option>Petition</option><option>Lawsuit</option><option>Campaign</option></select></label>
                <label>Issue<select name="issueId" value={issueId} onChange={(event) => setIssueId(Number(event.target.value))} required>{issues.map((issue) => <option key={issue.id} value={issue.id}>{issue.name}</option>)}</select></label>
              </div>
              <label>Title<input name="title" type="text" value={title} onChange={(event) => setTitle(event.target.value)} minLength={6} maxLength={180} required /></label>
              <label>Summary<textarea name="detail" value={detail} onChange={(event) => setDetail(event.target.value)} minLength={20} maxLength={600} rows={4} required /><small>Shown on the homepage action card.</small></label>
              <label>Full description (Markdown)<textarea name="description" value={description} onChange={(event) => setDescription(event.target.value)} minLength={20} maxLength={1_000_000} rows={14} required /><small>Shown on the action detail page. Markdown headings, lists, links, and tables are supported.</small></label>
              <label>Effort<input value={action.effort} readOnly /><small>Recalculated automatically if the action URL changes.</small></label>
              {error && <p className={s.formError} role="alert">{error}</p>}
              {status && <p className={s.formSuccess} role="status">{status}</p>}
              <button className={s.formSubmit} type="submit" disabled={saving}>{saving ? 'SAVING…' : urlChanged ? 'SAVE & REQUEST REAPPROVAL' : 'SAVE ACTION'} <span>→</span></button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
