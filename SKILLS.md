# SKILLS.md

## 0. Project Context

项目：专转本高数自学辅助微信小程序 + 后台管理系统。

目标用户：
- 学生端：专转本高数学生，用于每日练习、看公开讲解、收藏错题、查看学习建议。
- 管理端：老师或助教，用于管理题目、每日一题、微课、知识点和学习数据。

产品定位：
- 这是“个人学习辅助工具”，不是招生页、课程商城、培训机构官网。
- 第一版只验证“打开小程序 -> 做今日一题 -> 看解析 -> 看相关公开讲解 -> 收藏/错题 -> 生成学习建议”的闭环。
- 任何功能、文案、界面都必须服务于学习辅助和内容沉淀，不要主动引入销售转化设计。

## 1. Required Stack

小程序端必须优先使用：
- Taro
- React
- TypeScript
- Zustand
- TanStack Query
- Sass 或 CSS Modules
- 微信小程序原生组件能力

后台管理必须优先使用：
- Ant Design Pro / Umi Max
- Ant Design
- ProComponents
- ECharts 或 AntV

后端必须优先使用：
- NestJS
- PostgreSQL
- Prisma
- 腾讯云 COS / 云点播，或阿里云 OSS / 视频点播

包管理：
- 优先使用 pnpm。
- 不要建议 Homebrew 作为项目依赖安装路径。
- Redis、消息队列、AI 助教、支付系统不是 MVP 必需，除非用户明确要求。

## 2. Hard Constraints

小程序端禁止：
- 使用 DOM API。
- 使用 `window`、`document`、`localStorage`。
- 将后台管理组件或 Ant Design 组件搬到小程序端。
- 默认引入大型移动端 UI 库。
- 将 mock 数据写死在组件内部。
- 将所有业务逻辑堆进页面文件。

产品文案禁止：
- 报名
- 招生
- 线下班
- 优惠
- 购买课程
- 培训机构
- 包过
- 保录取
- 提分承诺

推荐替代表述：
- 公开讲解
- 自学辅助
- 知识点陪练
- 学习建议
- 复习计划
- 能力诊断
- 错题整理
- 学习资源

设计禁止：
- 做成教育营销落地页。
- 大面积红色、金色、促销视觉。
- 首页堆满入口。
- 让数学题、解析、公式过于拥挤。
- 为视觉效果牺牲移动端可读性。

工程禁止：
- 为 MVP 引入复杂微服务。
- 为少量页面引入过度抽象。
- 未经用户要求实现支付、订单、优惠券、分销、直播、社区、排行榜、积分商城。
- 在没有真实需求前实现 AI 助教。

## 3. Implementation Order

默认按以下顺序推进，不要跳到复杂功能：

1. 搭建 Taro + React + TypeScript 小程序基础工程。
2. 用本地 mock 数据完成学生端静态页面。
3. 实现核心页面跳转与基础状态。
4. 搭建 Ant Design Pro 后台。
5. 后台先实现题目、知识点、微课、每日一题 CRUD。
6. 搭建 NestJS + Prisma + PostgreSQL 后端。
7. 用真实接口替换小程序 mock 数据。
8. 记录学习事件。
9. 生成基础学习报告。
10. 最后接入视频上传、对象存储、统计看板。

如果用户没有明确要求，不要偏离该顺序。

## 4. Mini Program Rules

页面优先级：
1. 首页
2. 今日一题详情页
3. 微课列表页
4. 视频播放页
5. 知识点地图页
6. 错题收藏页
7. 学习报告页
8. 我的页面

底部 Tab：
- 首页
- 题库
- 微课
- 我的

组件拆分要求：
- `ProblemCard`
- `SolutionSteps`
- `KnowledgeTag`
- `VideoCard`
- `ProgressRing`
- `MistakeCard`
- `ReportCard`
- `EmptyState`
- `SafeAreaView`

状态管理：
- 页面内临时状态用 React state。
- 登录态、用户信息、全局设置用 Zustand。
- 服务端数据请求、缓存、刷新用 TanStack Query。
- 不要把服务端列表数据长期塞进全局 store。

样式规则：
- 主色：蓝绿色 / 青蓝色。
- 背景：米白 / 浅灰 / 低饱和色。
- 强调色：少量橙色。
- 数学内容必须保证行距、字号和移动端可读性。
- 不要照搬 Web 端后台风格。

性能规则：
- 图片、视频、讲义附件走 CDN。
- 列表分页或懒加载。
- 视频封面使用压缩图。
- 数学公式优先由后端生成图片或安全 HTML 片段；不要轻易在小程序端引入重型公式库。

## 5. Admin Rules

后台管理面向老师/助教，目标是运营效率，不是强视觉表现。

必须优先实现：
- 知识点管理
- 题目管理
- 每日一题配置
- 微课管理
- 视频素材管理
- 内容发布审核
- 基础学习数据看板

