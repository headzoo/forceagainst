export const OPEN_SIGN_IN_DIALOG_EVENT = 'force-against:open-sign-in-dialog';

export function openSignInDialog() {
  window.dispatchEvent(new Event(OPEN_SIGN_IN_DIALOG_EVENT));
}
