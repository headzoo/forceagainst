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

function CommentItem({ node, viewerId, canComment, deletingId, onCreate, onDelete }: {
  node: ActionCommentNode;
  viewerId: string | null;
  canComment: boolean;
  deletingId: number | null;
  onCreate: (body: string, parentId: number | null) => Promise<void>;
  onDelete: (comment: ActionCommentView) => Promise<void>;
}) {
  const [replying, setReplying] = useState(false);
  const canReply = canComment && node.depth < MAX_COMMENT_DEPTH;
  const canDelete = !node.deleted && node.author?.id === viewerId;

  return (
    <div className={s.commentThreadNode} data-depth={node.depth}>
      <article className={s.commentCard}>
        {node.deleted || !node.author ? (
          <span className={cn(s.commentAvatar, s.commentAvatarDeleted)} aria-hidden="true">×</span>
        ) : (
          <CommentAvatar name={node.author.name} image={node.author.image} />
        )}
        <div className={s.commentCopy}>
          <header>
            {node.deleted || !node.author ? (
              <strong>{node.deleted ? 'Deleted comment' : 'Former member'}</strong>
            ) : (
              <span className={s.commentAuthor}><strong>{node.author.name}</strong><small>@{node.author.username}</small></span>
            )}
            <time dateTime={node.createdAt}>{formatCommentDate(node.createdAt)}</time>
          </header>
          {node.deleted ? <p className={s.commentTombstone}>This comment has been deleted.</p> : <p>{node.body}</p>}
          {(canReply || canDelete) && (
            <div className={s.commentActions}>
              {canReply && <button type="button" onClick={() => setReplying((current) => !current)}>{replying ? 'Cancel reply' : 'Reply'}</button>}
              {canDelete && <button className={s.commentDelete} type="button" disabled={deletingId === node.id} onClick={() => onDelete(node)}>{deletingId === node.id ? 'Deleting…' : 'Delete'}</button>}
            </div>
          )}
        </div>
      </article>
      {replying && <CommentComposer parentId={node.id} autoFocus onCancel={() => setReplying(false)} onCreate={onCreate} />}
      {node.children.length > 0 && (
        <div className={s.commentChildren}>
          {node.children.map((child) => <CommentItem key={child.id} node={child} viewerId={viewerId} canComment={canComment} deletingId={deletingId} onCreate={onCreate} onDelete={onDelete} />)}
        </div>
      )}
    </div>
  );
}

export function ActionComments({ actionId, initialComments }: { actionId: number; initialComments: ActionCommentView[] }) {
  const { data: session, isPending } = authClient.useSession();
  const [comments, setComments] = useState(initialComments);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [commentAccess, setCommentAccess] = useState<null | {
    userId: string;
    allowed: boolean;
    message: string | null;
  }>(null);
  const threads = useMemo(() => nestActionComments(comments), [comments]);
  const visibleCount = comments.filter((comment) => !comment.deleted).length;
  const userId = session?.user.id ?? null;
  const emailVerified = Boolean(session?.user.emailVerified);
  const currentAccess = commentAccess?.userId === userId ? commentAccess : null;
  const accessLoading = Boolean(userId && emailVerified && !currentAccess);
  const canComment = Boolean(userId && emailVerified && currentAccess?.allowed);
  const submissionBlockedReason = isPending
    ? 'Your account is still being checked. Try again in a moment.'
    : accessLoading
      ? 'Your commenting access is still being checked. Try again in a moment.'
      : currentAccess && !currentAccess.allowed
        ? currentAccess.message ?? 'Your account cannot post comments.'
        : null;

  useEffect(() => {
    if (!userId || !emailVerified) return;

    let active = true;
    fetch('/api/account/comment-access', { cache: 'no-store' })
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
  }, [emailVerified, userId]);

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
      const data = await response.json().catch(() => ({})) as { error?: unknown };
      if (!response.ok) {
        alert(String(data.error ?? 'We could not delete that comment.'));
        return;
      }

      setComments((current) => current.map((item) => item.id === comment.id
        ? { ...item, body: null, deleted: true, author: null }
        : item));
    } catch {
      alert('We could not delete that comment. Check your connection and try again.');
    } finally {
      setDeletingId(null);
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
          {threads.map((thread) => <CommentItem key={thread.id} node={thread} viewerId={session?.user.id ?? null} canComment={canComment} deletingId={deletingId} onCreate={createComment} onDelete={deleteComment} />)}
          {threads.length === 0 && <p className={s.commentsStatus}>No comments yet. Be the first to share something useful.</p>}
        </div>
      </div>
    </section>
  );
}
