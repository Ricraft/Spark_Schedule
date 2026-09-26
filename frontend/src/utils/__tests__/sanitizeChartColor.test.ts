import { sanitizeChartColor } from '../sanitizeChartColor';

describe('sanitizeChartColor', () => {
  it.each([
    '#f0a',
    '#1a2b3c',
    '#1a2b3c80',
    'rgb(12, 34, 56)',
    'rgb(12 34 56)',
    'rgba(12, 34, 56, 0.5)',
    'hsl(210, 50%, 40%)',
    'hsla(210 50% 40% 25%)',
  ])('accepts safe literal color %s', (color) => {
    expect(sanitizeChartColor(color)).toBe(color);
  });

  it.each([
    'red',
    'var(--theme-color)',
    'url(javascript:alert(1))',
    'rgb(1);--x: red',
    'rgb(1, 2, 3);</style><script>alert(1)</script>',
    'rgb(1, 2, 3)/**/}',
    'rgb(1 / 2 / 3)',
    'rgb(1, 2, 3)<style>',
    'hsl(1, 2%, 3%); color: red',
  ])('rejects unsafe or unsupported value %s', (color) => {
    expect(sanitizeChartColor(color)).toBe('');
  });
});
