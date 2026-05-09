# 云函数接入说明

已实现：小程序正式链路优先走 `cloudfunctions/nursingGateway`，本地开发可显式关闭云函数并直连后端 API。生产环境接口失败时展示错误态/空态，不再默认回退演示数据。

## 1. 微信开发者工具需要做的操作

1. 打开项目，确认 [`project.config.json`](project.config.json) 中存在 `cloudfunctionRoot: "cloudfunctions/"`。
2. 在开发者工具中开通或选择云开发环境（建议 `test` 环境）。
3. 右键上传并部署云函数目录 [`cloudfunctions/nursingGateway`](cloudfunctions/nursingGateway)（安装依赖并上传）。
4. 确认云函数名称为 `nursingGateway`。

## 2. 环境变量

小程序端见 [`.env.example`](.env.example)：

- `TARO_APP_USE_CLOUD_GATEWAY=true`：微信小程序环境优先调用云函数。
- `TARO_APP_API_BASE=http://127.0.0.1:3001/api`：本地直连后端时使用。
- `TARO_APP_USE_MOCK_FALLBACK=false`：生产关闭 mock 兜底。
- `TARO_APP_DEV_OPEN_ID`：仅本地开发直连时使用。

云函数环境变量：

- `API_BASE`：后端 API 地址，例如 `https://api.example.com/api`。
- `GATEWAY_SECRET`：与后端 `GATEWAY_SECRET` 保持一致。
- `ALLOW_DEV_OPEN_ID=true` + `DEV_OPEN_ID`：仅本地或测试云环境兜底使用；正式/预发布环境不要配置或保持关闭。

后端环境变量见 [`api/.env.example`](api/.env.example)，后台环境变量见 [`admin/.env.example`](admin/.env.example)。

## 3. 本地启动顺序

1. 启动后端：`cd api && pnpm start:dev`。
2. 启动后台：`cd admin && pnpm dev`。
3. 小程序本地直连：设置 `TARO_APP_USE_CLOUD_GATEWAY=false` 后运行 `pnpm dev:weapp`。
4. 云函数联调：部署 `nursingGateway`，在云函数环境配置 `API_BASE` 和 `GATEWAY_SECRET`，再设置 `TARO_APP_USE_CLOUD_GATEWAY=true`。

## 4. 请求契约

小程序统一调用 [`request(path, options)`](src/services/nursing.ts)，云函数统一入参：

```json
{
  "path": "/practice-home",
  "method": "GET",
  "data": {}
}
```

云函数会从微信云上下文读取真实 `OPENID`，并向后端附加 `x-open-id` 与 `x-gateway-secret`。后端只信任匹配 `GATEWAY_SECRET` 的网关 openId；本地开发可通过 `ALLOW_DEV_OPEN_ID=true` 和 `DEV_OPEN_ID` 显式启用回退。

## 5. 验证路径

1. 后台新增题目并发布。
2. 后台每日练习配置关联该题并发布。
3. 小程序打开“题库”应看到新题。
4. 小程序打开“练习”应看到每日练习更新。
5. 点击进入详情可看到该题详情。
