import { describe, it, expect } from 'vitest';
import { extractInviteErrorMessage } from './inviteErrors';

function makeFirebaseError(code: string, message: string): Error {
  const err = new Error(message);
  (err as Error & { code: string }).code = code;
  return err;
}

describe('extractInviteErrorMessage', () => {
  it('returns a friendly custom message from an HttpsError verbatim', () => {
    const err = makeFirebaseError(
      'functions/not-found',
      "This person hasn't signed in to the app yet — ask them to sign in with Google once, then invite them again."
    );
    expect(extractInviteErrorMessage(err)).toBe(
      "This person hasn't signed in to the app yet — ask them to sign in with Google once, then invite them again."
    );
  });

  it('replaces a raw bare-code fallback message (e.g. undeployed function) with a generic one', () => {
    const err = makeFirebaseError('functions/internal', 'internal');
    expect(extractInviteErrorMessage(err)).toBe(
      'Something went wrong sending the invite. Please try again.'
    );
  });

  it('is case-insensitive when matching the bare code fallback', () => {
    const err = makeFirebaseError('functions/internal', 'INTERNAL');
    expect(extractInviteErrorMessage(err)).toBe(
      'Something went wrong sending the invite. Please try again.'
    );
  });

  it('falls back to the generic message for a non-Error thrown value', () => {
    expect(extractInviteErrorMessage('boom')).toBe(
      'Something went wrong sending the invite. Please try again.'
    );
  });

  it('falls back to the generic message for an Error with no message', () => {
    expect(extractInviteErrorMessage(new Error())).toBe(
      'Something went wrong sending the invite. Please try again.'
    );
  });

  it('trusts a plain Error message with no code as-is', () => {
    expect(extractInviteErrorMessage(new Error('Network request failed'))).toBe(
      'Network request failed'
    );
  });
});
