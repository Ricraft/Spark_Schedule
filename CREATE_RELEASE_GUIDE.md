# 📦 创建 GitHub Release 指南

## 步骤 1: 访问 Release 页面

访问：https://github.com/Ricraft/Spark_Schedule/releases/new

**如果看不到 v2.3.0 tag**，请刷新页面（Ctrl+F5）

## 步骤 2: 选择 Tag

1. 点击 "Choose a tag" 下拉框
2. 在列表中找到并选择 `v2.3.0`
3. 如果没有看到，输入 `v2.3.0` 然后选择 "Create new tag: v2.3.0 on publish"

## 步骤 3: 填写 Release 信息

### Release 标题
```
✨ Spark Schedule v2.3.0 - 点燃学习热情
```

### 描述内容
复制以下内容到描述框：

```markdown
# ✨ Spark Schedule v2.3.0 - 点燃学习热情

一款专为大学生打造的智能课程表管理系统，采用 Modern UI 设计，支持多格式导入、个性化定制和智能提醒。

## 🎯 核心特性

- **✨ 极致美学** - Modern UI 设计，亚克力半透明效果，自定义背景
- **⚡ 智能导入** - 支持 HTML/Excel/文本，一键导入教务系统课表
- **🎨 深度定制** - 自定义作息时间、课程颜色、单双周设置
- **🌤️ 生活助手** - 实时天气、每日诗词、课前提醒、托盘常驻
- **📊 数据管理** - 任务清单、GPA 统计、学分追踪

## 📦 下载说明

下载 `SparkSchedule-v2.3.0-Windows.zip` (约 284 MB)，解压后运行 `SparkSchedule.exe` 即可使用。

**系统要求**：Windows 10/11 (64-bit)

## 🚀 快速开始

1. 解压下载的 ZIP 文件
2. 双击运行 `SparkSchedule.exe`
3. 导入课表或手动添加课程
4. 在设置中调整外观和功能
5. 开始享受高效的课程管理！

## 📝 主要更新

- ✨ 全新 Modern UI 设计语言
- 🌤️ 集成和风天气 API
- 📖 集成今日诗词 API
- 🎨 新增三种表头风格切换
- 🚀 优化导入性能和数据存储
- 🐛 修复多个已知问题

---

**让 Spark ✨ 点燃你的学习之路**

如有问题或建议，欢迎在 [Issues](https://github.com/Ricraft/Spark_Schedule/issues) 中反馈！
```

## 步骤 4: 上传文件

点击 "Attach binaries by dropping them here or selecting them" 区域，上传：

- `SparkSchedule-v2.3.0-Windows.zip` (位于项目根目录)

**重要**：等待文件上传完成（会显示绿色勾号）

## 步骤 5: 发布设置

- ✅ 勾选 "Set as the latest release"
- ✅ 勾选 "Create a discussion for this release" (可选)

## 步骤 6: 发布

点击 "Publish release" 按钮完成发布！

---

## 常见问题

### Q: 提示 "tag name can't be blank"
**A**: 确保在 "Choose a tag" 下拉框中选择了 `v2.3.0`，不要留空

### Q: 看不到 v2.3.0 tag
**A**: 
1. 刷新页面（Ctrl+F5）
2. 或者直接输入 `v2.3.0` 并选择 "Create new tag"

### Q: 文件上传失败
**A**: 
1. 检查文件大小（应该约 284 MB）
2. 确保网络连接稳定
3. 可以尝试使用 GitHub CLI 上传

---

## 发布后

1. 在 README.md 中添加下载链接
2. 在社交媒体分享发布信息
3. 通知用户更新

## 文件位置

- 压缩包：`Spark_Schedule/SparkSchedule-v2.3.0-Windows.zip`
- 完整说明：`Spark_Schedule/RELEASE_NOTES_v2.3.0.md`
- 简短说明：`Spark_Schedule/RELEASE_DESCRIPTION.md`
