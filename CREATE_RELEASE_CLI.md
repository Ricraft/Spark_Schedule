# 使用 GitHub CLI 创建 Draft Release

本指南用于从已经构建并检查过的发行物创建 GitHub 草稿。此处命令不会构建程序，也不会清理项目数据。

## 前置检查

1. 安装 GitHub CLI，并使用 `gh auth login` 登录。
2. 确认授权状态：

   ```bash
   gh auth status
   ```

3. 在发布前确认项目许可证已经由作者/权利人明确；当前仓库没有可核实的 `LICENSE` 文件，授权状态待确认。未确认前不要声称 MIT 或其他授权，也不要发布/再分发。
4. 确认 tag、发行说明和目标归档路径均为本次真实准备的内容。不要直接照抄旧版本号或历史归档名。

## 创建草稿

在仓库根目录的 **Bash** 中运行，先将占位符替换为已核实的值：

```bash
gh release create vX.Y.Z SparkSchedule-windows.zip \
  --title "Spark Schedule vX.Y.Z" \
  --notes-file RELEASE_DESCRIPTION.md \
  --verify-tag \
  --draft
```

反斜杠 `\` 是 Bash 的续行符；不要在 `bash` 代码块中使用 Windows CMD 的 `^`。`--verify-tag` 要求相应 Git tag 已存在，`--draft` 先创建草稿，供负责人核对标题、说明和附件。

发布草稿前，可在 Bash 中检查工作区与 tag：

```bash
git status --short
git diff --check
git show-ref --verify refs/tags/vX.Y.Z
```

生成归档后计算校验值，并将结果放入发行说明或发布记录：

```bash
sha256sum SparkSchedule-windows.zip
```

Windows PowerShell 可用：

```powershell
Get-FileHash .\SparkSchedule-windows.zip -Algorithm SHA256
```

## 发布安全要求

- 只上传明确指定的发行归档。检查归档内容：必须包含当前构建的 `frontend/dist/` 资源；必须排除整个 `data/` 目录及用户数据、`.env`、凭据、调试日志和本机缓存。不要把整个仓库目录直接压缩上传。
- 从干净 Windows 环境启动并验证发行物，核对版本号、tag、说明、附件和 SHA-256 后再正式发布。
- 不要把删除已发布 Release 或远程 tag 作为常规修复步骤；发布错误应先由维护者评估用户影响并按项目版本策略处理。
- 若凭据曾出现在工作区、Git 提交、日志或发行物中，应按已泄漏处理：由维护者在对应服务撤销/轮换，并检查历史记录、PR、缓存和已分发副本。删除当前文件不会清除 Git 历史或其他副本；历史改写与协作者协调需要人工负责。

完整开发、测试和打包前检查见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。
