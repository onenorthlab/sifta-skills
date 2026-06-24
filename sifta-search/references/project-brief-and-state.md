# Project Brief and Candidate State

本文件定义 Sifta sourcing 的输入前置检查和 `lead -> candidate` 升级门槛。目标是少问问题，
但不把 source-map 线索、论文作者、repo owner、公司成员或实验室网页直接包装成候选人。

## 1. Project Brief gate

先把用户输入压缩成 Project Brief。缺项分为两类：

| 字段 | 用途 | 缺失时 |
| --- | --- | --- |
| roleFamily | 选择 Engineering / Product-GTM / Academic / Dossier / Outreach / Feedback route | 无法推断时 hard stop，只问一个短问题 |
| evidencePriority | 选择 GitHub / LinkedIn / academic source stack / public profile / reviewed evidence | 可用默认来源地图推进 |
| mustHave | 技能、论文、开源、产品、公司、市场、职级或项目阶段 | 不阻塞；写 Assumptions 和 Fit Proof requirement |
| avoid | 排除公司、人群、风险、不可说内容 | 不阻塞；涉及隐私、自动发送或非公开数据时 hard stop |
| quantity | 候选人数或 shortlist 深度 | 默认 3-5；用户要求最强时先给 1 个最强 |
| sourceConstraints | 用户指定的 GitHub / LinkedIn / X / academic / native search / CLI 边界 | 必须保留；重试和 fallback 不得静默换来源 |

Hard stop 只用于关键边界：

- 不清楚是否招聘还是公司/市场研究。
- 只说“AI 人才”且 role family 不可推断。
- 已知候选人 deep-dive 缺少可消歧 profile 或公司/地点线索。
- 用户要求私人联系方式、手机号、自动发送或非公开数据。
- 多 route 成本差异大，且用户未授权付费 connector。

Hard stop 回复只包含一个短问题和一句原因，不输出 workflow、CLI 命令、source map 或候选人表。

## 2. Lead state machine

候选人必须按状态升级。不要跳过中间门槛。

```text
source-map lead
  -> identity checked
  -> evidence graded
  -> candidate bucketed
  -> outreach-ready / rejected
```

| 状态 | 可进入来源 | 升级条件 | 不能做 |
| --- | --- | --- | --- |
| source-map lead | paper、repo、company、lab、advisor、coauthor、competition、project、dataset | 找到个人 profile、GitHub、LinkedIn、个人主页、lab bio 或用户明确 profile | 不能输出为候选人推荐 |
| identity checked | 个人 profile、GitHub、LinkedIn、个人主页、Scholar profile、lab bio | same-person confidence 至少 medium，或明确标为待核验 | 不能跨渠道硬合并 |
| evidence graded | profile + 与 requirement 相关的公开证据 | 给出 A/B/C/Reject 和 weakness | 不能用 title keyword 或 star/fork 数替代证据 |
| candidate bucketed | 已分全职候选、顾问/推荐人、产业标杆、待核验、排除 | Fit Proof Packet 完整 | 不能把顾问/标杆包装成普通全职候选 |
| outreach-ready | 已核验证据 + 项目/岗位 + 渠道 + do-not-say 边界 | 人工确认后才能发送 | 不能自动发送或猜联系方式 |
| rejected | 身份冲突、非公开数据、无关、证据无法追溯 | 写明拒绝或排除原因 | 不能为了凑数保留 |

## 3. Source Map 最小字段

每条 source-map lead 至少包含：

| 字段 | 说明 |
| --- | --- |
| `lead` | 论文、repo、公司、实验室、项目、作者、贡献者、候选人线索名 |
| `sourceFamily` | GitHub / LinkedIn / academic / company / lab / project / user-provided |
| `whyRelevant` | 为什么与用户需求相关 |
| `conversionBlocker` | 还缺什么才可进入候选表，例如 identity、profile、职业阶段、实现证据 |
| `nextVerification` | 下一步核验动作，例如找个人主页、GitHub profile、LinkedIn、lab bio、repo commits |

## 4. Evidence grade

| 等级 | 口径 | 可输出为候选人吗 |
| --- | --- | --- |
| A | 个人 profile 与目标证据直接匹配，来源可追溯，identity/fit/evidence 都清楚 | 可以 |
| B | 单一强 profile 或强 source-map 证据，缺交叉验证 | 可以作为待复核候选，必须 warning |
| C | repo owner、论文作者、公司/实验室成员、关键词命中、generic list | 只能 source-map lead 或待核验 |
| Reject | 身份冲突、非公开信息、隐私请求、无关、证据无法追溯 | 不进入候选表 |

Dealbreaker 优先于分数：私人联系方式、自动发送、无个人 profile、身份冲突、非公开数据、
销售线索/KOL/公司研究误路由，直接进入 hard stop 或 Reject。

## 5. CLI / native 边界

| 场景 | 默认执行面 | CLI 何时使用 |
| --- | --- | --- |
| GitHub engineering | native GitHub search / GitHub MCP / `gh` | 需要稳定 JSON、trace、review loop 或 token-backed connector |
| LinkedIn Product/GTM | Sifta CLI/API | 需要 LinkedIn people connector、profile enrichment 或 company-map assisted search |
| Academic graph | native academic/web source map | 需要 research trace、结构化候选人或 review feedback |
| Candidate dossier | native profile reading + optional `enrich-people` | 已知 profile 需要统一公开证据结构 |
| Review feedback | `sifta:review-packet` / `sifta:review-feedback` | 需要把人工反馈转成 source-specific next request |

CLI/API 不承担 planner、长期 memory、通用 web search、ATS 写操作、自动外联或 provider key 管理。
