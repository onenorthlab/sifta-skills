# Intent Routing and Ambiguity Threshold

本文件定义 `sifta-search` 如何把用户自然语言转成 sourcing 动作。目标是少问问题、但不在关键
边界上误路由。Router 只选择单一最佳 route，不做业务执行。

## 1. 最小 Project Brief Gate

先把用户输入压缩成 Project Card。缺项可以写入 Assumptions，只有硬阻塞项才追问。

| 字段 | 作用 | 缺失时 |
| --- | --- | --- |
| hiring intent | 判断是否是招聘 sourcing / enrichment / outreach | 不确定时必须先问 |
| role family | Engineering / Product-GTM / Research / Dossier / Outreach / Feedback | 缺失且无法推断时问 1 个问题 |
| evidence priority | GitHub / LinkedIn / academic / public profile / outreach evidence | 可用默认来源地图推进 |
| geo / market | 地域、市场、remote、国家或语言偏好 | 不阻塞；写 Assumption |
| must-have | 技术、业务、论文、公司、职级、经验 | 不阻塞；按当前信息先做 |
| avoid / risk | 不要的人、不能说的内容、排除项 | 若涉及安全或触达承诺，先澄清 |
| quantity | 候选人数或输出规模 | 默认 3-5 个候选或 1 个最强候选 |

## 2. 何时直接推进

满足以下条件时不要追问，直接选择 route，并在输出中写 Assumptions：

- 能判断这是 AI 行业招聘、候选人筛选、候选人深挖、触达文案或 review feedback。
- 能推断 role family。
- 至少有一个来源或证据信号：GitHub、LinkedIn、paper、lab、company map、known profile、公开证据。
- 缺失信息不会导致隐私、自动发送、未授权渠道或高成本 provider 风险。

示例：

| 用户输入 | 行为 |
| --- | --- |
| `帮我找 AI Agent infra 工程师，最好有开源证据` | 直接走 GitHub engineering，geo 写 Assumption |
| `找上海 AI Agent 产品经理` | 直接走 LinkedIn product |
| `帮基础模型团队找高潜研究员，先从论文和导师网络找` | 直接走 academic graph |
| `上一轮这个人像顾问，继续从学生/共同作者找` | 直接走 review feedback |

## 3. 何时必须追问

只问一个短问题；不要倾倒菜单。命中本节任一硬阻塞时必须 **hard stop**：
本轮回复只给一个最小澄清问题和一句为什么需要它；不要继续输出 Project Card、Source Map、
CLI 命令、候选人搜索 workflow、候选人分桶或 Fit Proof Packet。
Hard stop 优先级高于 Project Card 输出、route skill 读取和 CLI 命令生成。

| 阻塞点 | 最小问题 |
| --- | --- |
| 不清楚是否是招聘还是市场/公司研究 | `这是要找候选人，还是只做公司/市场研究？` |
| 只说“找 AI 人才”，role family 不可推断 | `你更偏工程、产品/GTM、研究型，还是已知候选人深挖？` |
| 候选人深挖但没有可核验 identity | `请给 GitHub、LinkedIn、个人主页或能消歧的公司/地点线索。` |
| 要私人联系方式、手机号、自动发送 | `我只能处理公开职业联系方式和草稿；你要我改成公开渠道触达文案吗？` |
| 多 route 成本差异大且用户未给范围 | `先低成本做 GitHub/公开 source map，还是使用 LinkedIn/Exa connector？` |

不要因为缺少 seniority、精确城市、候选人数、公司池、语言偏好就停下来；这些都可以作为
Assumptions 或下一轮 refinement。

硬阻塞示例：

| 用户输入 | 正确行为 | 不允许 |
| --- | --- | --- |
| `帮我找几个顶级 AI 人才，越强越好` | 只问：`你更偏工程、产品/GTM、研究型，还是已知候选人深挖？` | 同时输出 GitHub/LinkedIn/academic workflow、CLI 命令或默认混合召回 |
| `帮我研究 Viggle、Runway、Pika 和 HeyGen 的商业化模式` | 明确这是公司/市场研究，不进入 Sifta candidate sourcing；如需要招聘，可后续把 company map 转成 GTM recruiting input | 生成候选人表或调用 `find-people` |

## 4. Route Decision

按单一最佳 route 选择；如果两个 route 都相关，先选能完成用户本轮主要动作的那个。

| 主要意图 | Route |
| --- | --- |
| 工程、开源、repo、SDK、AI infra、MCP、Agent runtime | `sifta-github-engineering` |
| PM、产品负责人、GTM、增长、商业化、DevRel、company-map | `sifta-linkedin-product-gtm` |
| 论文、实验室、OpenAlex、Scholar、Semantic Scholar、arXiv/OpenReview、Papers with Code、导师/共同作者 | `sifta-academic-graph` |
| 已知人、上一轮某人、公开经历、联系方式、身份核验 | `sifta-candidate-dossier` |
| 已核验证据后的私信、邮件、LinkedIn message、referral intro、follow-up | `sifta-outreach-copy` |
| 用户对上一轮候选人给反馈并要求继续找 | `sifta-review-feedback` |

## 5. 用户输入转写

转写顺序固定：

```text
user input
  -> Project Card
  -> route
  -> source map recipe
  -> lead state: source-map lead / profile lead / candidate / rejected
  -> native search or CLI connector decision
  -> source-specific query / checkpoint
  -> Fit Proof Packet
  -> coverage warning and next action
```

关键规则：

- `checkpoint` 保留用户原始目标，不写改写后的关键词。
- `query` 按来源合同写：GitHub 英文技术词，LinkedIn/GTM 保留用户语言，academic 是 source-map 种子。
- source map 线索不是候选人；只有个人 profile / GitHub / LinkedIn / 个人主页 / 用户明确 profile 才能进候选人。
- 非个人来源永远不能直接进入 candidate；必须先完成 identity 和 evidence gate。
- 候选人必须输出 Fit Proof Packet；不能只给 summary。
- 如果本轮被判定为非招聘公司/市场研究，必须显式写清“这不是 candidate sourcing”，并使用宿主
  agent 原生研究路径；最多补一句“如果要转招聘，可把 company map 改写成 GTM/Product recruiting input”。
