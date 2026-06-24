# Sifta CLI 参考

这些命令只用于招聘候选人 sourcing。除非传入 `--pretty`，CLI stdout 默认是 JSON。
Agent 应解析 stdout，并把 stderr 视为状态或调试输出。

## 目录

- [认证与状态](#认证与状态)
- [命令与 Connector 边界](#命令与-connector-边界)
- [`sifta-cli search`](#sifta-cli-search)
- [`sifta-cli find-people`](#sifta-cli-find-people)
- [`sifta-cli enrich-people`](#sifta-cli-enrich-people)
- [Query 合同](#query-合同)
- [Schema 发现](#schema-发现)
- [更新 CLI 和 Skill](#更新-cli-和-skill)
- [输出处理](#输出处理)

## 认证与状态

只有在本轮需要使用 Sifta CLI/API connector 时才需要认证和状态检查。GitHub native search、
academic web search 或本地文件阅读不依赖这些命令。

```bash
sifta-cli auth "<provided-by-sifta>" --base-url "https://sifta.onenorthdev.com/api"
sifta-cli status
```

CLI 会把凭据写入 `~/.sifta-cli/config.json`：

```json
{
	"base_url": "https://sifta.onenorthdev.com/api",
	"api_key": "xxxx",
	"version": "0.0.1"
}
```

如果当前环境没有安装 CLI，先安装：

```bash
npm install -g @sifta/cli@latest
```

## 命令与 Connector 边界

Sifta CLI 是本地 agent 的 command/connector 层。它只负责访问 Sifta Public API、返回稳定
JSON、暴露 schema 和 trace；不承担 planner、memory、通用搜索或候选人策略。

边界判断：

- GitHub 工程证据：宿主 agent 可优先使用 native GitHub search、GitHub MCP、`gh` 或浏览器；
  Sifta CLI 主要用于统一 JSON、trace、review loop、token-backed connector 和 schema 稳定性。
- Academic graph：宿主 agent 可优先使用 OpenAlex、Google Scholar、Semantic Scholar、
  arXiv、OpenReview、Papers with Code、实验室主页、项目页和 GitHub 构造 source map；
  Google Scholar 只作为浏览器/人工 broad recall 或经批准第三方入口，不假设官方 API；
  Sifta CLI 主要用于 research trace、候选人结构化和 review feedback。
- LinkedIn people search、已知 profile enrichment 和跨轮反馈闭环，是 Sifta CLI/API 的主要
  增强面。

| 命令 / 接入           | 类型           | 写入行为                              | Agent 规则                                     |
| --------------------- | -------------- | ------------------------------------- | ---------------------------------------------- |
| `sifta-cli status`    | 只读           | 读取本地认证和远端可达性              | 使用 CLI connector 前运行                      |
| `sifta-cli tools`     | 只读           | 读取 Public API schema                | CLI/API 合约变化或命令失败时先运行             |
| `find-people`         | 只读搜索       | 不创建 Web session/run                | 用于候选人召回；默认解析 JSON stdout           |
| `enrich-people`       | 候选人补全     | 用户级 API key 下可能写入 session/run | 只用于已知 profile/handle/name 的补证据        |
| 未来写回命令          | 高风险写操作   | 写 ATS/CRM/外部系统                   | 必须先向用户确认对象、字段、内容和目标系统     |
| 可选 MCP thin wrapper | 本地工具适配层 | 复用 CLI/Public API                   | 只包装现有 command，不实现第二套 agent runtime |

使用 CLI 前先读：

- 模糊意图和追问临界点：[intent-routing.md](intent-routing.md)
- 不同人才方向来源地图：[source-map-recipes.md](source-map-recipes.md)
- 候选人证明包：[fit-proof-packet.md](fit-proof-packet.md)

如果宿主 agent 支持 MCP，MCP 工具也应保持 thin wrapper：复用同一套 Public API、用户级 API
key、schema、trace 和 warnings；不要在 MCP server 内增加独立 planner、长期 memory、provider
密钥管理或候选人排序策略。

## 更新 CLI 和 Skill

CLI 输出 JSON 时，如果发现新版本，顶层会追加 `_notice.update`，只包含远端最新版本号：

```json
{ "_notice": { "update": { "cli": "0.0.3" } } }
```

`update` 里只出现有更新的组件版本。Agent 应先完成当前请求，再向用户说明有新版本并提示更新命令。
普通业务命令只读取本地版本缓存；`sifta-cli update --check --json` 才会主动联网刷新缓存。

检查更新：

```bash
sifta-cli update --check --json
```

同步更新 CLI 和 Sifta skill suite：

```bash
sifta-cli update
```

更新完成后，重启 agent 或新开会话，让新 skill 生效。

## `sifta-cli search`

简单自然语言候选人搜索入口。Agent 如果已经把用户输入改写成 connector query，必须同时传
`--checkpoint` 保存用户本轮原始输入。

```bash
sifta-cli search "AI Agent MCP LLM infra engineer open source" \
  --checkpoint "上海 AI Agent 工程师，偏 infra，有开源项目" \
  --limit 10 \
  --sources '["github"]' \
  --json
```

参数：

| 参数                  | 必填       | 说明                                                 |
| --------------------- | ---------- | ---------------------------------------------------- |
| `<query>`             | 是         | 候选人搜索文本。                                     |
| `--checkpoint <text>` | Agent 必填 | 用户本轮原始输入；不要写复述、翻译或压缩后的搜索词。 |
| `--limit <n>`         | 否         | 搜索结果数量，1-50。                                 |
| `--sources <json>`    | 否         | 候选人来源 JSON 字符串数组。                         |
| `--mode <mode>`       | 否         | `default` 或 `research`。                            |
| `--json`              | 否         | JSON 输出。                                          |

## `sifta-cli find-people`

用于 Skill / agent 的候选人搜索入口。

```bash
sifta-cli find-people \
  --query "AI Agent MCP LLM observability infra engineer open source" \
  --checkpoint "找上海 AI Agent/infra 工程师，有 LLM observability 开源证据" \
  --filter '{"titles":["AI Engineer","Infra Engineer"],"skills":["AI Agent","LLM observability"],"locations":["Shanghai"]}' \
  --feedback '[{"feedback":"上一轮候选人更像顾问，请从学生、共同作者、前同事继续扩展全职候选"}]' \
  --sources '["github"]' \
  --target-count 10
```

参数：

| 参数                  | 必填       | 说明                                                               |
| --------------------- | ---------- | ------------------------------------------------------------------ |
| `--query <text>`      | 是         | 给 connector 的主搜索文本。                                        |
| `--checkpoint <text>` | Agent 必填 | 用户本轮原始输入；不要写复述、翻译或压缩后的搜索词。               |
| `--filter <json>`     | 否         | 结构化筛选条件 JSON 对象。                                         |
| `--feedback <json>`   | 否         | 人工审查反馈 JSON 数组；通常由 `pnpm sifta:review-feedback` 生成。 |
| `--target-count <n>`  | 否         | 目标候选人数，1-50。                                               |
| `--sources <json>`    | 否         | 候选人来源 JSON 字符串数组。                                       |
| `--mode <mode>`       | 否         | `default` 或 `research`。                                          |
| `--trace`             | 否         | 返回脱敏 `toolTrace`，用于 eval、真实 smoke 和渠道输入排查。       |
| `--pretty`            | 否         | 人类可读输出。不要用于 agent 解析。                                |

`--sources` 必须是 JSON 字符串数组，例如 `--sources '["github"]'` 或
`--sources '["linkedin"]'`。不要写 `--sources github`、`--sources linkedin` 或
`sources=github`；这些容易让本地 agent 复制成非 schema 化参数。

使用 Sifta CLI 时，`--query` 必须符合 source-specific contract，详见
[query-contract.md](query-contract.md)。简要规则：

- GitHub：英文技术关键词 + 工程角色词，例如 `AI Agent MCP LLM infra engineer open source`。
- LinkedIn / 产品 / GTM：用户语言的自然人才画像，保留中文岗位、地区、公司和职能信号。
- Research-map：先保留 paper/lab/company/project/repo/dataset source-map 线索，再转候选人渠道。
- Academic graph sourcing：source map 可由宿主 agent 原生学术 / web 搜索建立；使用 CLI 时
  `--mode research` 只作为结构化 trace 和 connector 输入，不是唯一执行路径。应说明是否综合
  OpenAlex、Google Scholar、Semantic Scholar、arXiv/OpenReview、Papers with Code 或
  lab/project/homepage。再用 GitHub/LinkedIn/个人主页验证候选人；不要把论文作者直接放进候选人。
- X：只有用户明确授权 X / public posts / community signal 时使用。

`--feedback` 用于多轮 review loop。Agent 不要手写复杂长 prompt；优先从人工填写的
`feedback-template.json` 运行：

```bash
pnpm sifta:review-feedback --out <review-dir> <review-dir>/feedback-template.json
```

然后复制 `next-search.json` 或 `next-search.md` 中生成的 `sifta-cli find-people`
命令。反馈会进入服务端 `feedbackIngest`，用于影响下一轮 `searchStrategy`、候选人分桶、
`whyNot` 和 `nextAction`。

如果上一轮 review 同时包含 GitHub 和 LinkedIn，`sifta:review-feedback` 会生成多条
source-specific request。Agent 应分别执行需要的来源命令，不要把 GitHub 英文 query 和
LinkedIn 中文画像合并成一条混合来源命令。

当前支持的 filter 字段：

| 字段          | 类型       | 示例                                 |
| ------------- | ---------- | ------------------------------------ |
| `titles`      | `string[]` | `["AI Engineer", "Product Manager"]` |
| `locations`   | `string[]` | `["Shanghai", "Remote China"]`       |
| `skills`      | `string[]` | `["AI Agent", "embodied AI"]`        |
| `companies`   | `string[]` | `["Qwen", "ByteDance"]`              |
| `seniorities` | `string[]` | `["senior", "staff"]`                |

## Query 合同

详细规则见 [query-contract.md](query-contract.md)。这里给最常见的三类命令。

GitHub 工程岗：

```bash
sifta-cli find-people \
  --query "AI Agent MCP LLM infra engineer open source" \
  --checkpoint "找 1 个有 AI Agent、MCP 或 LLM infra 的工程候选人，优先 GitHub。" \
  --sources '["github"]' \
  --target-count 1 \
  --trace
```

LinkedIn 产品岗：

```bash
sifta-cli find-people \
  --query "上海 AI Agent 产品经理，具备大模型应用、智能体平台或 Agent 产品规划经验" \
  --checkpoint "我们要找上海 AI Agent 产品经理，最好有大模型应用、智能体平台或字节相关背景。" \
  --sources '["linkedin"]' \
  --target-count 1 \
  --trace
```

Academic graph 学术通道（需要 Sifta research trace 时）：

```bash
sifta-cli find-people \
  --query "LLM reasoning math code training efficiency young researcher PhD intern OpenAlex Google Scholar Semantic Scholar arXiv OpenReview Papers with Code lab project coauthor competition China" \
  --checkpoint "帮一家基础模型团队找 1 个中国生态的高潜研究工程师或研究员。方向是 LLM 推理、数学、代码能力或训练效率。请先综合 OpenAlex、Google Scholar、Semantic Scholar、arXiv/OpenReview、Papers with Code、实验室、导师/共同作者、竞赛或项目页拆 source map，再转成候选人搜索。Google Scholar 只作为浏览器/人工 broad recall，不假设官方 API；不要把论文作者直接当候选人；必须找到个人 profile、GitHub、LinkedIn 或个人主页证据。" \
  --mode research \
  --target-count 1 \
  --trace
```

Review feedback loop：

```bash
pnpm sifta:review-feedback --out <review-dir>/next <review-dir>/feedback-template.json
```

生成的下一轮 GitHub query 必须是短技术关键词；完整人工反馈必须在 `--feedback` JSON 中。
如果 `next-search.json` 有多条 `cases`，按 `request.sources` 分别执行对应来源。

## `sifta-cli enrich-people`

用于已知候选人 profile 或 handle 的补全。每次最多 10 人。

```bash
sifta-cli enrich-people \
  --people '[{"githubUrl":"https://github.com/example"}]'

sifta-cli enrich-people \
  --people '[{"linkedinUrl":"https://www.linkedin.com/in/example/"}]'

sifta-cli enrich-people \
  --people '[{"name":"张三","company":"某 AI 公司","location":"上海"}]' \
  --sources '["linkedin"]'
```

已知候选人字段：

| 字段             | 说明                                 |
| ---------------- | ------------------------------------ |
| `githubUrl`      | 公开 GitHub profile URL。            |
| `linkedinUrl`    | 公开 LinkedIn profile URL。          |
| `twitterHandle`  | 公开 Twitter/X handle。              |
| `xiaohongshuUrl` | 公开小红书 profile URL。             |
| `name`           | 没有 URL/handle 时使用的候选人姓名。 |
| `company`        | 用于消除重名歧义。                   |
| `location`       | 用于消除重名歧义。                   |

参数：

| 参数               | 必填 | 说明                                   |
| ------------------ | ---- | -------------------------------------- |
| `--people <json>`  | 是   | 已知候选人对象 JSON 数组，最多 10 个。 |
| `--sources <json>` | 否   | 要使用的来源 JSON 字符串数组。         |
| `--pretty`         | 否   | 人类可读输出。不要用于 agent 解析。    |

当前 v1 支持 GitHub 和 LinkedIn 补全。GitHub 需要明确 `githubUrl`；LinkedIn 有
`linkedinUrl` 时读取公开 profile 内容，没有 URL 时可用姓名、公司、地点做 LinkedIn
people search 兜底。其他来源可能返回 warnings，应把 warnings 告知用户，不要过度承诺。

## Schema 发现

当快捷命令因为 CLI/API 合约变化而失败时，先查看服务端 schema，再改用明确 CLI 命令。

```bash
sifta-cli tools
```

工具名：

| 工具            | 用途                               |
| --------------- | ---------------------------------- |
| `find_people`   | 搜索招聘候选人。                   |
| `enrich_people` | 用公开证据补全已知候选人 profile。 |

## 输出处理

`find-people` 结果形态示例：

```json
{
	"searchId": "srch_...",
	"query": "...",
	"mode": "default",
	"executedSources": ["github", "linkedin"],
	"people": [
		{
			"id": "github:example",
			"source": "github",
			"displayName": "Example",
			"profileUrl": "https://github.com/example",
			"headline": "optional",
			"location": "optional",
			"matchReasons": ["..."],
			"riskFlags": [],
			"raw": {}
		}
	],
	"warnings": []
}
```

Agent 处理规则：

- 解析 stdout 为 JSON。
- 相关时向用户展示 `warnings`。
- 使用 `profileUrl`、`matchReasons`、`raw.evidence`、`raw.evidencePacket`、`riskFlags` 和 `evidenceLog` 作为证据。
- 如果返回 `sourcingProject`、`searchStrategy`、`sourceMap`、`feedbackIngest` 或 `crmExport`，优先使用这些结构化字段解释搜索路径、项目判断、反馈约束和 CRM 导出字段。
- 不要编造 JSON 中不存在的字段。

结构化字段说明：

| 字段              | 说明                                                      |
| ----------------- | --------------------------------------------------------- |
| `sourcingProject` | 本轮项目目标、目标角色、地域偏好、must-have、avoid 和假设 |
| `searchStrategy`  | Agent 使用的搜索路径，例如 company-first、linkedin-first  |
| `sourceMap`       | 论文、公司、实验室、项目、repo、dataset 等来源地图        |
| `evidenceLog`     | 候选人级证据日志，包含 candidateKey、source、url、claim   |
| `feedbackIngest`  | 用户反馈转成的下一轮约束、排除项和扩展种子                |
| `crmExport`       | 适合飞书 Base / CSV 的稳定字段导出                        |

本地真实验证：

```bash
SIFTA_API_BASE_URL="http://localhost:3311/api" \
SIFTA_API_KEY="<local public api key>" \
sifta-cli find-people \
  --query "在上海的 AI Agent 产品经理或产品负责人，具备大模型应用、智能体平台或 Agent 产品规划经验" \
  --checkpoint "我们要找上海 AI Agent 产品经理，最好有大模型应用、智能体平台或字节相关背景，帮我找 3 个候选人。" \
  --sources '["linkedin"]' \
  --target-count 3 \
  --trace
```

验证时必须检查：

- `query` 是否保留用户语言、岗位、方向、地区和证据信号。
- `checkpoint` 是否是用户原始目标，而不是改写后的搜索词。
- `executedSources` 是否符合 `--sources` 或 skill 选择。
- `toolTrace[].request` 是否展示每个渠道真实收到的输入；trace 已脱敏，但仍只用于调试和 eval。
- `people[].raw`、`evidenceLog`、`crmExport` 是否能支撑候选人判断。
- `warnings` 是否说明未满足的偏好、证据缺口或下一步扩展方向。
