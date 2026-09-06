'use client';

import Image from 'next/image';
import { type FormEvent, useMemo, useState } from 'react';
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
    <span className="comment-avatar" aria-hidden="true">
      <span>{initials(name)}</span>
      {image && <Image src={image} alt="" fill sizes="48px" unoptimized referrerPolicy="no-referrer" onError={(event) => { event.currentTarget.hidden = true; }} />}
    </span>
  );
}

function CommentComposer({ parentId, autoFocus = false, onCancel, onCreate }: {
  parentId: number | null;
  autoFocus?: boolean;
  onCancel?: () => void;
  onCreate: (body: string, parentId: number | null) => Promise<void>;
}) {
  const [body, setBody] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim()) return;
    setWorking(true);
    setError('');

    try {
      await onCreate(body, parentId);
      setBody('');
      onCancel?.();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'We could not post your comment.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <form className={`comment-composer ${parentId === null ? '' : 'comment-reply-composer'}`} onSubmit={submit}>
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
      <div className="comment-composer-foot">
        <small>{body.length.toLocaleString()} / {MAX_COMMENT_LENGTH.toLocaleString()}</small>
        <span>
          {onCancel && <button className="comment-cancel" type="button" onClick={onCancel}>Cancel</button>}
          <button className="comment-submit" type="submit" disabled={working || !body.trim()}>{working ? 'POSTING…' : parentId === null ? 'POST COMMENT' : 'POST REPLY'}</button>
        </span>
      </div>
      {error && <p className="comment-error" role="alert">{error}</p>}
    </form>
  );
}

function CommentItem({ node, viewerId, deletingId, onCreate, onDelete }: {
  node: ActionCommentNode;
  viewerId: string | null;
  deletingId: number | null;
  onCreate: (body: string, parentId: number | null) => Promise<void>;
  onDelete: (comment: ActionCommentView) => Promise<void>;
}) {
  const [replying, setReplying] = useState(false);
  const canReply = Boolean(viewerId) && node.depth < MAX_COMMENT_DEPTH;
  const canDelete = !node.deleted && node.author?.id === viewerId;

  return (
    <div className="comment-thread-node" data-depth={node.depth}>
      <article className={`comment-card ${node.deleted ? 'is-deleted' : ''}`}>
        {node.deleted || !node.author ? (
          <span className="comment-avatar comment-avatar-deleted" aria-hidden="true">×</span>
        ) : (
          <CommentAvatar name={node.author.name} image={node.author.image} />
        )}
        <div className="comment-copy">
          <header>
            {node.deleted || !node.author ? (
              <strong>{node.deleted ? 'Deleted comment' : 'Former member'}</strong>
            ) : (
              <span className="comment-author"><strong>{node.author.name}</strong><small>@{node.author.username}</small></span>
            )}
            <time dateTime={node.createdAt}>{formatCommentDate(node.createdAt)}</time>
          </header>
          {node.deleted ? <p className="comment-tombstone">This comment has been deleted.</p> : <p>{node.body}</p>}
          {(canReply || canDelete) && (
            <div className="comment-actions">
              {canReply && <button type="button" onClick={() => setReplying((current) => !current)}>{replying ? 'Cancel reply' : 'Reply'}</button>}
              {canDelete && <button className="comment-delete" type="button" disabled={deletingId === node.id} onClick={() => onDelete(node)}>{deletingId === node.id ? 'Deleting…' : 'Delete'}</button>}
            </div>
          )}
        </div>
      </article>
      {replying && <CommentComposer parentId={node.id} autoFocus onCancel={() => setReplying(false)} onCreate={onCreate} />}
      {node.children.length > 0 && (
        <div className="comment-children">
          {node.children.map((child) => <CommentItem key={child.id} node={child} viewerId={viewerId} deletingId={deletingId} onCreate={onCreate} onDelete={onDelete} />)}
        </div>
      )}
    </div>
  );
}

export function ActionComments({ actionId, initialComments }: { actionId: number; initialComments: ActionCommentView[] }) {
  const { data: session, isPending } = authClient.useSession();
  const [comments, setComments] = useState(initialComments);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const threads = useMemo(() => nestActionComments(comments), [comments]);
  const visibleCount = comments.filter((comment) => !comment.deleted).length;

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
    <section className="action-comments-shell" id="comments" aria-labelledby="comments-title">
      <div className="action-comments-heading">
        <p className="eyebrow"><span /> DISCUSSION</p>
        <h2 id="comments-title">Keep the<br /><em>action going.</em></h2>
        <p>{visibleCount === 0 ? 'Start the conversation.' : `${visibleCount} ${visibleCount === 1 ? 'comment' : 'comments'}`}</p>
      </div>
      <div className="action-comments-panel">
        {isPending && <p className="comments-session-loading">Checking your account…</p>}
        {!isPending && session && <CommentComposer parentId={null} onCreate={createComment} />}
        {!isPending && !session && (
          <div className="comments-sign-in">
            <strong>Join the conversation.</strong>
            <p>Sign in or create an account to post and reply.</p>
            <AuthControl />
          </div>
        )}
        <div className="comment-thread-list">
          {threads.map((thread) => <CommentItem key={thread.id} node={thread} viewerId={session?.user.id ?? null} deletingId={deletingId} onCreate={createComment} onDelete={deleteComment} />)}
          {threads.length === 0 && <p className="comments-empty">No comments yet. Be the first to share something useful.</p>}
        </div>
      </div>
    </section>
  );
}
