# 授权码发放与学生赋权接口文档

本文档描述“搜索微信账号后后台赋权”的最小闭环接口，适用于当前医护小程序与后台管理端。

## 1. 目标

- 学生先进入小程序形成微信身份（`openId`）。
- 后台老师可搜索学生（`openId/nickname`）。
- 老师可发放随机授权码并绑定到指定微信号。
- 老师可禁用或延期授权码。
- 学生页可查看授权码生命周期信息。

## 2. 鉴权

以下后台接口均受 [`AdminGuard`](api/src/common/guards/admin.guard.ts:1) 保护。

请求头要求：

- `x-admin-token: <token>`

默认开发 token 规则见 [`adminApi.getAdminToken()`](admin/src/services/adminApi.ts:5)。

---

## 3. 接口列表

### 3.1 搜索学生

- 方法：`GET`
- 路径：`/api/admin/students`
- 控制器：[`NursingController.adminStudents()`](api/src/nursing/nursing.controller.ts:113)
- 服务实现：[`NursingService.adminStudents()`](api/src/nursing/nursing.service.ts:439)

#### Query 参数

- `keyword`（可选）：按 `openId` 或 `nickname` 模糊查询。

#### 响应示例

```json
[
  {
    "userId": "cmaxxxx",
    "openId": "oAbc123...",
    "nickname": "张三",
    "createdAt": "2026-05-01T10:20:30.000Z",
    "authorization": {
      "activatedAt": "2026-05-02T08:00:00.000Z",
      "expiresAt": "2026-06-01T00:00:00.000Z",
      "licenseToken": {
        "id": "cma-token-1",
        "code": "NUR-8F3KD2QX",
        "status": "bound",
        "createdAt": "2026-05-02T07:59:00.000Z",
        "boundAt": "2026-05-02T08:00:00.000Z",
        "expiresAt": "2026-06-01T00:00:00.000Z"
      }
    }
  }
]
```

---

### 3.2 发放随机授权码（绑定到指定微信号）

- 方法：`POST`
- 路径：`/api/admin/license-tokens/issue`
- 控制器：[`NursingController.issueLicenseToken()`](api/src/nursing/nursing.controller.ts:119)
- 服务实现：[`NursingService.issueLicenseToken()`](api/src/nursing/nursing.service.ts:471)

#### Body 参数

```json
{
  "openId": "oAbc123...",
  "expiresDays": 30
}
```

- `openId`：必填，目标学生微信标识。
- `expiresDays`：可选，授权码有效天数；未传或 <=0 时为长期（`expiresAt = null`）。

#### 业务规则

- 生成随机码格式：`NUR-XXXXXXXX`（见 [`generateLicenseCode()`](api/src/nursing/nursing.service.ts:39)）。
- 授权码创建后立即绑定 `boundOpenId`。
- 同步写入/更新 [`UserAuthorization`](api/prisma/schema.prisma:65) 与 [`LicenseToken`](api/prisma/schema.prisma:49) 关系。

#### 响应示例

```json
{
  "userId": "cmaxxxx",
  "openId": "oAbc123...",
  "licenseToken": {
    "id": "cma-token-1",
    "code": "NUR-8F3KD2QX",
    "status": "bound",
    "expiresAt": "2026-06-01T00:00:00.000Z"
  }
}
```

---

### 3.3 禁用授权码

- 方法：`POST`
- 路径：`/api/admin/license-tokens/:id/disable`
- 控制器：[`NursingController.disableLicenseToken()`](api/src/nursing/nursing.controller.ts:125)
- 服务实现：[`NursingService.disableLicenseToken()`](api/src/nursing/nursing.service.ts:540)

#### Path 参数

- `id`：授权码 ID。

#### 响应

返回更新后的 [`LicenseToken`](api/prisma/schema.prisma:49) 记录（`status=disabled`）。

---

### 3.4 延期授权码

- 方法：`POST`
- 路径：`/api/admin/license-tokens/:id/extend`
- 控制器：[`NursingController.extendLicenseToken()`](api/src/nursing/nursing.controller.ts:131)
- 服务实现：[`NursingService.extendLicenseToken()`](api/src/nursing/nursing.service.ts:546)

#### Path 参数

- `id`：授权码 ID。

#### Body 参数

```json
{
  "extendDays": 30
}
```

- `extendDays` 必须 > 0。
- 若原到期时间已过期，则从当前时间起延期。

#### 响应

返回更新后的授权码记录（`expiresAt` 已延后）。

---

## 4. 学生页展示字段（二级详情）

学生页使用 [`AdminAnalyticsStudentRow`](admin/src/types/content.ts:156) 展示主字段和二级授权字段。

新增授权字段：

- `licenseCode`
- `licenseIssuedAt`
- `licenseBoundAt`
- `licenseExpiresAt`
- `licenseStatus`

页面实现见 [`StudentsPage`](admin/src/pages/Students/index.tsx:1)。

---

## 5. 现有激活约束说明

学生侧激活流程见 [`LicenseService.activate()`](api/src/license/license.service.ts:10)。

核心约束：

- 若授权码已绑定其他微信号，激活会拒绝（`boundOpenId` 检查）。
- 一码一微信号的主约束由服务端保障。

---

## 6. 调用顺序建议

1. 学生首次进入小程序（产生 `openId`）。
2. 后台用 `/api/admin/students?keyword=` 搜索学生。
3. 调用 `/api/admin/license-tokens/issue` 发放随机码。
4. 必要时调用禁用或延期接口。
5. 在学生页展开行查看授权码生命周期与状态。

---

## 7. 备注

- 当前为最小可用闭环，不依赖额外中台。
- 建议后续补充操作审计字段（`issuedBy`、`disabledBy`、`reason`）与授权码导出能力。