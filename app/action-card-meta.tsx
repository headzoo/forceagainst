export function ActionCardMeta({ commentCount, effort }: { commentCount: number; effort: string }) {
  const commentLabel = commentCount === 1 ? 'COMMENT' : 'COMMENTS';

  return (
    <span>{commentCount.toLocaleString('en-US')} {commentLabel} &bull; {effort}</span>
  );
}
