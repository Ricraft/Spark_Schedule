const numericComponent = String.raw`[+-]?(?:\d+(?:\.\d*)?|\.\d+)%?`;
const separator = String.raw`(?:\s*,\s*|\s+)`;
const numericTriple = `${numericComponent}${separator}${numericComponent}${separator}${numericComponent}`;
const safeColorFunction = new RegExp(
  `^(?:rgb\\(${numericTriple}\\)|rgba\\(${numericTriple}${separator}${numericComponent}\\)|hsl\\(${numericTriple}\\)|hsla\\(${numericTriple}${separator}${numericComponent}\\))$`,
  'i'
);
const safeHexColor = /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i;

/** Accept only literal numeric CSS colors; values are later embedded in an inline style block. */
export const sanitizeChartColor = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const color = value.trim();
  if (safeHexColor.test(color) || safeColorFunction.test(color)) return color;
  return '';
};
