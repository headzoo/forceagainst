export const MAX_COMMENT_DEPTH = 3;
export const MAX_COMMENT_LENGTH = 2_000;

export type ActionCommentAuthor = {
  id: string;
  name: string;
  username: string;
  image: string | null;
};

export type ActionCommentView = {
  id: number;
  actionId: number;
  parentId: number | null;
  depth: number;
  body: string | null;
  deleted: boolean;
  createdAt: string;
  author: ActionCommentAuthor | null;
};

export type ActionCommentNode = ActionCommentView & { children: ActionCommentNode[] };

export function nestActionComments(comments: ActionCommentView[]): ActionCommentNode[] {
  const nodes = new Map<number, ActionCommentNode>();
  const roots: ActionCommentNode[] = [];

  for (const comment of comments) {
    nodes.set(comment.id, { ...comment, children: [] });
  }

  for (const comment of comments) {
    const node = nodes.get(comment.id)!;
    const parent = comment.parentId === null ? undefined : nodes.get(comment.parentId);

    if (parent && comment.depth === parent.depth + 1 && comment.depth <= MAX_COMMENT_DEPTH) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