题目字段建议：
- 标题
- 正文
- 题型
- 难度
- 知识点标签
- 选项，可选
- 正确答案
- 分步解析
- 易错点
- 来源
- 状态：草稿、已发布、已下线

微课字段建议：
- 标题
- 简介
- 视频地址
- 封面图
- 时长
- 难度
- 知识点标签
- 讲义摘要
- 关联题目
- 状态：草稿、已发布、已下线

数据看板优先级：
- 日活
- 次日留存
- 今日一题完成率
- 视频播放完成率
- 收藏率
- 错题新增数
- 薄弱知识点分布

## 6. Backend Rules

核心模型优先：
- `User`
- `KnowledgePoint`
- `Problem`
- `ProblemStep`
- `VideoLesson`
- `DailyProblem`
- `Favorite`
- `Mistake`
- `LearningEvent`
- `StudyReport`

接口规则：
- 小程序接口返回面向页面的数据，不暴露后台内部字段。
- 后台接口可以更完整，但必须保留权限控制入口。
- 内容状态必须区分草稿、已发布、已下线。
- 学习事件独立记录，不要混在题目表或视频表里。
- 上传文件只保存 URL、文件 key、大小、类型、来源，不存数据库大字段。

学习事件枚举：
- `OPEN_APP`
- `VIEW_PROBLEM`
- `SUBMIT_PROBLEM`
- `VIEW_SOLUTION`
- `FAVORITE_PROBLEM`
- `ADD_MISTAKE`
- `WATCH_VIDEO`
- `COMPLETE_VIDEO`
- `VIEW_REPORT`

## 7. Vibe Coding Protocol

代理在执行任务前应先判断任务属于哪一类：
- 小程序 UI
- 后台管理
- 后端接口
- 数据模型
- 内容/文案
- 部署/工具链

执行规则：
- 先读现有文件和项目结构，再改代码。
- 一次只做用户当前要求的范围，不顺手扩展大功能。
- 新增页面时同步处理路由、mock 数据、类型和样式。
- 新增接口时同步处理 DTO、service、controller、Prisma model 和基础错误处理。
- 新增字段时同步检查前端展示、后台表单、后端类型、数据库 schema。
- 能用简单函数解决时，不要引入复杂设计模式。
- 保持 TypeScript 类型清晰，避免 `any` 扩散。
- 保持改动可验证，完成后说明运行或检查结果。

回答规则：
- 如果用户让你实现，就直接改代码，不要只给方案。
- 如果用户问技术判断，先给结论，再给取舍。
- 如果存在合规、备案、微信审核风险，要明确指出，但不要假装提供法律结论。
- 如果缺少项目目录或必要配置，先说明阻塞点，再给最短下一步。

## 8. Acceptance Checklist

学生端验收：
- 首页能清楚看到今日学习任务。
- 今日一题能展示题干、标签、提示、解析、易错点。
- 微课页能按知识点浏览公开讲解。
- 视频详情页能展示讲义摘要和相关练习。
- 错题收藏能沉淀个人复习内容。
- 学习报告能给出学习建议，但不做提分承诺。

后台验收：
- 能新增、编辑、发布、下线题目。
- 能新增、编辑、发布、下线微课。
- 能配置每日一题。
- 能管理知识点标签。
- 能查看基础学习数据。

代码验收：
- TypeScript 无明显类型漏洞。
- 页面组件拆分合理。
- 样式不污染全局。
- 小程序端无 DOM 依赖。
- mock 数据和业务组件分离。
- 后续接入真实接口不需要重写页面。

文案验收：
- 前台不出现招生、报名、购买、优惠等销售词。
- 微课表述为“公开讲解”或“学习资源”。
- 学习建议保持辅助性质。
- 关于页或底部位置包含免责声明：

```text
本工具用于个人学习辅助与知识点复习，不提供考试结果承诺。
```

## 9. Default Prompt For Agents

当用户没有提供更具体要求时，按以下提示理解任务：

```text
请基于 Taro + React + TypeScript 开发微信小程序端，基于 Ant Design Pro / Umi Max 开发后台管理端，基于 NestJS + PostgreSQL + Prisma 开发后端。本项目是“专转本高数自学辅助工具”，不是招生页、课程商城或培训机构官网。小程序端必须遵守微信小程序限制，不使用 DOM、window、document、localStorage。样式移动端优先，主色蓝绿色，背景米白或浅灰。前台文案禁止出现报名、招生、线下班、优惠、购买课程、培训机构、包过、保录取、提分承诺。优先完成 MVP 闭环，不要过度设计，不要主动添加支付、订单、分销、社区、排行榜或 AI 助教。
```

## 10. References

- Taro：https://docs.taro.zone/
- Taro React：https://docs.taro.zone/docs/react-overall/
- Taro Skyline：https://docs.taro.zone/docs/skyline/
- Ant Design：https://ant.design/
- Ant Design Pro：https://pro.ant.design/
- ProComponents：https://procomponents.ant.design/
- Umi：https://umijs.org/
- NestJS：https://nestjs.com/
- Prisma：https://www.prisma.io/
