# Blog workspace

This repository is the single local writing and generated-site workspace. Edit articles in `.hexo/source/_posts/`; `.hexo/` contains the existing Hexo configuration, scripts, assets and locked dependencies. Root HTML is generated output, not a separate writing source. Historical article identities and permanent URLs remain unchanged.

Build with Node.js and the existing pnpm lockfile (the installed Hexo 6.3.0 / Fluid 1.9.9 use this lock, not the older npm/yarn locks):

```sh
cd .hexo
pnpm install --frozen-lockfile
pnpm run build
cd ..
rsync -rc .hexo/public/ ./
git diff --check
```

The owner's 2026-10-01 rule is that this blog has exactly one branch, `main`, locally and remotely. Work directly on `main`, review the source and generated diff, consolidate each delivery into one commit and push `origin/main` unless a later task explicitly forbids pushing. If a secondary branch already exists, first integrate its unique reviewed content into `main`, preserve a private recovery point, verify the remote update, then delete that branch locally and remotely. Do not lose unmerged work or create a new publication branch. The separate code-repository single-root policy does not erase the blog's historical commit chain. Do not manually dispatch, rerun or enable hosted CI; use `[skip ci]` where supported. Automatic Pages publication is separate from test CI. Do not use the retained `.hexo/.deploy_git` cache as another working repository or run `hexo deploy`. A local build or push does not by itself verify the deployed site or CDN. `.hexo/node_modules`, build cache and generated `.hexo/public` are ignored; retained local diagnostic/cache files are not publication inputs.

## 中文说明

Block mathematics emitted by Kramed is handled in `.hexo/templates/math.ejs`, registered through Hexo's view API by `.hexo/scripts/mathjax-view.js`. Its MathJax 3 `findScript` action complements the default inline-delimiter finder. Keep startup and Fluid refresh handling together in this shared partial; do not patch generated pages or `node_modules`.

这里是唯一的本地博客工作目录。只编辑 `.hexo/source/_posts/` 中的源稿，使用上述既有 Hexo 构建命令生成站点；根目录 HTML 不再手工维护成另一份文章。原永久链接与有日期的历史结果保留。

块公式由共享的 `.hexo/templates/math.ejs` 适配 Kramed 与 MathJax 3，保留默认行内识别；启动与 Fluid 刷新逻辑在同一处维护。修改后检查长文滚动、重复刷新和窄屏，不逐页修补生成 HTML。

按用户 2026-10-01 的要求，博客本地和远程永远只保留 `main`。直接在 `main` 工作，每次交付合成一个提交并推送 `origin/main`；后续明确禁止推送时以新指令为准。已有其他分支时，先将独有且已审阅的内容收进 `main`，保留私有恢复点，核验远端更新后再删除本地和远端分支，不能为满足分支数量丢掉未合并工作，也不新建发布分支。代码仓库的单根提交规则不自动抹去博客历史。不主动启动、重跑或启用云端 CI，在支持时使用 `[skip ci]`；Pages 自动发布与测试 CI 分开报告。不使用保留的 `.hexo/.deploy_git` 缓存另行发布。构建成功或推送成功不等于已验证线上部署及 CDN。依赖、构建缓存与本地诊断文件不进入发布内容。
