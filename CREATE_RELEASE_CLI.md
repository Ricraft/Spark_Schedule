# 📦 使用 GitHub CLI 创建 Release

如果网页创建遇到问题，可以使用 GitHub CLI（命令行工具）创建 Release。

## 前置要求

1. 安装 GitHub CLI：https://cli.github.com/
2. 登录 GitHub：`gh auth login`

## 创建 Release 命令

在 `Spark_Schedule` 目录下运行：

```bash
gh release create v2.3.0 ^
  SparkSchedule-v2.3.0-Windows.zip ^
  --title "✨ Spark Schedule v2.3.0 - 点燃学习热情" ^
  --notes-file RELEASE_DESCRIPTION.md ^
  --latest
```

## 命令说明

- `v2.3.0` - Release 版本号（使用已有的 tag）
- `SparkSchedule-v2.3.0-Windows.zip` - 要上传的文件
- `--title` - Release 标题
- `--notes-file` - 使用文件作为 Release 说明
- `--latest` - 标记为最新版本

## 验证 Release

创建成功后，访问：
https://github.com/Ricraft/Spark_Schedule/releases

## 如果需要删除并重新创建

```bash
# 删除 Release（保留 tag）
gh release delete v2.3.0 --yes

# 重新创建
gh release create v2.3.0 SparkSchedule-v2.3.0-Windows.zip --title "✨ Spark Schedule v2.3.0 - 点燃学习热情" --notes-file RELEASE_DESCRIPTION.md --latest
```

## 如果需要删除 tag

```bash
# 删除本地 tag
git tag -d v2.3.0

# 删除远程 tag
git push origin :refs/tags/v2.3.0

# 重新创建 tag
git tag -a v2.3.0 -m "✨ Spark Schedule v2.3.0 - 点燃学习热情"
git push origin v2.3.0
```
