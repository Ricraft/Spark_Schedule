# Spark Schedule

Spark Schedule 是一个以 Python / PyQt6 为桌面外壳、以 React + TypeScript 为界面的课程与任务管理应用。Python 侧负责桌面窗口、桥接和应用逻辑；Vite 将前端源码编译到 `frontend/dist/`，桌面入口使用该构建产物。

> 本文仅介绍仓库中可确认的主要工作流。番茄计时、GPA、学分统计等功能未在此次文档更新中核实，不作为已确认的功能承诺。

## 主要功能

- 课程表浏览与编辑、周次和作息相关设置。
- 从受支持结构的 Excel 文件或 HTML 导入课程；解析结果取决于导出格式和课程表结构，不保证兼容所有学校/教务系统。`.xls` 读取需要 `xlrd`。
- 任务与待办事项管理。
- PyQt6 桌面窗口与本地前端之间的桥接。

## 环境要求

- Windows 10/11 64 位为主要目标环境；其他平台未承诺兼容。
- Python **3.10 或更高版本**。
- Node.js 与 npm：仅在开发或构建前端时需要。当前 Vite 7 工具链要求 Node.js 20.19+ 或 22.12+；推荐使用受支持的 LTS 版本。
- Git（仅在从源码克隆时需要）。

运行已构建的桌面应用不需要 Node.js；从源码启动前，需要先准备 `frontend/dist/`。

## 从源码安装与启动

以下命令以 Windows PowerShell 为例，在仓库根目录执行：

```powershell
# 建立并启用虚拟环境
py -3.10 -m venv .venv
.\.venv\Scripts\Activate.ps1

# 安装 Python 运行依赖
python -m pip install --upgrade pip
python -m pip install -r requirements.txt

# 安装前端锁定依赖并构建桌面应用使用的界面
npm ci --prefix frontend
npm run build --prefix frontend

# 启动桌面应用
python main.py
```

如需开发依赖（测试、静态检查及可选打包工具）：

```powershell
python -m pip install -r requirements-dev.txt
```

前端源码位于 `frontend/`。可用 `npm run dev --prefix frontend` 启动 Vite 开发服务器做前端单独调试；该预览不等同于 PyQt 桌面集成运行，桌面桥接相关行为请先构建前端，再运行 `python main.py`。完整开发、测试和发布流程见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。

## 项目结构

```text
main.py                 PyQt6 桌面入口
bridge.py               Python 与前端之间的桌面桥接
backend/                课程、任务、设置、导入等 Python 模块
frontend/src/            React / TypeScript 前端源码
frontend/dist/           Vite 构建产物；桌面应用从此处加载前端
scripts/                辅助脚本
requirements.txt         Python 运行依赖
requirements-dev.txt     Python 开发与可选打包依赖
data/                    本地运行时数据（如存在）；禁止纳入发行包
```

## 数据与隐私

课程表、任务和设置可能包含个人信息。发布前不要提交、上传或打包本地 `data/` 内容、日志、`.env` 文件、访问令牌或其他私密数据。升级前先确认应用当前使用的数据位置并备份；不要把整个开发目录直接作为发行物。加密快照依赖当前用户独立保存的密钥，缺少密钥无法恢复；`recover_backup.py` 仅能核查快照或在明确确认后生成需妥善保护的明文预览，详见 [开发文档](docs/DEVELOPMENT.md#加密快照的核查与手动恢复)。

## 测试与故障排查

前端 Jest 测试、Python 测试现状、常见启动/导入问题与发布前检查见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。文档更新本身不会替代应用测试；发布前应在干净环境中单独验证。

## 授权状态

**待项目作者/权利人确认。** 当前仓库未提供可核实的 `LICENSE` 文件；旧文档或徽章中出现的 MIT、非商业使用等说法不构成已确认的授权依据。本 README 不新增或推定任何许可证。发布、再分发或接受外部贡献前，请先由权利人确认并提供明确许可文本。
