# Query Contract

本文件定义 `sifta-search` 生成 `sifta-cli find-people` / `enrich-people` 参数时的合同。
不要把这些参数当成 prompt 文案；它们是 connector 输入。

## 1. 参数职责

| 参数           | 职责                              | 规则                                                                |
| -------------- | --------------------------------- | ------------------------------------------------------------------- |
| `--query`      | 发给候选人 connector 的渠道输入   | source-specific；短、可执行、适合该渠道                             |
| `--checkpoint` | 用户本轮原始招聘目标              | 保留中文业务语境、岗位、地区、must-have、avoid、证据信号            |
| `--sources`    | 用户授权或 skill 选择的候选人渠道 | 显式指定后，重试、fallback、review-feedback 必须保持一致            |
| `--filter`     | 明确结构化条件                    | 只写确定的 title / skill / location / company / seniority           |
| `--feedback`   | 人工 review 后的下一轮约束        | 由 `pnpm sifta:review-feedback` 生成；不要把长反馈塞进 GitHub query |
| `--trace`      | eval、smoke、排障用脱敏 trace     | 日常用户输出不默认打开；真实验证必须打开                            |

## 2. GitHub query

GitHub 是工程和开源证据渠道。`--query` 使用英文技术关键词和工程角色词；`--checkpoint`
保留用户中文原始目标。

Good:

```bash
sifta-cli find-people \
  --query "AI Agent MCP LLM infra engineer open source" \
  --checkpoint "找 1 个有 AI Agent、MCP 或 LLM infra 的工程候选人，优先 GitHub。" \
  --sources '["github"]'
```

Bad:

```bash
sifta-cli find-people \
  --query "找 1 个有 AI Agent、MCP 或 LLM infra 的工程候选人，优先 GitHub。按人工反馈继续寻访..." \
  --checkpoint "找 1 个有 AI Agent、MCP 或 LLM infra 的工程候选人，优先 GitHub。" \
  --sources '["github"]'
```

禁止：

- `候选人`、`找人`、`优先 GitHub`、`按人工反馈继续寻访` 这类招聘叙述词进入 GitHub query。
- `site:`、`GitHub developers in ...`、`clear evidence from GitHub` 这类 web search 或来源解释词。
- 直接把 `feedback`、`constraints`、`exclusions` 拼进 GitHub query。
- 超过 GitHub search limit；review-feedback 生成的 GitHub query 必须控制 UTF-8 字节长度。

review loop：

- `--query` 只保留上一轮有效技术 token 和少量角色词。
- 完整人工反馈通过 `--feedback` 进入 `feedbackIngest`。
- 如果上一轮是 repo fallback，下一轮不能把 repo-only owner 包装成强推荐；必须保留 warning 或转入 source-map。
- 如果上一轮同时包含 GitHub 和 LinkedIn，`pnpm sifta:review-feedback` 会拆成按来源的多条
  next request；不要把同一个 GitHub 英文 query 同时发给 LinkedIn。

## 3. LinkedIn / 产品 / GTM query

LinkedIn 是职业 profile 和非工程职能证据渠道。`--query` 可以使用用户语言的自然人才画像，
必须保留中文岗位、地区、公司、职能和业务方向信号。

Good:

```bash
sifta-cli find-people \
  --query "上海 AI Agent 产品经理，具备大模型应用、智能体平台或 Agent 产品规划经验" \
  --checkpoint "我们要找上海 AI Agent 产品经理，最好有大模型应用、智能体平台或字节相关背景。" \
  --sources '["linkedin"]'
```

GTM / 增长 / DevRel：

- 先用宿主 agent 或 source map 建公司池 / 赛道池。
- `--query` 写职能 + 公司池 / 市场 / 地域信号。
- 不推断 relocation、签证、薪资、触达意愿。
- 主要证据是增长、市场、商业化、developer community、partnerships、DevRel 时，
  `functionCategory` 应是 `GTM/增长/DevRel`。

禁止：

- 把中文产品 / GTM 画像翻译成纯英文关键词后丢失语境。
- 只因为 query 中有 Agent / LLM / 大模型，就把非工程候选人归到工程类。
- 在 LinkedIn query 里加入 `site:linkedin.com/in` 或布尔网页搜索语法。

## 4. Research-map query

Research-map 用于 WAM/VLA、论文型人才、技术合伙人、科学顾问、推荐人入口等复杂画像。

规则：

- 先建立 `sourceMap`：paper、lab、company、project、repo、dataset。
- 再从 source map 转入 GitHub / LinkedIn 候选人渠道。
- paper、lab、company、repo、dataset 不能直接进入 `people`。
- 强 PI、founder、产业标杆不自动等于全职候选人；根据项目进入顾问推荐人池、产业标杆池或 warnings。

## 5. X query

X 只在用户明确要求公开表达、社区信号、public posts 或指定 `--sources '["x"]'` 时使用。

禁止：

- 默认搜索或 review-feedback 自动加入 X。
- 因为 query 提到“社区”“传播”“影响力”就隐式调用 X。
- 用 X 结果替代 GitHub/LinkedIn 职业证据。

## 6. Known profile enrichment

用户给出 GitHub / LinkedIn / X URL 或 handle 时，用 `enrich-people`。

规则：

- 只补全用户给出的 profile 或明确 name+company+location。
- 不猜 LinkedIn URL。
- 不把跨渠道 profile 默认合并为同一人；除非 API 返回 same-person hint 或公开证据明确。

## 7. 失败恢复

| 现象                           | 归因                        | 修复                                                               |
| ------------------------------ | --------------------------- | ------------------------------------------------------------------ |
| GitHub 422 / query too long    | GitHub query 混入长反馈     | 缩短 query；完整反馈放 `--feedback`                                |
| GitHub 0 result                | 技术 token 太窄或混入招聘词 | 回到英文技术关键词 + 工程角色词；避免 `候选人`、`找人`             |
| LinkedIn query 丢中文画像      | 过度翻译                    | 保留中文岗位、地区、公司、职能                                     |
| 未授权调用 X                   | sources 约束丢失            | 保留显式 `--sources`；默认不调用 X                                 |
| web/source-map 线索进入 people | source contract 破坏        | 只进 `sourceMap` / `evidenceLog` / `warnings`                      |
| repo fallback 被强推           | quality gate 破坏           | 保留 coverage warning；缺 profile 交叉证据时只作为 source-map 入口 |
