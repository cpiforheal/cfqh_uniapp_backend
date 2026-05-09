# Web 后台 Docker 预发布部署

本方案只容器化 Web 后台。Nginx 在容器内托管后台静态文件，并将 `/api` 反代到服务器本机后端 `127.0.0.1:3001`。

## 访问地址

```text
http://111.231.44.21:8080
```

## 前置条件

1. 服务器已安装 Docker 与 Docker Compose。
2. 后端 API 已在服务器本机启动，并监听 `3001`：

```bash
cd api
pnpm build
NODE_ENV=production pnpm start:prod
```

3. 后端生产环境至少需要配置：

```bash
PORT=3001
NODE_ENV=production
DATABASE_URL=file:./prod.db
ADMIN_TOKEN=请替换为强随机后台令牌
GATEWAY_SECRET=请替换为强随机网关密钥
ALLOW_DEV_OPEN_ID=false
DEV_OPEN_ID=
WECHAT_APP_ID=你的微信小程序 AppID
WECHAT_APP_SECRET=你的微信小程序 AppSecret
```

## 启动后台容器

在项目根目录执行：

```bash
docker compose -f docker-compose.admin.yml up -d --build
```

查看状态：

```bash
docker compose -f docker-compose.admin.yml ps
docker logs -f cfqh-admin-web
```

停止：

```bash
docker compose -f docker-compose.admin.yml down
```

## 反代说明

后台构建时使用：

```bash
UMI_APP_API_BASE=/api
UMI_APP_DEFAULT_ADMIN_TOKEN=
```

因此浏览器请求会变成：

```text
http://111.231.44.21:8080/api/admin/...
```

Nginx 会转发到：

```text
http://host.docker.internal:3001/api/admin/...
```

`docker-compose.admin.yml` 中的：

```yaml
extra_hosts:
  - "host.docker.internal:host-gateway"
```

用于让 Linux 服务器容器访问宿主机后端。

## 后台令牌

生产构建不内置默认后台 token。打开后台后，在登录/令牌输入处手动填入服务器 `ADMIN_TOKEN`。

不要把正式 `ADMIN_TOKEN` 写入 `UMI_APP_DEFAULT_ADMIN_TOKEN`，否则会进入前端静态包。
