# 专转本医护大类自学辅助后台管理端

本目录是基于 Ant Design Pro / Umi Max 的后台管理端，服务于题库、知识点、每日练习、公开视频和内容发布。

后台接口通过 `UMI_APP_API_BASE` 连接 NestJS API，通过 `x-admin-token` 做管理端保护。

## 脚本

```bash
pnpm install
pnpm dev
pnpm build
```

## 视频上传

公开视频管理页优先使用腾讯云 VOD 浏览器直传：后台向 API 请求短期上传签名，视频文件直接从浏览器上传到 VOD，上传完成后自动回填 `assetKey = VOD FileId` 和 `videoUrl`。

API 侧需要配置：

```bash
TENCENT_SECRET_ID=
TENCENT_SECRET_KEY=
TENCENT_VOD_SUB_APP_ID=
TENCENT_VOD_PROCEDURE=
TENCENT_VOD_STORAGE_REGION=
```

`TENCENT_VOD_PROCEDURE` 可留空；留空时使用 VOD 默认处理，后台会保存上传结果返回的原始播放地址。
