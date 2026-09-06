'use client';

import { cn, s } from '@/app/tailwind-styles';
import Image from 'next/image';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { AuthControl } from '@/app/auth-control';
import {
  MAX_COMMENT_DEPTH,
  MAX_COMMENT_LENGTH,
  nestActionComments,
  type ActionCommentNode,
  type ActionCommentView,
} from '@/lib/action-comments';
import { authClient } from '@/lib/auth-client';
import type { CommentBanScopes } from '@/lib/comment-moderation';

type CommentModeration = {
  canBanOrganization: boolean;
  organizationName: string;
  bannedUsers: CommentBanScopes;
};

type BanTarget = {
  id: string;
  name: string;
  username: string;
};

function formatCommentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(date);
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?';
}

function CommentAvatar({ name, image }: { name: string; image: string | null }) {
  return (
    <span className={s.commentAvatar} aria-hidden="true">
      <span>{initials(name)}</span>
      {image && <Image src={image} alt="" fill sizes="48px" unoptimized referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true; }} />}
    </span>
  );
}

function CommentComposer({ parentId, autoFocus = false, submissionBlockedReason = null, onCancel, onCreate }: {
  parentId: number | null;
  autoFocus?: boolean;
  submissionBlockedReason?: string | null;
  onCancel?: () => void;
  onCreate: (body: string, parentId: number | null) => Promise<void>;
}) {
  const [body, setBody] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<null | { message: string; blockedBy: string | null }>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;
    if (submissionBlockedReason) {
      setError({ message: submissionBlockedReason, blockedBy: submissionBlockedReason });
      return;
    }
    setWorking(true);
    setError(null);

    try {
      await onCreate(body, parentId);
      setBody('');
      onCancel?.();
    } catch (reason) {
      setError({
        message: reason instanceof Error ? reason.message : 'We could not post your comment.',
        blockedBy: null,
      });
    } finally {
      setWorking(false);
    }
  }

  return (
    <form className={cn(s.commentComposer, parentId !== null && s.commentReplyComposer)} onSubmit={submit}>
      <label htmlFor={`comment-body-${parentId ?? 'root'}`}>{parentId === null ? 'Add to the conversation' : 'Write a reply'}</label>
      <textarea
        id={`comment-body-${parentId ?? 'root'}`}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={MAX_COMMENT_LENGTH}
        rows={parentId === null ? 5 : 3}
        placeholder={parentId === null ? 'Share context, progress, or a useful next step…' : 'Reply to this comment…'}
        autoFocus={autoFocus}
        required
      />
      <div className={s.commentComposerFoot}>
        <small>{body.length.toLocaleString()} / {MAX_COMMENT_LENGTH.toLocaleString()}</small>
        <span>
          {onCancel && <button className={s.commentCancel} type="button" onClick={onCancel}>Cancel</button>}
          <button className={s.commentSubmit} type="submit" disabled={working || !body.trim()}>{working ? 'POSTING…' : parentId === null ? 'POST COMMENT' : 'POST REPLY'}</button>
        </span>
      </div>
      {error && (error.blockedBy === null || error.blockedBy === submissionBlockedReason) && (
        <p className={s.commentError} role="alert">{error.message}</p>
      )}
    </form>
  );
}

