# Dist 预发布部署

本方案面向小规格服务器：GitHub Actions 负责构建，服务器只下载产物、解压和运行。

服务器不需要安装 pnpm，也不需要执行 `pnpm install` / `pnpm build` / `docker build`。服务器只需要：

```text
Node.js 22
Nginx
systemd
```

## 1. GitHub Actions 产物

推送到 `main` / `master` / `demo` 后会自动运行：

```text
.github/workflows/build-dist.yml
```

生成两个 artifact：

```text
admin-dist.tar.gz   # Web 后台静态文件
api-runtime.tar.gz  # 后端已编译代码 + 生产依赖 + Prisma Client
```

当前本地估算体积：

```text
admin-dist.tar.gz   # 约 1.8 MB
api-runtime.tar.gz  # 约 29 MB
```

注意：`admin/pnpm-lock.yaml` 和 `api/pnpm-lock.yaml` 必须一起提交到仓库，否则 GitHub Actions 的 `--frozen-lockfile` 会失败。

后台构建时固定使用：

```bash
UMI_APP_API_BASE=/api
UMI_APP_DEFAULT_ADMIN_TOKEN=
```

因此后台不会内置管理令牌，浏览器访问后台后需要手动输入服务器 `ADMIN_TOKEN`。

## 2. 服务器目录

```bash
sudo mkdir -p /var/www/cfqh-admin/current
sudo mkdir -p /opt/cfqh/api/current
```

## 3. 部署 Web 后台

从 GitHub Actions 下载 `admin-dist.tar.gz` 后：

```bash
sudo rm -rf /var/www/cfqh-admin/current/*
sudo tar -xzf admin-dist.tar.gz -C /var/www/cfqh-admin/current
```

安装 Nginx 配置：

```bash
sudo cp deploy/nginx/cfqh-admin.conf /etc/nginx/conf.d/cfqh-admin.conf
sudo nginx -t
sudo systemctl reload nginx
```

访问：

```text
http://111.231.44.21:8080
```

## 4. 部署后端 API

从 GitHub Actions 下载 `api-runtime.tar.gz` 后：

```bash
sudo rm -rf /opt/cfqh/api/current/*
sudo tar -xzf api-runtime.tar.gz -C /opt/cfqh/api/current
```

创建后端环境文件：

```bash
sudo nano /opt/cfqh/api/.env
```

示例：

```bash
PORT=3001
NODE_ENV=production
DATABASE_URL=file:/opt/cfqh/api/prod.db
ADMIN_TOKEN=请替换为强随机后台令牌
GATEWAY_SECRET=请替换为强随机网关密钥
ALLOW_DEV_OPEN_ID=false
DEV_OPEN_ID=
WECHAT_APP_ID=你的微信小程序 AppID
WECHAT_APP_SECRET=你的微信小程序 AppSecret
TENCENT_SECRET_ID=
TENCENT_SECRET_KEY=
TENCENT_VOD_SUB_APP_ID=
TENCENT_VOD_PROCEDURE=
TENCENT_VOD_STORAGE_REGION=
TENCENT_VOD_CLASS_ID=
TENCENT_VOD_EXPIRE_SECONDS=3600
```

安装 systemd 服务：

```bash
sudo cp deploy/systemd/cfqh-api.service /etc/systemd/system/cfqh-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now cfqh-api
sudo systemctl status cfqh-api
```

查看日志：

```bash
journalctl -u cfqh-api -f
```

## 5. 数据库初始化

首次部署或 Prisma schema 变化后，在服务器执行一次：

```bash
cd /opt/cfqh/api/current
DATABASE_URL=file:/opt/cfqh/api/prod.db ./node_modules/.bin/prisma db push
```

`api-runtime.tar.gz` 已包含 Prisma CLI、Prisma Client 和 `prisma/schema.prisma`，这里不需要在服务器安装依赖。

如需导入种子数据：

```bash
cd /opt/cfqh/api/current
DATABASE_URL=file:/opt/cfqh/api/prod.db node prisma/seed.js
```

正式题库数据建议从后台导入，不建议长期依赖 seed。

## 6. 更新流程

每次 GitHub Actions 重新生成产物后：

```bash
sudo systemctl stop cfqh-api
sudo rm -rf /opt/cfqh/api/current/*
sudo tar -xzf api-runtime.tar.gz -C /opt/cfqh/api/current
sudo systemctl start cfqh-api

sudo rm -rf /var/www/cfqh-admin/current/*
sudo tar -xzf admin-dist.tar.gz -C /var/www/cfqh-admin/current
sudo systemctl reload nginx
```

## 7. 检查

```bash
curl -I http://127.0.0.1:8080/
curl -I http://127.0.0.1:3001/api
curl -H "x-admin-token: $ADMIN_TOKEN" http://127.0.0.1:8080/api/admin/license-tokens
```
