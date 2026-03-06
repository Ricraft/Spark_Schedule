"""
强智教务系统通用导入器 - 智能穿透版 v2 (Auto-Layout Edition)

核心更新：
1. [表头侦测]: 自动识别"星期日"开头还是"星期一"开头，自动识别是否有节次列。
2. [Iframe 穿透]: 保持了之前的 Iframe 穿透能力。
3. [积分寻址]: 保持了积分算法定位表格的能力。
"""

import re
import uuid
import logging
from typing import List, Tuple, Optional

from bs4 import BeautifulSoup, Tag

try:
    from .base_importer import BaseImporter
    from ..models.course_base import CourseBase
    from ..models.course_detail import CourseDetail
    from ..models.week_type import WeekType
    from ..utils.color_manager import ColorManager
except ImportError:
    from importers.base_importer import BaseImporter
    from models.course_base import CourseBase
    from models.course_detail import CourseDetail
    from models.week_type import WeekType
    from utils.color_manager import ColorManager

logger = logging.getLogger(__name__)

class FrameDetectedError(ValueError):
    def __init__(self, message, inner_url):
        super().__init__(message)
        self.inner_url = inner_url

class QiangZhiImporter(BaseImporter):

    def __init__(
        self,
        school_name: str = "通用强智系统",
        sunday_first: bool = False, # 默认值，会被自动侦测覆盖
        first_col_is_header: bool = False, # 默认值，会被自动侦测覆盖
        split_pattern: str = r'-{10,}',
        table_id: str = 'kbtable',
        cell_class: str = 'kbcontent',
        week_pattern: str = r'([\d\-,]+)\(周\)',
        section_pattern: str = r'\[(\d+)-(\d+)节\]',
        teacher_title: str = '老师',
        location_title: str = '教室',
        week_section_title: str = '周次(节次)',
        odd_week_keyword: str = '单周',
        even_week_keyword: str = '双周',
        exclude_courses: List[str] = None
    ):
        self.school_name = school_name
        self.sunday_first = sunday_first
        self.first_col_is_header = first_col_is_header
        self.split_pattern = split_pattern
        self.table_id = table_id
        self.cell_class = cell_class
        self.week_pattern = week_pattern
        self.section_pattern = section_pattern
        self.teacher_title = teacher_title
        self.location_title = location_title
        self.week_section_title = week_section_title
        self.odd_week_keyword = odd_week_keyword
        self.even_week_keyword = even_week_keyword
        self.exclude_courses = exclude_courses or ["教学资料", ""]
        self.color_manager = ColorManager()

    def get_supported_formats(self) -> List[str]:
        return ['.html', '.htm']

    def get_importer_name(self) -> str:
        return self.school_name

    def _check_iframe_trap(self, soup: BeautifulSoup) -> Optional[str]:
        # 1. 检查是否存在包含 'xskb' 或 'list.do' 的 iframe
        iframe = soup.find('iframe', src=re.compile(r'xskb|list\.do', re.IGNORECASE))
        if iframe:
            return iframe.get('src')
        # 2. 检查是否有 id="Frame1" (南华大学特定)
        frame1 = soup.find(id="Frame1")
        if frame1 and frame1.name == 'iframe':
            return frame1.get('src')
        return None

    def _calculate_table_score(self, element: Tag) -> int:
        score = 0
        text = element.get_text()

        if "星期" in text: score += 10
        if "节次" in text: score += 10

        week_matches = re.findall(r'\d+-\d+\(周\)', text)
        score += len(week_matches) * 5

        section_matches = re.findall(r'\[\d+-\d+节\]', text)
        score += len(section_matches) * 5

        if element.get('id') == self.table_id:
            score += 50

        if len(text) < 50: score = 0
        return score

    def _find_best_table(self, soup: BeautifulSoup) -> Optional[Tag]:
        candidates = []
        tables = soup.find_all('table')
        for tbl in tables:
            score = self._calculate_table_score(tbl)
            if score > 0: candidates.append((score, tbl))

        if not candidates:
            divs = soup.find_all('div')
            for d in divs:
                if len(d.get_text()) > 200:
                    score = self._calculate_table_score(d)
                    if score > 20: candidates.append((score, d))

        candidates.sort(key=lambda x: x[0], reverse=True)
        if candidates: return candidates[0][1]
        return None

    def _autodetect_layout(self, table: Tag):
        """
        自动分析表格表头，确定列偏移和星期顺序
        """
        rows = table.find_all('tr')
        header_row = None

        # 1. 寻找包含"星期"或"周"的表头行
        for row in rows:
            text = row.get_text()
            if any(kw in text for kw in ["星期", "周一", "周二", "周日"]):
                header_row = row
                break

        if not header_row:
            logger.warning(f"[{self.school_name}] 未找到表头行")
            return

        # 2. 分析列结构
        cells = header_row.find_all(['th', 'td'])
        col_texts = [cell.get_text(strip=True) for cell in cells]
        logger.info(f"[{self.school_name}] 表头内容: {col_texts}")

        idx_sun = -1
        idx_mon = -1

        for i, text in enumerate(col_texts):
            if any(kw in text for kw in ["星期日", "周日"]):
                idx_sun = i
            elif any(kw in text for kw in ["星期一", "周一"]):
                idx_mon = i

        # 3. 判定首列是否为表头 (偏移量)
        valid_indices = [i for i in [idx_sun, idx_mon] if i >= 0]
        if valid_indices:
            first_day_idx = min(valid_indices)
            if first_day_idx > 0:
                self.first_col_is_header = True
                logger.info(f"[{self.school_name}] 检测到首列为非课程列 (偏移={first_day_idx})")
            else:
                self.first_col_is_header = False

        # 4. 判定星期顺序
        if idx_sun != -1 and idx_mon != -1:
            self.sunday_first = (idx_sun < idx_mon)
            logger.info(f"[{self.school_name}] Sunday-first: {self.sunday_first}")
        elif idx_sun != -1:
            self.sunday_first = (idx_sun <= 1)
            logger.info(f"[{self.school_name}] 推断 Sunday-first: {self.sunday_first}")

    def validate(self, content: str) -> Tuple[bool, str]:
        if not content or not content.strip():
            return False, "内容为空"

        content = content.replace('\u3000', ' ')
        try:
            soup = BeautifulSoup(content, 'html.parser')
        except:
            soup = BeautifulSoup(content, 'lxml')

        if self._check_iframe_trap(soup):
            return False, "检测到Iframe陷阱"

        if not self._find_best_table(soup):
            return False, "未找到有效的课表结构"

        return True, ""

    def parse(self, content: str) -> Tuple[List[CourseBase], List[CourseDetail]]:
        content = content.replace('\u3000', ' ')
        try:
            soup = BeautifulSoup(content, 'html.parser')
        except:
            soup = BeautifulSoup(content, 'lxml')

        inner_url = self._check_iframe_trap(soup)
        if inner_url:
            raise FrameDetectedError("检测到外层框架，请加载内部课表 URL", inner_url)

        table = self._find_best_table(soup)
        if not table:
            raise ValueError("无法定位课表数据")

        # [关键步骤] 解析数据前，先自动侦测布局
        self._autodetect_layout(table)
        
        logger.info(f"[{self.school_name}] 布局侦测结果: sunday_first={self.sunday_first}, first_col_is_header={self.first_col_is_header}")

        course_bases, course_details = [], []
        name_to_id = {}

        rows = table.find_all('tr')
        if not rows: return [], []
        
        logger.info(f"[{self.school_name}] 找到 {len(rows)} 行数据")

        # 🚨 引入网格占用追踪，解决 rowspan 导致的星期偏移问题
        # grid[row_idx][col_idx] = True if occupied
        occupied_grid = {}

        for r_idx, row in enumerate(rows):
            td_cells = row.find_all(['td', 'th'])
            if not td_cells: continue
            
            logger.debug(f"[行 {r_idx}] 找到 {len(td_cells)} 个单元格")

            # 跟踪当前行处理到的真实物理列索引
            current_col = 0

            for cell in td_cells:
                # 寻找当前行中第一个未被占用的物理列
                while occupied_grid.get((r_idx, current_col)):
                    current_col += 1

                # 获取单元格跨度
                rowspan = int(cell.get('rowspan', 1))
                colspan = int(cell.get('colspan', 1))
                
                logger.debug(f"[行 {r_idx}, 列 {current_col}] rowspan={rowspan}, colspan={colspan}")

                # 标记未来网格占用
                for r_offset in range(rowspan):
                    for c_offset in range(colspan):
                        occupied_grid[(r_idx + r_offset, current_col + c_offset)] = True

                # 判定当前列是否属于表头列 (节次列)
                is_header_col = False
                if self.first_col_is_header and current_col == 0:
                    is_header_col = True
                
                # 如果不是表头列，则处理课程内容
                if not is_header_col:
                    self._process_cell(cell, current_col, course_bases, course_details, name_to_id)

                # 处理完当前单元格，移动到下一列
                current_col += colspan

        # [新增] 批量应用自动配色优化
        self._apply_batch_color_assignment(course_bases)
        
        # 统计导入的课程按星期分布
        day_distribution = {}
        for detail in course_details:
            day = detail.day_of_week
            day_distribution[day] = day_distribution.get(day, 0) + 1
        
        logger.info(f"[{self.school_name}] 导入完成: {len(course_bases)} 个课程, {len(course_details)} 个时间段")
        logger.info(f"[{self.school_name}] 星期分布: {day_distribution}")
        
        # 检查是否缺少周末课程
        if 6 not in day_distribution and 7 not in day_distribution:
            logger.warning(f"[{self.school_name}] ⚠️ 未检测到周末课程 (星期六/日)，请检查HTML表格是否包含完整的7天列")

        return course_bases, course_details

    def _process_cell(self, cell, col_idx, course_bases, course_details, name_to_id):
        detail_div = cell.find('div', class_=self.cell_class)
        if not detail_div:
            divs = cell.find_all('div')
            for d in divs:
                if d.get_text(strip=True):
                    detail_div = d
                    break

        if not detail_div or not detail_div.get_text(strip=True):
            return

        raw_html = str(detail_div)
        segments = re.split(self.split_pattern, raw_html)
        
        logger.debug(f"[处理单元格] col_idx={col_idx}, segments={len(segments)}")

        for segment in segments:
            self._parse_segment(segment, col_idx, course_bases, course_details, name_to_id)

    def _parse_segment(self, segment_html, col_idx, course_bases, course_details, name_to_id):
        # 深度清理 HTML 实体
        segment_html = segment_html.replace('&nbsp;', ' ').replace('\u00a0', ' ')
        seg_soup = BeautifulSoup(segment_html, 'html.parser')
        
        # 提取文本，处理多行
        all_text_list = [t.strip() for t in seg_soup.get_text("|").split("|") if t.strip()]
        if not all_text_list: return

        # 寻找课程名：忽略只有数字、符号或太短的行
        course_name = ""
        for t in all_text_list:
            clean_t = re.sub(r'\s*\(.*?\)', '', t).strip()
            if clean_t and not clean_t.isdigit() and len(clean_t) > 1:
                if clean_t not in self.exclude_courses:
                    course_name = clean_t
                    break
        
        if not course_name: return

        teacher = ""
        location = ""
        week_sec_text = ""

        # 智能搜寻字段
        full_text = "|".join(all_text_list)
        
        # 提取节次信息：增强正则，优先匹配带"节"字的模式
        # 先尝试匹配明确带"节"字的模式：[01-02节], [1-2]节, (1-2)节
        sec_match = re.search(r'[\[（\(]?([\d\-]+)节[\)\]）]?', full_text)
        if not sec_match:
            # 如果没找到，再尝试匹配括号内的数字（但要避免匹配周次）
            # 确保不是周次：周次通常有"周"字
            sec_match = re.search(r'[\[（\(]([\d\-]+)[\)\]）](?!.*周)', full_text)
        
        if not sec_match: 
            logger.debug(f"[解析失败] 未找到节次信息: {full_text[:100]}")
            return
        
        sec_str = sec_match.group(1)
        sec_numbers = [int(n) for n in re.findall(r'\d+', sec_str)]
        if not sec_numbers: return
        
        start_sec = min(sec_numbers)
        end_sec = max(sec_numbers)
        step = end_sec - start_sec + 1
        
        logger.debug(f"[节次解析] 课程: {course_name}, 节次字符串: {sec_str}, start={start_sec}, end={end_sec}, step={step}")

        # 提取周次信息
        week_ranges = self._parse_complex_weeks(full_text)
        if not week_ranges: return

        # 提取教师和地点 (排除掉已识别的课程名、周次、节次)
        other_info = []
        for t in all_text_list:
            if t == course_name or "周" in t or "[" in t or "(" in t: continue
            other_info.append(t)
        
        if len(other_info) >= 1: teacher = other_info[0]
        if len(other_info) >= 2: location = other_info[1]
        
        # 兼容 font 标签
        fonts = seg_soup.find_all('font')
        for f in fonts:
            title = f.get('title', '')
            text_val = f.get_text(strip=True)
            if "老师" in title: teacher = text_val
            elif "教室" in title: location = text_val

        if course_name not in name_to_id:
            course_id = str(uuid.uuid4())
            name_to_id[course_name] = course_id
            course_color = self.color_manager.get_color_for_course(course_name)
            course_bases.append(CourseBase(name=course_name, course_id=course_id, color=course_color))
        else:
            course_id = name_to_id[course_name]

        day_of_week = self._calculate_day_of_week(col_idx)
        week_type = self._detect_week_type(segment_html)

        for w_start, w_end in week_ranges:
            detail = CourseDetail(
                course_id=course_id, teacher=teacher, location=location,
                day_of_week=day_of_week, start_section=start_sec, step=step,
                start_week=w_start, end_week=w_end, week_type=week_type
            )
            course_details.append(detail)

    def _calculate_day_of_week(self, col_idx: int) -> int:
        effective_idx = col_idx
        # 如果侦测到有表头列，减去偏移
        if self.first_col_is_header:
            effective_idx -= 1

        # 安全边界检查
        if effective_idx < 0: 
            return 1

        if self.sunday_first:
            # 0(Sun)->7, 1(Mon)->1, 2(Tue)->2, 3(Wed)->3, 4(Thu)->4, 5(Fri)->5, 6(Sat)->6
            sun_days = [7, 1, 2, 3, 4, 5, 6]
            return sun_days[effective_idx % 7]
        else:
            # 0(Mon)->1, 1(Tue)->2, 2(Wed)->3, 3(Thu)->4, 4(Fri)->5, 5(Sat)->6, 6(Sun)->7
            return (effective_idx % 7) + 1

    def _extract_field_from_text(self, text_list: List[str], field_name: str) -> str:
        try:
            if field_name in text_list:
                idx = text_list.index(field_name)
                if idx + 1 < len(text_list): return text_list[idx + 1]
        except: pass
        return ""

    def _detect_week_type(self, text: str) -> WeekType:
        if self.odd_week_keyword in text: return WeekType.ODD_WEEK
        if self.even_week_keyword in text: return WeekType.EVEN_WEEK
        return WeekType.EVERY_WEEK

    def _parse_complex_weeks(self, text: str) -> List[Tuple[int, int]]:
        # 支持多种括号
        match = re.search(r'([\d\-,]+)[\(\[（{]周[\)\]）}]', text)
        if not match: 
            # 尝试直接找数字
            match = re.search(r'([\d\-,]+)周', text)
            if not match: return []
            
        raw_weeks = match.group(1)
        ranges = []
        for part in raw_weeks.split(','):
            part = part.strip()
            if not part: continue
            if '-' in part:
                try:
                    s, e = part.split('-')
                    if s.isdigit() and e.isdigit(): ranges.append((int(s), int(e)))
                except: continue
            elif part.isdigit():
                ranges.append((int(part), int(part)))
        return ranges

    def _apply_batch_color_assignment(self, course_bases: List[CourseBase]) -> None:
        """
        批量应用自动配色优化
        
        确保所有导入的课程都有正确的颜色配置，并利用ColorManager的批量分配功能
        进行优化处理。这个方法作为导入过程的最后一步，确保颜色分配的一致性。
        
        Args:
            course_bases: 课程基础信息列表
        """
        if not course_bases:
            return
            
        # 转换为字典格式以便使用ColorManager的批量分配方法
        course_dicts = []
        for course_base in course_bases:
            course_dict = {
                'name': course_base.name,
                'color': course_base.color,
                'course_id': course_base.course_id,
                'note': course_base.note
            }
            course_dicts.append(course_dict)
        
        # 使用ColorManager的批量分配方法进行优化
        optimized_courses = self.color_manager.assign_colors_to_import(course_dicts)
        
        # 将优化后的颜色应用回CourseBase对象
        for i, course_base in enumerate(course_bases):
            if i < len(optimized_courses) and 'color' in optimized_courses[i]:
                course_base.color = optimized_courses[i]['color']
        
        logger.info(f"[{self.school_name}] 批量配色完成，处理了 {len(course_bases)} 个课程")