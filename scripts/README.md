# 课程数据迁移脚本使用指南

## 概述

`migrate_course_data.py` 是一个用于将现有课程数据迁移到标准化格式的工具。它可以自动修复数据类型问题，确保所有课程数据符合系统要求。

## 功能特性

- ✅ **自动类型转换**: 将字符串、浮点数转换为正确的整数类型
- ✅ **周次格式标准化**: 支持多种周次格式（"1-16"、"1,3,5"、数组等）
- ✅ **数据备份**: 自动备份原始数据（可选）
- ✅ **详细报告**: 生成完整的迁移报告，包含统计信息和问题详情
- ✅ **试运行模式**: 可以先验证数据而不实际修改文件

## 使用方法

### 基本用法

```bash
# 迁移默认的 courses.json 文件
python scripts/migrate_course_data.py
```

### 指定输入输出文件

```bash
# 指定输入和输出文件
python scripts/migrate_course_data.py --input data/old_courses.json --output data/new_courses.json
```

### 试运行模式

```bash
# 只检查数据，不保存文件
python scripts/migrate_course_data.py --dry-run
```

### 不创建备份

```bash
# 不创建备份文件（不推荐）
python scripts/migrate_course_data.py --no-backup
```

## 命令行参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--input` | 输入文件路径 | `data/courses.json` |
| `--output` | 输出文件路径 | `data/courses.json` |
| `--no-backup` | 不创建备份文件 | False |
| `--dry-run` | 试运行模式，不保存文件 | False |

## 数据格式说明

### 支持的输入格式

脚本可以处理以下格式的数据：

#### 1. 字符串类型的数字字段
```json
{
    "day": "1",
    "start": "3",
    "duration": "2"
}
```

#### 2. 浮点数类型的数字字段
```json
{
    "day": 1.0,
    "start": 3.0,
    "duration": 2.0
}
```

#### 3. 字符串格式的周次
```json
{
    "weeks": "1-16"  // 范围格式
}
```

```json
{
    "weeks": "1,3,5,7,9"  // 逗号分隔格式
}
```

### 标准输出格式

迁移后的数据将符合以下标准：

```json
{
    "id": "uuid-string",
    "name": "课程名称",
    "teacher": "教师姓名",
    "location": "上课地点",
    "day": 1,              // 整数 1-7
    "start": 3,            // 整数 >= 1
    "duration": 2,         // 整数 >= 1
    "weeks": [1,2,3,...],  // 整数数组
    "week_list": [1,2,3,...],  // 与weeks一致
    "color": "#RRGGBB",
    "groupId": "group-id" | null,
    "note": "备注" | null
}
```

## 迁移报告

脚本会生成详细的迁移报告，包含：

- 📊 **统计信息**: 总课程数、成功/失败数量、成功率
- 🔧 **类型修复统计**: 各字段的修复次数
- ⚠️ **警告信息**: 检测到的数据问题
- ❌ **错误信息**: 无法修复的严重问题

报告示例：

```
============================================================
课程数据迁移报告
============================================================
迁移时间: 2026-02-07 17:19:09

📊 统计信息:
  总课程数: 3
  成功迁移: 3
  失败迁移: 0
  成功率: 100.0%

🔧 类型修复统计:
  day: 2 次修复
  start: 2 次修复
  duration: 2 次修复
  weeks: 2 次修复

⚠️ 警告信息 (8):
  1. 测试课程1: day 类型错误: str
  2. 测试课程1: start 类型错误: str
  ...
============================================================
```

## 备份文件

如果启用备份（默认），脚本会创建带时间戳的备份文件：

```
data/courses_backup_20260207_171909.json
```

## 错误处理

### 可恢复错误

以下错误会被自动修复，使用默认值：

- 类型转换失败 → 使用默认值
- 周次格式错误 → 使用默认周次 [1]
- 节次解析失败 → 使用默认节次 1

### 不可恢复错误

以下错误会导致课程被跳过：

- 课程名称为空
- 课程ID缺失
- 数据严重损坏

## 最佳实践

1. **先试运行**: 使用 `--dry-run` 先检查数据
2. **保留备份**: 不要使用 `--no-backup`，以防需要回滚
3. **检查报告**: 仔细阅读迁移报告，确认所有修复都符合预期
4. **验证结果**: 迁移后在应用中测试课程显示是否正确

## 示例工作流

```bash
# 1. 先试运行，查看会有哪些修改
python scripts/migrate_course_data.py --dry-run

# 2. 如果结果符合预期，执行实际迁移
python scripts/migrate_course_data.py

# 3. 检查生成的报告
cat data/migration_report_*.txt

# 4. 在应用中验证课程数据
```

## 故障排查

### 问题：脚本报告"文件不存在"

**解决方案**: 确认输入文件路径正确，使用相对于项目根目录的路径。

### 问题：迁移后课程显示不正确

**解决方案**: 
1. 检查迁移报告中的警告信息
2. 使用备份文件恢复原始数据
3. 手动检查问题课程的数据格式

### 问题：部分课程迁移失败

**解决方案**: 
1. 查看报告中的错误信息
2. 检查失败课程的原始数据
3. 手动修复必填字段（name、id）后重新运行

## 技术细节

### 依赖模块

- `backend.utils.data_normalizer`: 数据标准化核心逻辑
- Python 标准库: json, os, sys, shutil, datetime, pathlib

### 标准化规则

脚本使用 `CourseDataNormalizer` 类进行数据标准化，遵循以下规则：

1. **day**: 转换为 1-7 的整数
2. **start**: 转换为 >= 1 的整数
3. **duration**: 转换为 >= 1 的整数
4. **weeks**: 转换为整数数组，支持多种输入格式
5. **week_list**: 与 weeks 保持一致

## 相关文档

- [数据标准化设计文档](../.kiro/specs/data-format-fix/design.md)
- [数据格式修复需求文档](../.kiro/specs/data-format-fix/requirements.md)
- [CourseDataNormalizer API文档](../backend/utils/data_normalizer.py)

## 支持

如有问题或建议，请查看项目文档或联系开发团队。


url：https://fucaixie.xyz
密钥:sk-LsDFOVj68L0W1PUy1PKdCo4JB7JAEBDSQW3eom1X9CDWYZKx
部分教程：https://jiaocheng.8888891.xyz
等百款
老板 新年快乐 新的一年发发发 除了这个模型还有好多模型 一天的话 我没有限制全部可以用 麻烦你给我一个好评吧 确定收货一下 谢谢