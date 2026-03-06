#!/usr/bin/env python3
"""
课程数据迁移脚本
scripts/migrate_course_data.py

该脚本用于将现有的 courses.json 文件迁移到标准化格式。
主要功能：
1. 读取现有 courses.json
2. 备份原始数据
3. 应用数据标准化
4. 保存标准化后的数据
5. 生成迁移报告

使用方法：
    python scripts/migrate_course_data.py
    python scripts/migrate_course_data.py --input data/courses.json --output data/courses.json
"""

import json
import os
import sys
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

# 添加项目根目录到路径，以便导入模块
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from backend.utils.data_normalizer import CourseDataNormalizer, DataNormalizationError


class CourseMigrationReport:
    """迁移报告生成器"""
    
    def __init__(self):
        self.total_courses = 0
        self.successful_migrations = 0
        self.failed_migrations = 0
        self.warnings = []
        self.errors = []
        self.type_fixes = {
            'day': 0,
            'start': 0,
            'duration': 0,
            'weeks': 0
        }
    
    def add_warning(self, message: str):
        """添加警告信息"""
        self.warnings.append(message)
    
    def add_error(self, message: str):
        """添加错误信息"""
        self.errors.append(message)
    
    def record_type_fix(self, field: str):
        """记录类型修复"""
        if field in self.type_fixes:
            self.type_fixes[field] += 1
    
    def generate_report(self) -> str:
        """生成迁移报告"""
        report_lines = [
            "=" * 60,
            "课程数据迁移报告",
            "=" * 60,
            f"迁移时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "📊 统计信息:",
            f"  总课程数: {self.total_courses}",
            f"  成功迁移: {self.successful_migrations}",
            f"  失败迁移: {self.failed_migrations}",
            f"  成功率: {self.successful_migrations / self.total_courses * 100:.1f}%" if self.total_courses > 0 else "  成功率: N/A",
            "",
            "🔧 类型修复统计:",
        ]
        
        for field, count in self.type_fixes.items():
            if count > 0:
                report_lines.append(f"  {field}: {count} 次修复")
        
        if not any(self.type_fixes.values()):
            report_lines.append("  无需修复")
        
        if self.warnings:
            report_lines.extend([
                "",
                f"⚠️ 警告信息 ({len(self.warnings)}):",
            ])
            for i, warning in enumerate(self.warnings[:10], 1):
                report_lines.append(f"  {i}. {warning}")
            if len(self.warnings) > 10:
                report_lines.append(f"  ... 还有 {len(self.warnings) - 10} 条警告")
        
        if self.errors:
            report_lines.extend([
                "",
                f"❌ 错误信息 ({len(self.errors)}):",
            ])
            for i, error in enumerate(self.errors[:10], 1):
                report_lines.append(f"  {i}. {error}")
            if len(self.errors) > 10:
                report_lines.append(f"  ... 还有 {len(self.errors) - 10} 条错误")
        
        report_lines.extend([
            "",
            "=" * 60,
        ])
        
        return "\n".join(report_lines)


def backup_file(file_path: Path) -> Path:
    """
    备份文件
    
    Args:
        file_path: 要备份的文件路径
        
    Returns:
        Path: 备份文件路径
    """
    if not file_path.exists():
        raise FileNotFoundError(f"文件不存在: {file_path}")
    
    # 生成备份文件名（带时间戳）
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_path = file_path.parent / f"{file_path.stem}_backup_{timestamp}{file_path.suffix}"
    
    # 复制文件
    shutil.copy2(file_path, backup_path)
    print(f"✅ 已备份原始文件: {backup_path}")
    
    return backup_path


def load_courses(file_path: Path) -> List[Dict[str, Any]]:
    """
    加载课程数据
    
    Args:
        file_path: 课程数据文件路径
        
    Returns:
        List[Dict[str, Any]]: 课程数据列表
    """
    if not file_path.exists():
        print(f"⚠️ 文件不存在: {file_path}，返回空列表")
        return []
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            courses = json.load(f)
        
        if not isinstance(courses, list):
            raise ValueError("courses.json 应该是一个数组")
        
        print(f"✅ 成功加载 {len(courses)} 个课程")
        return courses
    
    except json.JSONDecodeError as e:
        print(f"❌ JSON 解析失败: {e}")
        raise
    except Exception as e:
        print(f"❌ 加载文件失败: {e}")
        raise


def analyze_course_data(course: Dict[str, Any], report: CourseMigrationReport) -> Dict[str, str]:
    """
    分析课程数据，检测需要修复的类型问题
    
    Args:
        course: 课程数据
        report: 迁移报告
        
    Returns:
        Dict[str, str]: 检测到的问题
    """
    issues = {}
    
    # 检查 day 字段
    if 'day' in course:
        if not isinstance(course['day'], int):
            issues['day'] = f"类型错误: {type(course['day']).__name__}"
            report.record_type_fix('day')
    
    # 检查 start 字段
    if 'start' in course:
        if not isinstance(course['start'], int):
            issues['start'] = f"类型错误: {type(course['start']).__name__}"
            report.record_type_fix('start')
    
    # 检查 duration 字段
    if 'duration' in course:
        if not isinstance(course['duration'], int):
            issues['duration'] = f"类型错误: {type(course['duration']).__name__}"
            report.record_type_fix('duration')
    
    # 检查 weeks 字段
    if 'weeks' in course:
        if not isinstance(course['weeks'], list):
            issues['weeks'] = f"类型错误: {type(course['weeks']).__name__}"
            report.record_type_fix('weeks')
        elif not all(isinstance(w, int) for w in course['weeks']):
            issues['weeks'] = "数组包含非整数元素"
            report.record_type_fix('weeks')
    
    return issues


