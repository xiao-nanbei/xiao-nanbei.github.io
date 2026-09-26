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

Review the generated diff before an explicitly authorized ordinary Git commit/push. Do not use the retained `.hexo/.deploy_git` cache as another working repository or run `hexo deploy`; publication uses this repository's `origin`. A local build or push does not by itself verify the deployed site or CDN. `.hexo/node_modules`, build cache and generated `.hexo/public` are ignored; retained local diagnostic/cache files are not publication inputs.

## 中文说明

这里是唯一的本地博客工作目录。只编辑 `.hexo/source/_posts/` 中的源稿，使用上述既有 Hexo 构建命令生成站点；根目录 HTML 不再手工维护成另一份文章。原永久链接与有日期的历史结果保留。

审阅生成差异后，按本轮明确授权普通提交并推送本仓库，不使用保留的 `.hexo/.deploy_git` 缓存另行发布。构建成功或推送成功不等于已验证线上部署及 CDN。依赖、构建缓存与本地诊断文件不进入发布内容。
