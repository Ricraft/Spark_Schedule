# 开发、测试与安全发布

本指南适用于从源码开发 Spark Schedule。当前仓库以 Windows 10/11 64 位为主要桌面目标，最低 Python 版本为 3.10。Vite 7 前端开发/构建需要 Node.js 20.19+ 或 22.12+（推荐受支持的 LTS 版本）。

## 本地开发

在仓库根目录用 PowerShell 创建虚拟环境并安装 Python 运行依赖：

```powershell
py -3.10 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

安装锁文件中声明的前端依赖并生成桌面应用使用的静态文件：

```powershell
npm ci --prefix frontend
npm run build --prefix frontend
```

之后从同一个已启用虚拟环境的终端启动桌面应用：

```powershell
python main.py
```

前端目录为 `frontend/`，构建产物为 `frontend/dist/`。`npm run dev --prefix frontend` 可启动 Vite 开发服务器用于前端单独调试；除非专门配置了桌面桥接代理，不要把此预览当作 PyQt/QWebEngine 集成测试。验证完整桌面流程时先运行前端构建，再启动 Python 桌面入口。

## 测试与静态检查

安装开发依赖：

```powershell
python -m pip install -r requirements-dev.txt
```

前端类型检查、Jest 测试和 ESLint：

```powershell
npm exec --prefix frontend -- tsc --noEmit -p frontend/tsconfig.app.json
npm run test --prefix frontend -- --runInBand
npm run lint --prefix frontend
```

Python 测试与渐进式类型检查：

```powershell
python -m pytest
python run_type_check.py
```

`pyproject.toml` 配置了 `tests/` 为 pytest 搜索目录；仓库现有安全和打包回归测试。若显示“未收集到测试”，不能视为通过。Windows 上如系统默认 pytest 临时目录权限异常，可指定独立目录，例如 `python -m pytest --basetemp=.tmp/pytest-local`。前端迁入后 TypeScript 类型检查、全量 Jest 测试和构建可通过，但 ESLint 对存量代码仍报告大量错误（主要是 `any`、Hooks/Purity 规则）；CI 暂以 TypeScript 类型检查、测试和构建为阻断项，不得把未通过 lint 描述为代码质量达标。发布前应逐步消除 lint 存量并在干净环境复验。

## 常见故障排查

- **启动时报 Python 模块缺失**：确认当前终端已启用项目虚拟环境；使用 `python -m pip install -r requirements.txt` 安装运行依赖。`bs4` 对应 `beautifulsoup4`，旧式 `.xls` 读取需要 `xlrd`；加密备份需要 `cryptography`，性能覆盖层使用 `psutil`。
- **前端空白或资源找不到**：在项目根目录运行 `npm run build --prefix frontend`；确认 `frontend/dist/index.html` 存在。不要用旧的 `dist/`、`react (3)/` 或根目录旧版 `index.html` 代替当前构建目录。
- **`npm ci` 失败**：检查 Node.js/npm 版本是否满足 Vite 7 要求、`frontend/package-lock.json` 是否保留且与 `package.json` 同步；不要为绕过问题删除或重写锁文件。
- **Excel/HTML 导入失败**：确认输入文件真实格式、工作表和表格结构符合导入器支持范围。`.xls` 文件请确认安装了 `xlrd`；HTML 导入不保证兼容任意教务系统页面。分享样例前先删除姓名、学号、课程个人信息和账号令牌。
- **Qt WebEngine 窗口异常**：先从启用了虚拟环境的终端启动，记录错误类型与应用版本；检查 Qt/Python 安装是否来自同一环境。只有在可信发行物验证无误后，才按组织安全流程处理安全软件告警；不要把关闭防护或添加整个开发目录到白名单作为默认解决办法。
- **数据/设置异常**：修改或升级前备份应用当前实际使用的数据目录。不要在未确认文件内容与位置时删除 `data/`；故障日志可能包含本机路径或个人信息，提交问题前先脱敏。

### 加密快照的核查与手动恢复

自动备份及重置前快照是 Fernet 加密的 `.bak`，密钥位于当前用户的 `%LOCALAPPDATA%\SparkSchedule\Security\backup.key`（其他系统使用用户级 XDG/Application Support 目录），**不在发行包或 `backups/` 内**。旧密钥若与新密钥不同，会迁移为同一私有目录下 `backup.legacy.*.key`。跨设备恢复必须安全转移对应密钥；遗失密钥的加密快照无法解密。目前没有应用内的一键恢复入口。

源码环境安装 `requirements.txt` 后，可先只核查快照结构（不写明文）：

```powershell
python recover_backup.py "D:\path\snapshot_pre_reset_YYYYMMDD_HHMMSS.bak"
```

确需手动恢复时，先关闭应用、另行备份现有数据，仅在自己控制的本机私有目录中生成预览；需要显式 `--allow-plaintext` 并输入 `RESTORE`，不会覆盖原文件或修改真实 `data/`：

```powershell
python recover_backup.py "D:\path\snapshot_pre_reset_YYYYMMDD_HHMMSS.bak" --output "$env:LOCALAPPDATA\SparkSchedule\recovery-preview.json" --allow-plaintext
```

预览 JSON **包含全部个人数据和原 API Key**。人工核对 `data` 中各类别后再决定如何迁回，完成后安全处理该明文文件，切勿放入打包目录、工单或云同步文件夹。旧 key 的快照可指定 `--key-file`。此工具只解密及生成预览，**不是自动、事务性数据恢复**。

## Windows 打包

打包依赖属于开发/发布依赖，不是普通运行依赖；`requirements-dev.txt` 提供可选 PyInstaller。构建前需先安装 Python 运行依赖、开发依赖，并执行前端依赖安装和构建。项目 Windows 打包入口应使用当前虚拟环境的 Python/PyInstaller 与 `build_exe_clean.spec`，避免调用机器上其他 Python 的全局 PyInstaller。

发行 spec 的静态数据输入仅为 `resources/` 与 `frontend/dist/`，**绝不打入顶层 `data/`，也不整目录复制含 `backend/data/` 的后端源码树**。PyInstaller 仍会从导入关系收集所需的 Python/Qt 模块；在干净 Windows 环境中启动和检查实际发行目录后再签发。不要把整个仓库或开发目录压缩成发行包。

## 发布前安全清单

1. **先确认授权。** 当前仓库没有可核实的 `LICENSE` 文件，许可证状态待作者/权利人确认。未确认并放入有效许可文本前，不要在发布说明中声称 MIT、非商业授权或其他许可，也不要据此开展再分发。
2. **使用干净且可追溯的源码版本。** 检查提交、分支、版本号和 tag；确认 `.gitignore` 仍覆盖运行数据、虚拟环境、构建产物、日志、缓存与本地密钥文件。
3. **检查输入与构建产物。** 安装前端锁文件依赖、构建 `frontend/dist/`，用同一个 Python 虚拟环境打包。只发布明确指定的发行目录/归档；逐项检查归档内容，确认不存在顶层 `data/`、`backend/data/`、用户数据、`.env`、密钥、调试日志或意外的本地文件。仓库中原已跟踪的 `backend/data/schedule_data.json` 仍须由权利人审查并决定是否移出版本控制；新增 `.gitignore` 不能抹掉已跟踪文件或历史。
4. **在干净环境中验证。** 将发行物复制到没有开发依赖的干净 Windows 环境，验证启动、关键课程/任务工作流与数据隔离。不要因测试通过就删除用户数据或备份。
5. **审阅草稿后发布。** 创建 GitHub Draft Release，核对 tag、标题、发行说明、附件文件名和 SHA-256，再由发布负责人确认后正式发布。不要把删除已发布 Release/tag 当作常规修复步骤；更正已发布版本前先按项目维护流程评估影响。
6. **凭据泄漏按已暴露处理。** 如果密钥曾进入文件、提交、日志或发行物，应通过对应服务撤销并轮换，检查当前文件、Git 历史、PR/缓存和已分发副本。仅删除工作区中的文本不会清除历史记录或其他副本；历史改写、远端清理与密钥撤销须由维护者负责并协调协作者。

CLI 草稿示例（在仓库根目录的 Bash 中执行；先替换版本号、归档路径与说明文件）：

```bash
gh auth status
gh release create vX.Y.Z SparkSchedule-windows.zip \
  --title "Spark Schedule vX.Y.Z" \
  --notes-file RELEASE_DESCRIPTION.md \
  --verify-tag \
  --draft
```

创建草稿前应确认 tag 和附件均已准备好；草稿核查完毕后再由负责人发布。Windows 上可从 PowerShell 运行 `gh`，也可使用仓库的 CLI 说明文档；不要复制过期版本号或未经核实的归档路径。
