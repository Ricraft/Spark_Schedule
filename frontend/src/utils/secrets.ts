export const REDACTED_SECRET = '__SPARK_SCHEDULE_SECRET_REDACTED__';

export const isRedactedSecret = (value: unknown): boolean => value === REDACTED_SECRET;

export const getUsableSecret = (...values: unknown[]): string => {
  const secret = values.find(
    (value): value is string => typeof value === 'string' && value.trim().length > 0 && !isRedactedSecret(value)
  );
  return secret ?? '';
};
