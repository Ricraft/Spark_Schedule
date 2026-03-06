<div align="center">

# ✨ Spark Schedule

### 点燃你的学习热情，让每一天都闪耀光芒

*唤醒你的校园时光 · 用 AI 和现代化设计重新定义课程管理体验*

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![PyQt6](https://img.shields.io/badge/PyQt6-6.6+-green.svg)](https://www.riverbankcomputing.com/software/pyqt/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows-lightgrey.svg)](https://github.com/Ricraft/Spark_Schedule)

</div>

---

## ✨ 什么是 Spark Schedule？

Spark Schedule 不只是一个课程表工具，它是你学习生活的智能伙伴！就像火花 ✨ 点燃激情，Spark 让你的每一天都充满动力和方向。

🎯 **精准规划** · 📊 **数据可视** · 🎨 **个性定制** · 🚀 **高效管理**

### 核心理念

- **✨ 极致美学设计** - 采用 Modern UI 设计语言，支持沉浸式背景、亚克力半透明磨砂质感与自定义配色
- **⚡ 智能高效导入** - 支持 HTML、Excel 及文本文件一键导入，告别繁琐的手动录入
- **🎨 深度个性定制** - 从每日节数到详细作息时间，从单双周设置到课程颜色，一切皆可随心定义
- **💡 贴心课程助理** - 支持系统托盘常驻与课前自动提醒，确保你不会错过任何一节重要课程

---

## 🌟 核心特性

### 📅 智能课表管理
- ⚡ **快速添加课程** - 一键导入，支持多种格式（Excel、HTML、文本）
- 🔄 **灵活编辑** - 拖拽调整，实时预览
- 📍 **精准定位** - 自动识别教室、教师信息
- 🎨 **色彩标记** - 为每门课程设置专属颜色，一目了然

### ✅ 任务追踪系统
- 📝 **待办清单** - 记录作业、考试、项目截止日期
- ⏰ **智能提醒** - 永远不会错过重要事项
- 🎯 **优先级管理** - 合理安排学习计划
- ✨ **完成激励** - 每次打勾都是一次小小的胜利

### 📈 GPA 成绩统计
- 🏆 **实时计算** - 自动统计学期 GPA
- 📊 **可视化图表** - 成绩趋势一目了然
- 🎓 **学分管理** - 精确追踪已修学分
- 💡 **智能分析** - 了解你的学习状态

### �️ 生活助手
- �️ **实时天气** - 接入和风天气 API，掌握每日天气变化
- � **每日诗词** - 今日诗词 API 加持，开启充满诗意的一天
- � **课前提醒** - 桌面通知，不错过任何课程
- 🎯 **托盘常驻** - 静默守护，随时唤醒

### 🎨 个性化定制
- 🌈 **主题切换** - 多种配色方案随心选
- 🖌️ **自定义颜色** - 打造专属你的课表风格
- 📱 **响应式布局** - 完美适配不同屏幕
- ⚙️ **灵活配置** - 每个细节都可调整

---

## 🚀 快速开始

### 📦 安装

```bash
# 克隆仓库
git clone https://github.com/Ricraft/Spark_Schedule.git
cd Spark_Schedule

# 安装依赖
pip install -r requirements.txt
```

### ⚡ 运行

```bash
# 方式 1: 直接运行
python main.py

# 方式 2: 使用启动脚本（Windows）
start.bat

# 方式 3: 最小化启动
start_minimized.bat
```

### 🎬 首次使用

1. **导入课程** - 从教务系统导出课表，一键导入
2. **设置主题** - 选择你喜欢的配色方案
3. **添加任务** - 记录本周的待办事项
4. **开始使用** - 让 Spark 点燃你的学习热情！

---

## 🏗️ 项目架构

```
✨ Spark_Schedule/
│
├── 🎯 main.py                 # 应用入口 - 点燃 Spark
├── 🌉 bridge.py               # 前后端桥接 - 连接一切
├── 📝 logger_setup.py         # 日志系统 - 记录每一刻
│
├── 🎨 src/                    # 前端源码
│   ├── ui/                   # 界面组件 - 美观易用
│   ├── models/               # 数据模型 - 结构清晰
│   ├── storage/              # 数据存储 - 安全可靠
│   └── utils/                # 工具函数 - 高效便捷
│
├── ⚙️ backend/                # 后端逻辑
│   ├── core/                 # 核心功能 - 强大引擎
│   ├── models/               # 业务模型 - 灵活扩展
│   ├── services/             # 服务层 - 诗词天气
│   ├── importers/            # 导入器 - 多格式支持
│   └── utils/                # 工具集 - 性能优化
│
├── 🎭 assets/                 # 前端资源 - 精美界面
├── 🖼️ resources/              # 应用资源 - 图标素材
├── 🔧 scripts/                # 辅助脚本 - 便捷工具
└── 💾 data/                   # 数据目录 - 你的专属空间
```

---

## 🎯 技术栈

- **🐍 Python 3.8+** - 强大的后端支持
- **🎨 PyQt6** - 现代化的 GUI 框架
- **🌐 PyQt6-WebEngine** - 流畅的 Web 集成
- **📊 Requests** - 可靠的网络请求
- **📑 OpenPyXL** - Excel 文件处理

---

## 💡 使用场景

- 📚 **大学生** - 管理复杂的课程安排
- 🎓 **研究生** - 平衡课程与科研
- 👨‍🏫 **教师** - 规划教学日程
- 📖 **自学者** - 制定学习计划

---

## 🤝 贡献指南

我们欢迎所有形式的贡献！

- 🐛 **报告 Bug** - 帮助我们改进
- 💡 **提出建议** - 分享你的想法
- 🔧 **提交代码** - 让 Spark 更强大
- 📖 **完善文档** - 帮助更多人

---

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源协议

---

## 🙏 特别感谢

Spark Schedule 的诞生离不开以下开源项目和社区的支持：

### 核心技术栈
- **[Python](https://www.python.org/)** - 强大而优雅的编程语言
- **[PyQt6](https://www.riverbankcomputing.com/software/pyqt/)** - 现代化的跨平台 GUI 框架
- **[Qt Framework](https://www.qt.io/)** - 世界级的应用程序开发框架

### 功能支持
- **[Requests](https://requests.readthedocs.io/)** - 优雅的 HTTP 库
- **[OpenPyXL](https://openpyxl.readthedocs.io/)** - Excel 文件处理利器

### API 服务
- **[和风天气](https://www.qweather.com/)** - 提供实时天气数据服务
- **[今日诗词](https://www.jinrishici.com/)** - 每日一句古诗词推荐

### 设计灵感
- **Modern UI Design** - 微软 Fluent Design System
- **Material Design** - Google 设计语言
- **Acrylic Effect** - Windows 11 视觉风格

### 社区贡献
感谢所有提出建议、报告问题和贡献代码的开发者们！你们的每一份支持都让 Spark 更加闪耀 ✨

---

## 🌟 Star History

如果 Spark Schedule 对你有帮助，请给我们一个 ⭐ Star！

你的支持是我们持续改进的动力 🚀

---

<div align="center">

### 让 Spark ✨ 点燃你的学习之路

**Made with ❤️ by Ricraft & Open Source Community**

*让每一次查看课程，都成为唤醒活力的一刻*

[报告问题](https://github.com/Ricraft/Spark_Schedule/issues) · [功能建议](https://github.com/Ricraft/Spark_Schedule/issues) · [加入讨论](https://github.com/Ricraft/Spark_Schedule/discussions)

---

**Copyright © 2024-2025 All Rights Reserved**

</div>
