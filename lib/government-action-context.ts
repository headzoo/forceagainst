export const GOVERNMENT_SUBJECT_MAX_LENGTH = 500;
export const GOVERNMENT_BACKGROUND_MAX_LENGTH = 8_000;
export const GOVERNMENT_REQUEST_MAX_LENGTH = 8_000;

export type GovernmentActionFields = {
  governmentSubject: string | null;
  governmentBackground: string | null;
  governmentRequest: string | null;
};

export type GovernmentActionContext = {
  id: number;
  title: string;
  subject: string;
  background: string;
  request: string;
  sourceUrl: string;
};

type ActionContextSource = GovernmentActionFields & {
  id: number;
  title: string;
  detail: string;
  href: string;
};

function optionalText(value: unknown, maximumLength: number) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text.slice(0, maximumLength) : null;
}

export function parseGovernmentActionFields(body: Record<string, unknown> | null): GovernmentActionFields | { error: string } {
  const governmentSubject = optionalText(body?.governmentSubject, GOVERNMENT_SUBJECT_MAX_LENGTH);
  const governmentBackground = optionalText(body?.governmentBackground, GOVERNMENT_BACKGROUND_MAX_LENGTH);
  const governmentRequest = optionalText(body?.governmentRequest, GOVERNMENT_REQUEST_MAX_LENGTH);

  if (typeof body?.governmentSubject === 'string' && body.governmentSubject.trim().length > GOVERNMENT_SUBJECT_MAX_LENGTH) {
    return { error: `Government letter subject must be ${GOVERNMENT_SUBJECT_MAX_LENGTH.toLocaleString()} characters or fewer.` };
  }
  if (typeof body?.governmentBackground === 'string' && body.governmentBackground.trim().length > GOVERNMENT_BACKGROUND_MAX_LENGTH) {
    return { error: `Government letter background must be ${GOVERNMENT_BACKGROUND_MAX_LENGTH.toLocaleString()} characters or fewer.` };
  }
  if (typeof body?.governmentRequest === 'string' && body.governmentRequest.trim().length > GOVERNMENT_REQUEST_MAX_LENGTH) {
    return { error: `Government letter request must be ${GOVERNMENT_REQUEST_MAX_LENGTH.toLocaleString()} characters or fewer.` };
  }

  return { governmentSubject, governmentBackground, governmentRequest };
}

export function buildGovernmentActionContext(action: ActionContextSource): GovernmentActionContext {
  return {
    id: action.id,
    title: action.title,
    subject: action.governmentSubject?.trim() || action.title,
    background: action.governmentBackground?.trim()
      || `${action.detail}\n\nMore information: ${action.href}`,
    request: action.governmentRequest?.trim()
      || `Please consider the request described by "${action.title}" and take appropriate action.`,
    sourceUrl: action.href,
  };
}