function VerifyEmailNotice({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function resend() {
    setSending(true);
    setMessage('');
    setError('');

    try {
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: `${window.location.pathname}${window.location.search}`,
      });

      if (result.error) {
        setError(result.error.message ?? 'We could not send another verification email.');
        return;
      }
      setMessage('Verification email sent.');
    } catch {
      setError('We could not send another verification email.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={s.commentsSignIn}>
      <strong>Verify your email.</strong>
      <p>We sent a verification link to {email}. Verify it before posting or replying.</p>
      <button className={s.commentsVerifyButton} type="button" disabled={sending} onClick={() => void resend()}>
        {sending ? 'SENDING…' : 'RESEND VERIFICATION EMAIL'}
      </button>
      {message && <p className={s.commentsVerifySuccess} role="status">{message}</p>}
      {error && <p className={s.commentError} role="alert">{error}</p>}
    </div>
  );
}

function CommentRestrictionNotice({ message }: { message: string }) {
  return (
    <div className={s.commentsSignIn}>
      <strong>Commenting unavailable.</strong>
      <p>{message}</p>
    </div>
  );
}

function CommentReportForm({ commentId, onCancel, onReport }: {
  commentId: number;
  onCancel: () => void;
  onReport: (commentId: number, reason: string, details: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('spam');
  const [details, setDetails] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError('');
    try {
      await onReport(commentId, reason, details);
      onCancel();
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'We could not submit this report.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <form className={s.commentReportForm} onSubmit={submit}>
      <label htmlFor={`comment-report-reason-${commentId}`}>Why are you reporting this?</label>
      <select id={`comment-report-reason-${commentId}`} value={reason} onChange={(event) => setReason(event.target.value)}>
        <option value="spam">Spam or scam</option>
        <option value="harassment">Harassment</option>
        <option value="hate">Hate or abuse</option>
        <option value="misinformation">Dangerous misinformation</option>
        <option value="other">Something else</option>
      </select>
      <label htmlFor={`comment-report-details-${commentId}`}>Details <small>Optional</small></label>
      <textarea id={`comment-report-details-${commentId}`} value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1_000} rows={3} placeholder="Help the moderation team understand the problem." />
      <div>
        <button type="submit" disabled={working}>{working ? 'SENDING…' : 'SEND REPORT'}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
      {error && <p className={s.commentError} role="alert">{error}</p>}
    </form>
  );
}

function CommentBanDialog({ target, organizationName, canBanOrganization, working, error, onClose, onBan }: {
  target: BanTarget;
  organizationName: string;
  canBanOrganization: boolean;
  working: boolean;
  error: string;
  onClose: () => void;
  onBan: (banFromAction: boolean, banFromOrganization: boolean) => Promise<void>;
}) {
  const [banFromAction, setBanFromAction] = useState(true);
  const [banFromOrganization, setBanFromOrganization] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !working) onClose();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose, working]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!banFromAction && !banFromOrganization) return;
    await onBan(banFromAction, banFromOrganization);
  }

  return (
    <div className={s.commentModerationOverlay} onMouseDown={(event) => { if (event.target === event.currentTarget && !working) onClose(); }}>
      <section className={s.commentModerationDialog} role="dialog" aria-modal="true" aria-labelledby="comment-ban-title">
        <button className={s.commentModerationClose} type="button" aria-label="Close ban dialog" disabled={working} onClick={onClose}>×</button>
        <p className={cn(s.eyebrow, s.commentModerationEyebrow)}><span /> MODERATE USER</p>
        <h2 id="comment-ban-title">Ban @{target.username}?</h2>
        <p>Choose where {target.name} should no longer be able to post or reply.</p>
        <form onSubmit={(event) => void submit(event)}>
          <label className={s.commentModerationOption}>
            <input type="checkbox" checked={banFromAction} autoFocus onChange={(event) => setBanFromAction(event.target.checked)} />
            <span><strong>Ban from this action</strong><small>Stops participation in this discussion only.</small></span>
          </label>
          <label className={s.commentModerationOption}>
            <input type="checkbox" checked={banFromOrganization} disabled={!canBanOrganization} onChange={(event) => setBanFromOrganization(event.target.checked)} />
            <span><strong>Ban from the whole organization</strong><small>{canBanOrganization ? `Stops participation in every ${organizationName} action discussion.` : 'Only the organization owner can apply this ban.'}</small></span>
          </label>
          {error && <p className={s.commentError} role="alert">{error}</p>}
          <div className={s.commentModerationButtons}>
            <button type="button" disabled={working} onClick={onClose}>Cancel</button>
            <button type="submit" disabled={working || (!banFromAction && !banFromOrganization)}>{working ? 'BANNING…' : 'BAN USER'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function CommentItem({ node, viewerId, canComment, canReport, canModerate, bannedScopes, deletingId, blockingUserId, onCreate, onDelete, onBlock, onUnblock, onOpenBan, onReport }: {
  node: ActionCommentNode;
  viewerId: string | null;
  canComment: boolean;
  canReport: boolean;
  canModerate: boolean;
  bannedScopes: CommentBanScopes;
  deletingId: number | null;
  blockingUserId: string | null;
  onCreate: (body: string, parentId: number | null) => Promise<void>;
  onDelete: (comment: ActionCommentView) => Promise<void>;
  onBlock: (userId: string, username: string) => Promise<void>;
  onUnblock: (userId: string) => Promise<void>;
  onOpenBan: (target: BanTarget) => void;
  onReport: (commentId: number, reason: string, details: string) => Promise<void>;
}) {
  const [replying, setReplying] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [showBlocked, setShowBlocked] = useState(false);
  const visible = node.visibility === 'visible';
  const blocked = node.visibility === 'blocked';
  const canReply = canComment && visible && node.depth < MAX_COMMENT_DEPTH;
  const canDelete = visible && Boolean(node.author?.id === viewerId || (canModerate && node.author));
  const otherAuthor = node.author && node.author.id !== viewerId ? node.author : null;
  const authorBanScopes = otherAuthor ? bannedScopes[otherAuthor.id] : null;
  const canBan = Boolean(canModerate && otherAuthor && visible && !authorBanScopes?.action && !authorBanScopes?.organization);
  const canBlock = Boolean(viewerId && otherAuthor && visible);
  const canUnblock = Boolean(viewerId && otherAuthor && blocked);
  const canSubmitReport = Boolean(canReport && otherAuthor && visible && !node.reportedByViewer);
  const showActions = canReply || canDelete || canBan || Boolean(authorBanScopes) || canBlock || canUnblock || canSubmitReport || node.reportedByViewer || blocked;

  const placeholder = node.visibility === 'user_deleted'
    ? { label: 'Deleted comment', body: 'This comment has been deleted.' }
    : node.visibility === 'under_review'
      ? { label: 'Comment under review', body: 'This comment is temporarily unavailable while the moderation team reviews it.' }
      : node.visibility === 'removed'
        ? { label: 'Comment removed', body: 'This comment was removed by the moderation team.' }
        : null;

  return (
    <div className={s.commentThreadNode} id={`comment-${node.id}`} data-depth={node.depth}>
      <article className={s.commentCard}>
        {placeholder || !node.author ? (
          <span className={cn(s.commentAvatar, s.commentAvatarDeleted)} aria-hidden="true">×</span>
        ) : (
          <CommentAvatar name={node.author.name} image={node.author.image} />
        )}
        <div className={s.commentCopy}>
          <header>
            {placeholder || !node.author ? (
              <strong>{placeholder?.label ?? 'Former member'}</strong>
            ) : (
              <span className={s.commentAuthor}><strong>{node.author.name}</strong><small>@{node.author.username}</small></span>
            )}
            <time dateTime={node.createdAt}>{formatCommentDate(node.createdAt)}</time>
          </header>
          {placeholder ? (
            <p className={s.commentTombstone}>{placeholder.body}</p>
          ) : blocked && !showBlocked ? (
            <p className={s.commentTombstone}>This comment is hidden because you blocked @{node.author?.username}.</p>
          ) : (
            <p>{node.body}</p>
          )}
          {showActions && (
            <div className={s.commentActions}>
              {canReply && <button type="button" onClick={() => setReplying((current) => !current)}>{replying ? 'Cancel reply' : 'Reply'}</button>}
              {canDelete && <button className={s.commentDelete} type="button" disabled={deletingId === node.id} onClick={() => onDelete(node)}>{deletingId === node.id ? 'Deleting…' : 'Delete'}</button>}
              {canBan && otherAuthor && <button className={s.commentDelete} type="button" onClick={() => onOpenBan({ id: otherAuthor.id, name: otherAuthor.name, username: otherAuthor.username })}>Ban</button>}
              {authorBanScopes?.organization && <span className={s.commentReported}>Banned from organization</span>}
              {!authorBanScopes?.organization && authorBanScopes?.action && <span className={s.commentReported}>Banned from action</span>}
              {blocked && <button type="button" onClick={() => setShowBlocked((current) => !current)}>{showBlocked ? 'Hide' : 'Show'}</button>}
              {canBlock && otherAuthor && <button type="button" disabled={blockingUserId === otherAuthor.id} onClick={() => void onBlock(otherAuthor.id, otherAuthor.username)}>{blockingUserId === otherAuthor.id ? 'Blocking…' : 'Block'}</button>}
              {canUnblock && otherAuthor && <button type="button" disabled={blockingUserId === otherAuthor.id} onClick={() => void onUnblock(otherAuthor.id)}>{blockingUserId === otherAuthor.id ? 'Unblocking…' : 'Unblock'}</button>}
              {canSubmitReport && <button type="button" onClick={() => setReporting((current) => !current)}>{reporting ? 'Cancel report' : 'Report'}</button>}
              {node.reportedByViewer && <span className={s.commentReported}>Reported</span>}
            </div>
          )}
          {reporting && canSubmitReport && <CommentReportForm commentId={node.id} onCancel={() => setReporting(false)} onReport={onReport} />}
        </div>
      </article>
      {replying && canReply && <CommentComposer parentId={node.id} autoFocus onCancel={() => setReplying(false)} onCreate={onCreate} />}
      {node.children.length > 0 && (
        <div className={s.commentChildren}>
          {node.children.map((child) => <CommentItem key={child.id} node={child} viewerId={viewerId} canComment={canComment} canReport={canReport} canModerate={canModerate} bannedScopes={bannedScopes} deletingId={deletingId} blockingUserId={blockingUserId} onCreate={onCreate} onDelete={onDelete} onBlock={onBlock} onUnblock={onUnblock} onOpenBan={onOpenBan} onReport={onReport} />)}
        </div>
      )}
    </div>
  );
}

export function ActionComments({ actionId, initialComments, commentsLocked = false, slowModeSeconds = 0, moderation = null }: {
  actionId: number;
  initialComments: ActionCommentView[];
  commentsLocked?: boolean;
  slowModeSeconds?: number;
  moderation?: CommentModeration | null;
}) {
  const { data: session, isPending } = authClient.useSession();
  const [comments, setComments] = useState(initialComments);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [blockingUserId, setBlockingUserId] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<BanTarget | null>(null);
  const [banWorking, setBanWorking] = useState(false);
  const [banError, setBanError] = useState('');
  const [bannedScopes, setBannedScopes] = useState<CommentBanScopes>(moderation?.bannedUsers ?? {});
  const [commentAccess, setCommentAccess] = useState<null | {
    userId: string;
    allowed: boolean;
    message: string | null;
  }>(null);
  const threads = useMemo(() => nestActionComments(comments), [comments]);
  const visibleCount = comments.filter((comment) => comment.visibility === 'visible' || comment.visibility === 'blocked').length;
  const userId = session?.user.id ?? null;
  const emailVerified = Boolean(session?.user.emailVerified);
  const currentAccess = commentAccess?.userId === userId ? commentAccess : null;
  const accessLoading = Boolean(userId && emailVerified && !currentAccess);
  const canComment = Boolean(userId && emailVerified && currentAccess?.allowed && !commentsLocked);
  const canReport = Boolean(userId && emailVerified && currentAccess?.allowed);
  const submissionBlockedReason = isPending
    ? 'Your account is still being checked. Try again in a moment.'
    : accessLoading
      ? 'Your commenting access is still being checked. Try again in a moment.'
      : currentAccess && !currentAccess.allowed
        ? currentAccess.message ?? 'Your account cannot post comments.'
        : commentsLocked
          ? 'This discussion has been locked by the moderation team.'
          : null;

  useEffect(() => {
    if (!userId || !emailVerified) return;

    let active = true;
    fetch(`/api/account/comment-access?actionId=${actionId}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not check comment access.');
        return await response.json() as { allowed: boolean; message: string | null };
      })
      .then((access) => { if (active) setCommentAccess({ userId, ...access }); })
      .catch(() => {
        if (active) {
          setCommentAccess({
            userId,
            allowed: false,
            message: 'We could not verify your commenting access. Refresh the page and try again.',
          });
        }
      });

    return () => { active = false; };
  }, [actionId, emailVerified, userId]);

  async function createComment(body: string, parentId: number | null) {
    const response = await fetch(`/api/actions/${actionId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, parentId }),
    });
    const data = await response.json().catch(() => ({})) as { error?: unknown; comment?: ActionCommentView };
    if (!response.ok || !data.comment) throw new Error(String(data.error ?? 'We could not post your comment.'));
    setComments((current) => [...current, data.comment!]);
  }

  async function deleteComment(comment: ActionCommentView) {
    if (!confirm('Delete this comment? Replies will remain in the thread.')) return;
    setDeletingId(comment.id);
    try {
      const response = await fetch(`/api/comments/${comment.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({})) as { error?: unknown; visibility?: ActionCommentView['visibility'] };
      if (!response.ok) {
        alert(String(data.error ?? 'We could not delete that comment.'));
        return;
      }

      setComments((current) => current.map((item) => item.id === comment.id
        ? { ...item, body: null, visibility: data.visibility ?? 'user_deleted', author: null }
        : item));
    } catch {
      alert('We could not delete that comment. Check your connection and try again.');
    } finally {
      setDeletingId(null);
    }
  }

  async function blockUser(blockedUserId: string, username: string) {
    if (!confirm(`Block @${username}? Their comments will be hidden for you.`)) return;
    setBlockingUserId(blockedUserId);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(blockedUserId)}/block`, { method: 'POST' });
      const data = await response.json().catch(() => ({})) as { error?: unknown };
      if (!response.ok) throw new Error(String(data.error ?? 'We could not block that account.'));
      setComments((current) => current.map((comment) => comment.author?.id === blockedUserId && comment.visibility === 'visible'
        ? { ...comment, visibility: 'blocked' }
        : comment));
    } catch (problem) {
      alert(problem instanceof Error ? problem.message : 'We could not block that account.');
    } finally {
      setBlockingUserId(null);
    }
  }

  async function unblockUser(blockedUserId: string) {
    setBlockingUserId(blockedUserId);
    try {
      const response = await fetch(`/api/users/${encodeURIComponent(blockedUserId)}/block`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({})) as { error?: unknown };
      if (!response.ok) throw new Error(String(data.error ?? 'We could not unblock that account.'));
      setComments((current) => current.map((comment) => comment.author?.id === blockedUserId && comment.visibility === 'blocked'
        ? { ...comment, visibility: 'visible' }
        : comment));
    } catch (problem) {
      alert(problem instanceof Error ? problem.message : 'We could not unblock that account.');
    } finally {
      setBlockingUserId(null);
    }
  }

  async function reportComment(commentId: number, reason: string, details: string) {
    const response = await fetch(`/api/comments/${commentId}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, details }),
    });
    const data = await response.json().catch(() => ({})) as { error?: unknown };
    if (!response.ok) throw new Error(String(data.error ?? 'We could not submit this report.'));
    setComments((current) => current.map((comment) => comment.id === commentId
      ? { ...comment, reportedByViewer: true }
      : comment));
  }

  async function banUser(banFromAction: boolean, banFromOrganization: boolean) {
    if (!banTarget) return;
    setBanWorking(true);
    setBanError('');
    try {
      const response = await fetch(`/api/actions/${actionId}/comment-bans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: banTarget.id, banFromAction, banFromOrganization }),
      });
      const data = await response.json().catch(() => ({})) as { error?: unknown };
      if (!response.ok) throw new Error(String(data.error ?? 'We could not ban that user.'));
      setBannedScopes((current) => ({
        ...current,
        [banTarget.id]: {
          action: current[banTarget.id]?.action === true || banFromAction,
          organization: current[banTarget.id]?.organization === true || banFromOrganization,
        },
      }));
      setBanTarget(null);
    } catch (problem) {
      setBanError(problem instanceof Error ? problem.message : 'We could not ban that user.');
    } finally {
      setBanWorking(false);
    }
  }

  return (
    <section className={s.actionCommentsShell} id="comments" aria-labelledby="comments-title">
      <div className={s.actionCommentsHeading}>
        <p className={s.eyebrow}><span /> DISCUSSION</p>
        <h2 id="comments-title">Keep the<br /><em>action going.</em></h2>
        <p>{visibleCount === 0 ? 'Start the conversation.' : `${visibleCount} ${visibleCount === 1 ? 'comment' : 'comments'}`}</p>
      </div>
      <div className={s.actionCommentsPanel}>
        {(isPending || (session && emailVerified)) && (
          <CommentComposer
            parentId={null}
            submissionBlockedReason={submissionBlockedReason}
            onCreate={createComment}
          />
        )}
        {commentsLocked && <CommentRestrictionNotice message="This discussion has been locked by the moderation team. Existing comments remain visible." />}
        {!commentsLocked && slowModeSeconds > 0 && <p className={s.commentsPolicy}>Slow mode is on: one comment every {slowModeSeconds < 60 ? `${slowModeSeconds} seconds` : slowModeSeconds === 60 ? 'minute' : `${slowModeSeconds / 60} minutes`} per member.</p>}
        {!isPending && emailVerified && currentAccess && !currentAccess.allowed && <CommentRestrictionNotice message={currentAccess.message ?? 'Your account cannot post comments.'} />}
        {!isPending && session && !session.user.emailVerified && <VerifyEmailNotice email={session.user.email} />}
        {!isPending && !session && (
          <div className={s.commentsSignIn}>
            <strong>Join the conversation.</strong>
            <p>Sign in or create an account to post and reply.</p>
            <AuthControl />
          </div>
        )}
        <div className={s.commentThreadList}>
          {threads.map((thread) => <CommentItem key={thread.id} node={thread} viewerId={session?.user.id ?? null} canComment={canComment} canReport={canReport} canModerate={Boolean(moderation)} bannedScopes={bannedScopes} deletingId={deletingId} blockingUserId={blockingUserId} onCreate={createComment} onDelete={deleteComment} onBlock={blockUser} onUnblock={unblockUser} onOpenBan={(target) => { setBanError(''); setBanTarget(target); }} onReport={reportComment} />)}
          {threads.length === 0 && <p className={s.commentsStatus}>No comments yet. Be the first to share something useful.</p>}
        </div>
      </div>
      {banTarget && moderation && <CommentBanDialog key={banTarget.id} target={banTarget} organizationName={moderation.organizationName} canBanOrganization={moderation.canBanOrganization} working={banWorking} error={banError} onClose={() => { if (!banWorking) setBanTarget(null); }} onBan={banUser} />}
    </section>
  );
}
