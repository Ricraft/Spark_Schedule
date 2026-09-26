// 统一的课程数据接口定义
export interface Course {
  id: string;
  name: string;        // 课程名称
  teacher: string;     // 教师
  location: string;    // 地点
  weeks: number[];     // 周次数组，如 [1, 2, 3, 4, 5, 6, 7, 8]
  day: number;         // 星期几 (1=周一, 2=周二, ..., 7=周日)
  start: number;       // 开始节次 (1=第1节)
  duration: number;    // 持续节数 (2=持续2节)
  color: string;       // 颜色
  credit?: number;     // 学分 (可选)
  note?: string;       // 备注 (可选)
  groupId?: string;    // 课程分组ID (可选)
}

// 工具函数：将周次数组转换为字符串显示
export function weeksToString(weeks: number[]): string {
  if (weeks.length === 0) return "全学期";
  const min = Math.min(...weeks);
  const max = Math.max(...weeks);
  if (min === max) return `第${min}周`;
  return `${min}-${max}周`;
}

// 工具函数：将周次字符串解析为数组
export function stringToWeeks(weeksStr: string): number[] {
  if (!weeksStr || weeksStr === "全学期") {
    return Array.from({length: 16}, (_, i) => i + 1); // 默认1-16周
  }
  
  const match = weeksStr.match(/(\d+)-(\d+)/);
  if (match) {
    const start = parseInt(match[1]);
    const end = parseInt(match[2]);
    return Array.from({length: end - start + 1}, (_, i) => start + i);
  }
  
  const singleMatch = weeksStr.match(/第?(\d+)周/);
  if (singleMatch) {
    return [parseInt(singleMatch[1])];
  }
  
  return Array.from({length: 16}, (_, i) => i + 1); // 默认1-16周
}