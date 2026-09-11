# GitHub CI 与手动部署

当前交付是第一关静态网站的构建与镜像发布配置，不包含服务器部署结果。第二关制作文件尚未接入游戏。生产不需要 Node.js、PlayCanvas 账号或外部 CDN，容器通过 Nginx 提供打包后的页面、GLB 和本地 Ammo。

## GitHub 设置

仓库：`https://github.com/zjj873994125/marble-lab`，发布分支为 `main`。

1. 在仓库 Actions 中启用工作流；仓库或组织策略需允许本工作流使用的 `actions/*` 与 `docker/*` Actions。
2. 工作流每次 push / pull request 执行 Node.js 22 下的 `npm ci`、`npm test`、`npm run build`。只有 push 到 `main` 且检查通过，才构建并推送镜像。
3. 发布使用 GitHub 自动提供的 `GITHUB_TOKEN`，工作流已声明 `contents: read` 与发布任务的 `packages: write`，无需添加服务器密码或个人发布令牌。如果组织限制包写入权限，需要仓库管理员允许；已有同名包还需在包设置中授予本仓库 Actions 访问权。
4. 首次成功发布后，在个人 Packages 中检查 `marble-lab` 的可见性。源码公开不保证 GHCR 包自动公开。需要匿名拉取时由你将包设为 Public；保留 Private 时按下文登录。

镜像为 `ghcr.io/zjj873994125/marble-lab`，提供 `latest`（最近通过的 main 提交）与 `sha-<完整提交 SHA>`（固定版本）。当前发布平台为 `linux/amd64`，供常见 x86_64 Linux 服务器使用；ARM 服务器需要另行增加镜像平台。CI 发布镜像不会自动更新服务器。

## 首次部署

在服务器准备一个独立目录，只需将仓库根目录的 `compose.yaml` 放进去。以下命令均由你在该目录执行；本次不会连接或修改服务器。

公开包无需登录。私有包先准备具有 `read:packages` 权限且可访问该包的 GitHub token，通过标准输入登录，勿将令牌写进 Compose、Git 或命令历史：

```bash
read -r -s -p 'GHCR token: ' MARBLE_GHCR_TOKEN; printf '\n'
printf '%s' "$MARBLE_GHCR_TOKEN" | docker login ghcr.io -u zjj873994125 --password-stdin
unset MARBLE_GHCR_TOKEN
```

以上登录示例使用 Bash。随后启动：

```bash
docker compose pull
docker compose up -d
docker compose ps
curl --fail http://127.0.0.1:28083/healthz
```

预期 healthz 返回 `ok`、容器状态为 `healthy`。由你确认服务器安全组和防火墙允许 TCP 28083，浏览器访问 `http://101.42.154.80:28083/`。Compose 固定映射 `28083:80`，不需要改动宿主机现有 Nginx。

## 更新与回退

先确认 GitHub Actions 的 `CI and container` 成功，再在相同目录手动执行：

```bash
docker compose pull
docker compose up -d
docker compose ps
```

需要固定或回退版本时，在服务器部署目录的 `.env` 写一行 `MARBLE_IMAGE=ghcr.io/zjj873994125/marble-lab:sha-<目标完整提交SHA>`，然后执行相同的 pull / up 命令。删除该行即可重新跟随 `latest`。目标标签必须已成功发布且仍保留在 GHCR 中。查看日志使用 `docker compose logs --tail=100 marble-lab`。

## 本地验证与存储边界

```bash
npm ci
npm test
npm run build
docker build -t marble-lab:local .
docker compose config --quiet
```

本地开发端口保持用户设置的 5177；5173 是其他项目。镜像只包含静态构建结果，不包含 Blender 源文件、制作报告、Git 历史或 node_modules。Nginx 为带哈希的 `/assets/` 提供长期缓存，`index.html`、同名 `/models/` 和 `/vendor/` 每次校验；缺失模型、Ammo 和构建资源返回 404，WASM 使用 `application/wasm`。

成绩和设置仍保存在玩家浏览器当前 origin 下，容器更新不主动清除它们。`127.0.0.1:5177` 与服务器 `101.42.154.80:28083` 是不同 origin，浏览器不会自动把本地成绩带到服务器地址；切换域名、协议或端口也会使用不同存储。当前没有账号、云存档或自动迁移功能。

`npm test` 与构建通过只证明自动检查和打包成功，不替代当前平端锤版本的全路线、手感、滚动视觉及跨浏览器体验验收。
