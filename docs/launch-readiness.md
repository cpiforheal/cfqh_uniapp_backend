# 上线前最小闭环验收

本清单只覆盖本轮内测必须稳定的闭环：登录、通行码授权、题库加载、做题记录、错题复刷、学习报告基础数据。AI 分析、VOD 本地化和更多报告解释放到后续迭代。

## 系统边界

- 小程序端只做展示、登录触发、通行码输入和业务访问，不把本地缓存当成授权真相。
- API 后端是授权、题库、练习进度、错题和学习报告的唯一真相源。
- 云函数网关负责取得微信真实 `OPENID`，并用 `GATEWAY_SECRET` 转发可信身份到 API。
- 后台 Web 只做内容、视频、通行码、学生和登录台账管理；后台看到用户不代表该用户已授权。
- 数据库中只有 `published` 题目和视频进入小程序真实内容。

## 发布前检查

本地基础检查：

```bash
pnpm release:preflight
pnpm typecheck
pnpm --dir api test --runInBand
pnpm --dir admin typecheck
```

GitHub Actions 构建来源检查：

- 使用同一个 commit SHA 生成 `miniapp-weapp-dist.tar.gz`、`admin-dist.tar.gz` 和 `api-runtime.tar.gz`。
- 小程序审核包优先使用 `miniapp-weapp-dist.tar.gz`，不要再用本地临时 `dist/` 混入上传。
- CI 会执行 `pnpm check:miniapp-dist`，拦截本地 openId、跳过微信登录、关闭云函数网关和 mock fallback 混入审核包。
- 解压小程序 artifact 后用微信开发者工具打开解压目录，确认 `project.config.json` 的 `miniprogramRoot` 为 `dist/`。
- 服务器部署的 API/Admin artifact 必须来自同一次 CI，不要 API 用新包、后台或小程序用旧包。

带真实生产环境变量的严格检查：

```bash
NODE_ENV=production \
DATABASE_URL=file:/opt/cfqh/api/prod.db \
ADMIN_TOKEN=... \
GATEWAY_SECRET=... \
ALLOW_DEV_OPEN_ID=false \
DEV_OPEN_ID= \
WECHAT_APP_ID=... \
WECHAT_APP_SECRET=... \
pnpm release:preflight:prod
```

## 环境验收

- API：`NODE_ENV=production`，`ALLOW_DEV_OPEN_ID=false`，`DEV_OPEN_ID` 为空，`ADMIN_TOKEN` 和 `GATEWAY_SECRET` 为正式强密钥。
- 云函数：`API_BASE` 指向正式 API，`GATEWAY_SECRET` 与 API 完全一致，云函数已部署到当前小程序云环境。
- 小程序：生产构建使用云函数网关，不设置 dev openId，不开启 mock fallback，不跳过微信登录。
- 微信后台：request 合法域名、云开发环境、小程序 AppID、服务端 AppSecret 指向同一个正式项目。
- 数据库：正式库存在已发布题目、已发布视频和有效通行码；新导入题目必须确认是 `published`。
- 后台：正式后台只使用正式 `ADMIN_TOKEN`，浏览器本地不能依赖开发默认 token。

## 内测必过场景

- 清缓存新用户进入小程序，只看到锁定题库骨架，不能看到真实题目、解析、报告和视频详情。
- 新用户输入有效通行码后，题库目录显示真实模块、真实题量和真实小章节。
- 同一账号进入模块页能看到题目列表；做题后已做、错题、收藏和学习报告数据能更新。
- 重新打开小程序后仍保持服务端授权态，不回到“完整题库未加载”。
- 错误码、过期码、别人已绑定码不能解锁。
- 未授权账号直接访问题库只能得到锁定骨架；访问练习、视频、报告应被拒绝。
- 后台能看到登录用户、通行码绑定状态和学生学习数据，但不作为小程序授权判断。
- 最终验收必须用微信真实环境打开，不只使用本地 dev openId。

## 提交边界

- 不提交 `.logs/`、SQLite `*.db-wal` / `*.db-shm`、本地插件实验目录。
- 不把未完成的后台实验功能和本轮授权题库闭环混在同一个发布提交里。
- VOD 本地化如果未完成，本轮内测只验收已有公开视频可访问，不验收上传链路。