def migrate_courses(courses: List[Dict[str, Any]], report: CourseMigrationReport) -> List[Dict[str, Any]]:
    """
    迁移课程数据到标准格式
    
    Args:
        courses: 原始课程数据列表
        report: 迁移报告
        
    Returns:
        List[Dict[str, Any]]: 标准化后的课程数据列表
    """
    report.total_courses = len(courses)
    migrated_courses = []
    
    print(f"\n🔄 开始迁移 {len(courses)} 个课程...")
    
    for i, course in enumerate(courses, 1):
        course_name = course.get('name', f'课程{i}')
        
        try:
            # 分析数据问题
            issues = analyze_course_data(course, report)
            
            if issues:
                print(f"\n⚠️ [{i}/{len(courses)}] {course_name} 存在问题:")
                for field, issue in issues.items():
                    print(f"    - {field}: {issue}")
                    report.add_warning(f"{course_name}: {field} {issue}")
            
            # 应用标准化
            normalized = CourseDataNormalizer.normalize_course_dict(course)
            migrated_courses.append(normalized)
            report.successful_migrations += 1
            
            if not issues:
                print(f"✅ [{i}/{len(courses)}] {course_name} - 已验证")
            else:
                print(f"✅ [{i}/{len(courses)}] {course_name} - 已修复")
        
        except DataNormalizationError as e:
            error_msg = f"{course_name}: {str(e)}"
            print(f"❌ [{i}/{len(courses)}] {error_msg}")
            report.add_error(error_msg)
            report.failed_migrations += 1
        
        except Exception as e:
            error_msg = f"{course_name}: 未知错误 - {str(e)}"
            print(f"❌ [{i}/{len(courses)}] {error_msg}")
            report.add_error(error_msg)
            report.failed_migrations += 1
    
    print(f"\n✅ 迁移完成: {report.successful_migrations}/{report.total_courses} 成功")
    
    return migrated_courses


def save_courses(courses: List[Dict[str, Any]], file_path: Path):
    """
    保存课程数据
    
    Args:
        courses: 课程数据列表
        file_path: 保存路径
    """
    try:
        # 确保目录存在
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        # 保存为格式化的 JSON
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(courses, f, ensure_ascii=False, indent=4)
        
        print(f"✅ 已保存标准化数据: {file_path}")
    
    except Exception as e:
        print(f"❌ 保存文件失败: {e}")
        raise


def save_report(report: CourseMigrationReport, output_dir: Path):
    """
    保存迁移报告
    
    Args:
        report: 迁移报告
        output_dir: 输出目录
    """
    try:
        # 确保目录存在
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # 生成报告文件名
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        report_path = output_dir / f"migration_report_{timestamp}.txt"
        
        # 保存报告
        report_content = report.generate_report()
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report_content)
        
        print(f"✅ 已保存迁移报告: {report_path}")
        
        # 同时打印到控制台
        print(f"\n{report_content}")
    
    except Exception as e:
        print(f"⚠️ 保存报告失败: {e}")
        # 即使保存失败，也打印到控制台
        print(f"\n{report.generate_report()}")


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='课程数据迁移脚本')
    parser.add_argument(
        '--input',
        type=str,
        default='data/courses.json',
        help='输入文件路径（默认: data/courses.json）'
    )
    parser.add_argument(
        '--output',
        type=str,
        default='data/courses.json',
        help='输出文件路径（默认: data/courses.json）'
    )
    parser.add_argument(
        '--no-backup',
        action='store_true',
        help='不创建备份文件'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='试运行模式，不保存文件'
    )
    
    args = parser.parse_args()
    
    # 转换为绝对路径
    input_path = (project_root / args.input).resolve()
    output_path = (project_root / args.output).resolve()
    
    print("=" * 60)
    print("课程数据迁移脚本")
    print("=" * 60)
    print(f"输入文件: {input_path}")
    print(f"输出文件: {output_path}")
    print(f"试运行模式: {'是' if args.dry_run else '否'}")
    print("=" * 60)
    
    try:
        # 1. 备份原始数据
        if not args.no_backup and not args.dry_run and input_path.exists():
            backup_path = backup_file(input_path)
        
        # 2. 加载课程数据
        print("\n📂 加载课程数据...")
        courses = load_courses(input_path)
        
        if not courses:
            print("⚠️ 没有课程数据需要迁移")
            return
        
        # 3. 创建迁移报告
        report = CourseMigrationReport()
        
        # 4. 迁移数据
        migrated_courses = migrate_courses(courses, report)
        
        # 5. 保存标准化数据
        if not args.dry_run:
            if migrated_courses:
                save_courses(migrated_courses, output_path)
            else:
                print("⚠️ 没有成功迁移的课程，不保存文件")
        else:
            print("\n⚠️ 试运行模式，不保存文件")
        
        # 6. 保存并显示报告
        if not args.dry_run:
            save_report(report, project_root / 'data')
        else:
            print(f"\n{report.generate_report()}")
        
        # 7. 返回状态码
        if report.failed_migrations > 0:
            print("\n⚠️ 部分课程迁移失败，请检查报告")
            sys.exit(1)
        else:
            print("\n✅ 所有课程迁移成功！")
            sys.exit(0)
    
    except Exception as e:
        print(f"\n❌ 迁移失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
