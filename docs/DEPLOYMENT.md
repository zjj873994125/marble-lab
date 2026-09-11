# GitHub CI 与自动部署

工作流依次执行测试构建、镜像发布和 SSH 自动部署。需完成下列 Secrets 与服务器准备后才可真实部署；配置完成不等于服务器已经上线。第二关制作文件尚未接入游戏。生产不需要 Node.js、PlayCanvas 账号或外部 CDN，容器通过 Nginx 提供打包后的页面、GLB 和本地 Ammo。

## GitHub 设置

仓库：`https://github.com/zjj873994125/marble-lab`，发布分支为 `main`。

1. 在仓库 Actions 中启用工作流；仓库或组织策略需允许本工作流使用的 `actions/*` 与 `docker/*` Actions。
2. 工作流每次 push / pull request 执行 Node.js 22 下的 `npm ci`、`npm test`、`npm run build`。只有 push 到 `main` 且检查通过，才构建并推送镜像。
3. 发布使用 GitHub 自动提供的 `GITHUB_TOKEN`，工作流已声明 `contents: read` 与发布任务的 `packages: write`，无需添加服务器密码或个人发布令牌。如果组织限制包写入权限，需要仓库管理员允许；已有同名包还需在包设置中授予本仓库 Actions 访问权。
4. 首次成功发布后，在个人 Packages 中检查 `marble-lab` 的可见性。源码公开不保证 GHCR 包自动公开。需要匿名拉取时由你将包设为 Public；保留 Private 时按下文登录。

镜像为 `ghcr.io/zjj873994125/marble-lab`，提供 `latest`（最近通过的 main 提交）与 `sha-<完整提交 SHA>`（固定版本）。当前发布平台为 `linux/amd64`，供常见 x86_64 Linux 服务器使用；ARM 服务器需要另行增加镜像平台。

## 自动部署配置（一次性）

在仓库 **Settings → Secrets and variables → Actions → New repository secret** 中配置。服务器地址、登录用户和部署目录均由 GitHub Secrets 提供，工作流不设置默认值：

- `DEPLOY_HOST`：**必填**，服务器 IP 或域名。
- `DEPLOY_USER`：**必填**，SSH 登录用户名。
- `DEPLOY_PORT`：SSH 端口，未填写时使用 22。游戏访问端口 28083 不是 SSH 端口。
- `DEPLOY_PATH`：**必填**，本项目独立部署目录的绝对路径，仅接受英文、数字、下划线、短横线、点和斜杠；不要填其他项目目录。
- `DEPLOY_SSH_KEY`：**必填**，部署专用 SSH 私钥全文，包括 BEGIN/END 行。对应公钥需加入服务器该用户的 `~/.ssh/authorized_keys`；CI 使用无需交互输入密码的专用密钥。
- `DEPLOY_KNOWN_HOSTS`：**必填**，已核验的服务器 SSH 主机公钥记录，使用 OpenSSH known_hosts 格式。工作流严格校验服务器身份，不在部署时盲目信任扫描结果。

已有的 GitHub 仓库 SSH 密钥和服务器 SSH 登录密钥是两种用途，服务器部署需要后者。私钥只填写在 Secrets，不放入仓库或聊天。

可在你自己的终端执行 `ssh-keyscan -p <SSH端口> <服务器地址>` 获取候选主机公钥记录，通过云服务器控制台等可信渠道核对指纹后再填入 `DEPLOY_KNOWN_HOSTS`。非 22 端口的记录应保留 `[主机]:端口` 形式。

服务器需预装 Docker、Docker Compose v2（支持 `up --wait --wait-timeout`）和 Bash。部署用户需能非交互执行 Docker、创建或写入部署目录，并能访问 GHCR；脚本不自动提权或安装服务器软件。私有镜像还需按下节，用**同一部署用户**提前执行一次 `docker login ghcr.io`；公开包无需登录。

配置完成并推送工作流后，每次 `main` 提交会依次执行 `check → publish → deploy`。部署上传本次提交的 Compose，拉取精确的 `sha-<本次提交>` 镜像，更新固定 Compose 项目 `marble-lab`，等待容器健康检查（最多 120 秒）。成功后将实际镜像记录在服务器 `release.env`。PR 和其他分支只做检查，不部署。首次因 Secrets 缺失失败后，补齐配置可在 Actions 中重新运行失败任务。

main 的工作流串行执行，不因新推送中断正在进行的部署。拉取失败会保留运行中的旧容器；更新后的健康检查失败会使任务失败，需要查看日志并按下文手动回退，当前没有自动回滚。不要仅凭 `check` 或 `publish` 成功认定上线成功，应确认 `deploy` 也成功。

## 服务器准备与手动部署备用

自动部署会上传 Compose，无需手动复制。以下为你在服务器部署目录执行的登录与手动操作；若先手动部署，需要将仓库根目录的 `compose.yaml` 放入该目录。手动和自动部署统一使用项目名 `marble-lab`，避免重复启动占用 28083。

公开包无需登录。私有包先准备具有 `read:packages` 权限且可访问该包的 GitHub token，通过标准输入登录，勿将令牌写进 Compose、Git 或命令历史：

```bash
read -r -s -p 'GHCR token: ' MARBLE_GHCR_TOKEN; printf '\n'
printf '%s' "$MARBLE_GHCR_TOKEN" | docker login ghcr.io -u zjj873994125 --password-stdin
unset MARBLE_GHCR_TOKEN
```

以上登录示例使用 Bash。随后启动：

```bash
docker compose -p marble-lab pull
docker compose -p marble-lab up -d --wait --wait-timeout 120
docker compose -p marble-lab ps
curl --fail http://127.0.0.1:28083/healthz
```

预期 healthz 返回 `ok`、容器状态为 `healthy`。由你确认服务器安全组和防火墙允许 TCP 28083，浏览器访问 `http://101.42.154.80:28083/`。Compose 固定映射 `28083:80`，不需要改动宿主机现有 Nginx。

## 更新与回退

正常更新由 main 推送自动触发。需要手动重建最近一次成功部署时，在相同目录执行：

```bash
docker compose -p marble-lab --env-file release.env pull
docker compose -p marble-lab --env-file release.env up -d --wait --wait-timeout 120
docker compose -p marble-lab --env-file release.env ps
```

需要回退时，在服务器部署目录的 `release.env` 写一行 `MARBLE_IMAGE=ghcr.io/zjj873994125/marble-lab:sha-<目标完整提交SHA>`，然后执行上面的 pull / up 命令。首次部署失败尚无此文件时也可手动创建。目标标签必须已成功发布且仍保留在 GHCR 中；下一次自动部署成功会更新这个文件。查看日志使用 `docker compose -p marble-lab logs --tail=100 marble-lab`。如果失败版本还改过端口、挂载等 Compose 内容，需同时核对并恢复匹配版本的 Compose。

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
