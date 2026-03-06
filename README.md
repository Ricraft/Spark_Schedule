# Spark Schedule

一个基于 PyQt6 的课程表管理应用程序。

## 功能特性

- 课程管理：添加、编辑、删除课程信息
- 课表视图：直观的周视图展示
- 任务管理：待办事项和学习任务跟踪
- GPA 计算：成绩记录和 GPA 统计
- 数据导入：支持从 Excel 等格式导入课程数据
- 主题定制：支持自定义颜色主题

## 安装

1. 克隆仓库：
```bash
git clone https://github.com/yourusername/Spark_Schedule.git
cd Spark_Schedule
```

2. 安装依赖：
```bash
pip install -r requirements.txt
```

## 运行

```bash
python main.py
```

或使用启动脚本：
```bash
start.bat
```

## 项目结构

```
Spark_Schedule/
├── main.py              # 主程序入口
├── bridge.py            # 前后端桥接
├── logger_setup.py      # 日志配置
├── src/                 # 源代码
│   ├── ui/             # UI 组件
│   ├── utils/          # 工具函数
│   ├── models/         # 数据模型
│   └── storage/        # 数据存储
├── backend/            # 后端逻辑
│   ├── core/          # 核心功能
│   ├── models/        # 数据模型
│   ├── services/      # 服务层
│   ├── importers/     # 数据导入器
│   └── utils/         # 工具函数
├── assets/            # 前端资源
├── resources/         # 应用资源
├── scripts/           # 辅助脚本
└── data/              # 数据目录（不包含在版本控制中）
```

## 数据文件

首次运行时，应用会在 `data/` 目录下创建必要的数据文件。该目录不包含在版本控制中，以保护个人数据。

## 开发

本项目使用 Python 3.8+ 和 PyQt6 开发。

## 许可证

MIT License
