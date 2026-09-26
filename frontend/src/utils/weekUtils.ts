export type WeekStartDay =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

const WEEK_DAYS: WeekStartDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

const WEEKDAY_TO_JS_DAY: Record<WeekStartDay, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function toLocalMidnight(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseLocalDate(dateString: string): Date | null {
  if (!dateString || typeof dateString !== 'string') return null;
  const [y, m, d] = dateString.split('-').map((part) => Number.parseInt(part, 10));
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) {
    return null;
  }
  return parsed;
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function normalizeWeekStartDay(value: unknown): WeekStartDay {
  return WEEK_DAYS.includes(value as WeekStartDay) ? (value as WeekStartDay) : 'monday';
}

export function getWeekStartDate(date: Date, weekStartDay?: unknown): Date {
  const normalizedWeekStartDay = normalizeWeekStartDay(weekStartDay);
  const current = toLocalMidnight(date);
  const targetJsDay = WEEKDAY_TO_JS_DAY[normalizedWeekStartDay];
  const diff = (current.getDay() - targetJsDay + 7) % 7;
  const weekStart = new Date(current);
  weekStart.setDate(current.getDate() - diff);
  return weekStart;
}

export function getWeekStartDateKey(date: Date, weekStartDay?: unknown): string {
  return formatDate(getWeekStartDate(date, weekStartDay));
}

export function getDayIndexInWeek(date: Date, weekStartDay?: unknown): number {
  const weekStart = getWeekStartDate(date, weekStartDay);
  return Math.max(0, Math.floor((toLocalMidnight(date).getTime() - weekStart.getTime()) / DAY_MS));
}

export function getEffectiveWeekForDate(
  baseWeek: number,
  options?: {
    date?: Date;
    startDate?: string;
    weekStartDay?: unknown;
    maxWeek?: number;
  }
): number {
  const date = options?.date ?? new Date();
  const maxWeek = Number.isFinite(options?.maxWeek) ? Number(options?.maxWeek) : undefined;
  const parsedStartDate = parseLocalDate(String(options?.startDate || ''));

  let week = Number.isFinite(baseWeek) ? Math.max(1, Math.trunc(baseWeek)) : 1;

  if (parsedStartDate) {
    // 周次严格以学期起点当天为第1周第1天，每7天一周
    const currentDate = toLocalMidnight(date);
    const firstDate = toLocalMidnight(parsedStartDate);
    const deltaDays = Math.floor((currentDate.getTime() - firstDate.getTime()) / DAY_MS);
    week = Math.max(1, Math.floor(deltaDays / 7) + 1);
  }

  if (typeof maxWeek === 'number' && maxWeek > 0) {
    week = Math.min(week, maxWeek);
  }

  return week;
}
