---
name: sifta-search
metadata:
  version: 0.0.1
  tags: [sifta-search, recruiting, sourcing, candidates]
description: >
  在 AI 行业垂直招聘场景使用 Sifta 做 candidate sourcing、candidate search
  和公开 profile enrichment。用户要寻找、筛选、补全或评估 AI 工程师/开发者、
  具身智能人才、超级个体/独立开发者、创始人、AI 产品经理、GTM/GMT/出海/AI 营销人才、
  研究型论文人才时使用。本 skill 不适用于这些画像之外的通用找人、公司情报、
  销售线索、触达、ATS、KOL 合作或普通网页研究。
---

# Sifta People Search

Sifta 是面向 AI 行业垂直招聘 sourcing 的候选人搜索工具。它不是通用网页搜索、
公司情报、销售线索、触达、ATS 或 KOL 合作工具。

使用 Sifta 的目标是：把招聘画像转成一份紧凑、可解释、有公开证据支撑的候选人
列表。工作流要保持收敛：搜索公开候选人来源，总结匹配理由，标注不确定性，不
编造私人信息。

## 目标画像

当前只覆盖 AI 行业候选人画像：

- AI 工程师、开发者：AI Agent、LLM、视频大模型、语音模型、AI infra、应用层开发。
- 具身智能人才：机器人、自动驾驶、感知、控制、仿真、VLA、具身模型相关工程师或岗位。
- 超级个体：独立开发者、一人公司、solo builder，有自建产品或可验证公开作品。
- 创始人：founder、co-founder、自己运营产品或 AI startup 的人。
- 产品经理：AI 产品经理、字节产品经理、Qwen 或大模型团队相关 PM。
- GTM/GMT 营销：出海营销、增长、AI 产品营销、developer marketing、社区增长。
- 研究型人才：专注学术、论文发表、arXiv/Google Scholar 证据，可转招聘候选人。

如果用户请求这些画像之外的人群，先说明当前 skill 只面向 AI 行业招聘 sourcing，并询问
是否要把需求改写成上述画像之一。

## 环境与认证

Sifta 当前使用 CLI 模式。CLI 是 Sifta HTTP API 的薄客户端；GitHub、Exa、
TwitterAPI、TikHub、数据库和模型供应商密钥都保存在 API 服务端，不要向用户索取
这些密钥。

每个会话第一次调用 Sifta CLI 前，先运行 `sifta-cli status`。如果缺少
`sifta-cli`，先用 `npm install -g @sifta/cli@latest` 安装。如果未认证，或命令语法
不确定，阅读 [references/cli-reference.md](references/cli-reference.md)。CLI 可通过
`sifta-cli auth` 的本地配置或 `SIFTA_API_KEY` 调用服务端。

不要静默打开浏览器，也不要请求服务端供应商密钥。

## 命令选择

选择能完成目标的最小命令：

| 意图                                    | 优先命令                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 候选人搜索                              | `sifta-cli find-people --query "<query>" --target-count 10`                                      |
| 能明确拆出 title/skill/location/company | `sifta-cli find-people --query "<query>" --filter '{...}'`                                       |
| 已知 profile 或 handle 补全             | `sifta-cli enrich-people --people '[...]'`                                                       |
| CLI/API schema 变化                     | `sifta-cli tools` 查看 schema，然后改用当前明确命令                                              |

默认解析 JSON stdout。不要把 `--pretty` 用于 agent 解析；它只适合人工查看。

## 来源策略

根据需要的招聘证据选择来源：

- 默认来源是 GitHub 和 LinkedIn。
- AI 工程师、具身智能、独立开发者和 founder 如果强调代码、产品或公开作品，优先使用
  `--sources '["github"]'`，必要时保留 LinkedIn 做职业背景核验。
- 产品经理、GTM/GMT 营销和公司/团队背景强相关画像，优先使用 `--sources '["linkedin"]'`。
- 用户显式指定来源后，所有重试、失败恢复和替代命令都必须保留相同 `--sources`；
  不要退回默认来源，否则会混入 GitHub。
- LinkedIn 由服务端通过 Exa People Search 执行，底层请求必须使用 `category: "people"`；
  query 应写成角色、地点、公司、领域词组成的自然语言语义查询，而不是追加
  `LinkedIn profile only` 这类网页搜索限定词。
- 只有当论文证据有助于识别候选人时才使用 `--mode research`。arXiv 和
  Google Scholar 是辅助证据，不是最终候选人主来源。
