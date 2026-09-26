import { getUsableSecret, isRedactedSecret, REDACTED_SECRET } from '../secrets';

describe('redacted frontend secret handling', () => {
  it('recognizes the backend marker without exposing it as a usable credential', () => {
    expect(isRedactedSecret(REDACTED_SECRET)).toBe(true);
    expect(getUsableSecret(REDACTED_SECRET, '', null)).toBe('');
  });

  it('returns the first actual credential and ignores blank/redacted candidates', () => {
    expect(getUsableSecret(REDACTED_SECRET, '  ', 'configured-key')).toBe('configured-key');
  });
});