- Twitter/X 和小红书属于可选公开信号来源。只有用户提供已知 handle、要求公开内容
  信号，或 Sifta API 明确暴露这些来源时才使用；不要把 KOL 合作当作本 skill 的主路径。

如果用户请求的来源没有被支持或 API 结果显示未执行该来源，要明确说明。

## 查询计划边界

Skill / agent 负责把用户原始 query 转成搜索计划：

- 能明确识别岗位时，写入 `filter.titles`。
- 能明确识别技能或主题时，写入 `filter.skills`。
- 能明确识别地点时，写入 `filter.locations`。
- 能明确识别公司偏好时，写入 `filter.companies`。
- Founder、超级个体、GTM/GMT 和研究型画像常常不是标准 title；把产品、增长、论文、
  自建项目、团队背景等证据要求保留在 `query` 中，不要强塞进 filter。
- 不支持排除公司条件；如果用户提出排除公司，把它保留在 `query` 里作为软约束，并在结果解释时人工核验。

不要把不确定的推断强塞进 filter。不确定时保留在 `query` 或先追问。

## 歧义处理

当请求可能指向不同目标，且错误搜索会浪费时间或 API 配额时，先问一个简短问题。

常见歧义：

- 公司、产品或项目名称有多个含义。
- 用户把招聘候选人、创作者、客户、公司或销售线索混在一起。
- 用户描述的人群不属于当前 7 类 AI 行业画像。
- 地点、资历或必要证据缺失，且会明显影响搜索方向。
- 用户说“懂 X 的人”，但不清楚证明依据应是公开代码、职业经历、论文还是社交内容。

如果上下文已经足够明确，可以直接说明假设并继续，例如：
“我按招聘候选人理解，优先找 GitHub/LinkedIn 上有 AI infra 公开证据的人。”

## 工作流

1. 用一句话复述候选人目标。
2. 先归类到 7 类 AI 行业画像之一，再根据目标证据选择来源和 mode。
3. 运行最小可用 CLI 命令，不传 `--pretty`。
4. 解析 JSON stdout，把 stderr 视为状态或调试信息。
5. 输出紧凑候选人列表，包含 profile 链接、匹配理由、证据和风险提示。
6. 区分证据和推断，标注过期、缺失或较弱的证据。
7. 如果结果较弱，说明原因，并给出一个更窄的后续查询建议。

遇到复杂场景、无结果或弱结果恢复时，再参考
[references/workflow-patterns.md](references/workflow-patterns.md)。

## 输出规则

向用户汇报结果时：

- 包含候选人姓名、来源、profile URL、headline/location（如有）、匹配理由和关键
  证据。
- 标注候选人更接近哪类目标画像，例如 `AI 工程师`、`具身智能`、`超级个体`、`Founder`、
  `AI PM`、`GTM/GMT` 或 `研究型人才`。
- 必要时按置信度分组：强匹配、可能匹配、弱匹配。
- 传达 API 返回的 warnings。
- 不要编造邮箱、电话、薪资、是否愿意搬迁、在职状态或私人联系方式。
- 除非 Sifta 返回 same-person hint，或有明确公开证据，否则不要断言跨渠道 profile
  是同一个人；不确定时写成“可能匹配”。
- 除非用户要求原始 JSON 或全部结果，否则保持候选人列表紧凑。

推荐紧凑格式：

```text
候选人：<name>
画像：<persona>
来源：<source> | <profileUrl>
概况：<headline/location if present>
匹配理由：<evidence-backed reasons>
风险：<missing or weak evidence>
```

## 失败恢复

如果命令因为参数变化失败：

1. 运行 `sifta-cli tools`。
2. 找到相关工具：`find_people` 或 `enrich_people`。
3. 根据返回的 schema 重建参数。
4. 使用 `find-people` 或 `enrich-people` 这些明确 CLI 命令重试。

如果搜索没有返回候选人，不要断言不存在这类候选人。应说明“这次搜索没有返回候选人”，
并提出具体调整：放宽 title、去掉地点、切换来源、补充公司/domain 线索，或在论文证据
相关时使用 `--mode research`。

## 详细参考

- CLI 命令与 JSON 参数：
  [references/cli-reference.md](references/cli-reference.md)
- 场景化工作流：
  [references/workflow-patterns.md](references/workflow-patterns.md)
