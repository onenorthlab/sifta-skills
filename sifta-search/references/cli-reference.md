# Sifta CLI 参考

这些命令只用于招聘候选人寻访。除非传入 `--pretty`，CLI stdout 默认是 JSON。
Agent 应解析 stdout，并把 stderr 视为状态或调试输出。

当前 CLI 没有 `sifta-cli search` 命令。不要在 skill、报告或用户可复制命令里推荐
`sifta-cli search`；候选人搜索统一使用 `sifta-cli find-people`。

## 目录

- [认证与状态](#认证与状态)
- [命令与连接器边界](#命令与连接器边界)
- [`sifta-cli find-people`](#sifta-cli-find-people)
- [查询合同](#查询合同)
- [结构发现](#结构发现)
- [更新 CLI 和 Skill](#更新-cli-和-skill)
- [输出处理](#输出处理)

## 认证与状态

只有在本轮需要使用 Sifta CLI/API 连接器时才需要认证和状态检查。GitHub 原生搜索、
学术网页搜索或本地文件阅读不依赖这些命令。

```bash
sifta-cli auth "<provided-by-sifta>"
sifta-cli status
```

CLI 默认使用内置的 Sifta API 地址。本地或自托管环境才需要额外指定 `--base-url`。

CLI 会把凭据写入 `~/.sifta-cli/config.json`：

```json
{
	"base_url": "https://sifta.onenorthdev.com/api",
	"api_key": "xxxx",
	"version": "0.0.1"
}
```

如果当前环境没有安装 CLI，先安装 CLI 和完整技能包：

```bash
npx -y @sifta/cli@latest install
```

## 命令与连接器边界

Sifta CLI 是本地 Agent 的命令 / 连接器层，定位接近 MCP tool：访问 Sifta Public API、返回稳定
JSON、暴露结构、warnings 和调用轨迹。它不承担规划、长期记忆、通用搜索、候选人升级策略或完整
sourcing 判断；这些由 skill 和宿主 Agent 负责。不要为了 GitHub token 单独引入 Sifta CLI；
GitHub 默认走宿主 Agent、`gh`、GitHub MCP 或用户自己的 `GH_TOKEN` / `GITHUB_TOKEN`。

当前 Public API 的候选人来源枚举只有 `github`、`linkedin`、`x`。OpenAlex、Google Scholar、
Semantic Scholar、arXiv/OpenReview、Papers with Code、实验室主页、Hugging Face、ModelScope、
知乎、即刻、B 站、公众号和普通网页都属于宿主 Agent 建找人来源和补证据的入口；除非后续
Public API 明确暴露这些 source，否则不要把它们写进 `--sources`。

CLI 稳定性原则：高频、长期稳定的参数才加独立 flag；Public API 新增字段、临时实验字段或低频字段优先通过 `--input` JSON 传入完整请求。显式命令行 flag 会覆盖 `--input` 中的同名字段。不要为某个 skill workflow 增加一层厚封装；优先暴露清晰工具能力，让 skill 编排。

边界判断：

- GitHub 工程证据：宿主 Agent 可优先使用原生 GitHub 搜索、GitHub MCP、`gh` 或浏览器；
  Sifta CLI 只用于统一 JSON、调用轨迹、反馈闭环、回归验证或服务端 direct API 结构稳定性。
  GitHub `--query` 只放英文技术/仓库/工程角色语义；默认地域、用户原始招聘目标、排除项和风险进入
  `--checkpoint`、`--feedback`、`warnings` 或最终输出，不由 CLI 静默改写成 location filter。
- 学术图谱：宿主 Agent 可优先使用 OpenAlex、Google Scholar、Semantic Scholar、
  arXiv、OpenReview、Papers with Code、实验室主页、项目页和 GitHub 构造找人来源；
  Google Scholar 只作为浏览器/人工广泛召回或经批准第三方入口，不假设官方 API；
  Sifta CLI 主要用于研究调用轨迹、候选人结构化和反馈闭环。`--mode research` 不是独立
  学术搜索 provider，也不代表 API 已调用 OpenAlex/Scholar/arXiv。
- LinkedIn 人才搜索和跨轮反馈闭环，是 Sifta CLI/API 的主要增强面。已知个人资料补证据由宿主 Agent 使用本地上下文、公开 profile 和 source-specific skill 自行编排，不再通过服务端补证据 API。

| 命令 / 接入        | 类型           | 写入行为                                    | Agent 规则                                  |
| ------------------ | -------------- | ------------------------------------------- | ------------------------------------------- |
| `sifta-cli status` | 只读           | 读取本地认证和远端可达性                    | 使用 CLI 连接器前运行                       |
| `sifta-cli tools`  | 只读           | 读取 Public API 结构                        | CLI/API 合约变化或命令失败时先运行          |
| `find-people`      | 候选人搜索     | 默认不创建 Web session/run；`--save` 时写入 | 用于候选人召回；默认解析 JSON stdout        |
| 未来写回命令       | 高风险写操作   | 写 ATS/CRM/外部系统                         | 必须先向用户确认对象、字段、内容和目标系统  |
| 可选 MCP 薄包装    | 本地工具适配层 | 复用 CLI/Public API                         | 只包装现有命令，不实现第二套 Agent 运行环境 |

使用 CLI 前先读：

- 模糊意图和追问临界点：[intent-routing.md](intent-routing.md)
- 不同人才方向找人来源：[source-map-recipes.md](source-map-recipes.md)
- 候选人证明包：[fit-proof-packet.md](fit-proof-packet.md)

如果宿主 Agent 支持 MCP，MCP 工具也应保持薄包装：复用同一套 Public API、用户级 API
key、结构、调用轨迹和 warnings；不要在 MCP server 内增加独立规划器、长期记忆、provider
密钥管理或候选人排序策略。

传参边界：

| 维度                   | 归属           | 说明                                                                 |
| ---------------------- | -------------- | -------------------------------------------------------------------- |
| 渠道可执行搜索词       | `--query`      | 只写该渠道真正能消费的语义；GitHub 是英文技术词和工程角色词          |
| 用户原始目标和默认假设 | `--checkpoint` | 保留中文业务语境、默认地域/市场、must-have、avoid、数量              |
| 结构化硬条件           | `--filter`     | 只写用户明确提出的硬地点、标题、技能、公司、职级                     |
| 人工审查反馈           | `--feedback`   | 下一轮约束，不拼进 GitHub `--query`                                  |
| 低频/实验字段          | `--input`      | 不新增厚 CLI flag，直接传 Public API JSON                            |
| 候选人升级/排除判断    | skill 输出阶段 | 读 `people/sourceMap/evidenceLog/warnings` 后判断，不让 CLI 隐式替代 |

GitHub 认证不足时，不推荐用户先装 Sifta CLI。优先提示：

```bash
gh auth status
gh auth login
# 或在当前宿主 Agent 环境设置：
export GH_TOKEN="<github-token>"
export GITHUB_TOKEN="<github-token>"
```

Sifta CLI 的 GitHub direct path 只作为可选回归/trace/API 合同路径，不是普通 GitHub sourcing 的主路径。

## 更新 CLI 和 Skill

CLI 输出 JSON 时，如果发现新版本，顶层会追加 `_notice.update`，包含远端最新版本号和更新命令：

```json
{
	"_notice": {
		"update": {
			"cli": "0.0.12",
			"skill": "0.0.7",
			"message": "Sifta update available: CLI 0.0.11 -> 0.0.12; skill 0.0.6 -> 0.0.7",
			"command": "sifta-cli update"
		}
	}
}
```

`cli` 和 `skill` 只在对应组件有更新时出现。Agent 解析候选人结果时应忽略 `_notice.update`，优先读取
`people`、`searchStrategy`、`sourceMap`、`evidenceLog`、`crmExport` 和 `warnings`。
Agent 应先完成当前请求，再向用户说明有新版本并提示更新命令。
普通业务命令会节流刷新本地版本缓存；刷新失败不影响当前业务输出。`sifta-cli update --check --json`
用于显式检查更新。

检查更新：

```bash
sifta-cli update --check --json
```

只验证更新计划、不执行安装：

```bash
sifta-cli update --dry-run --json
```

同步更新 CLI 和 Sifta 技能包：

```bash
sifta-cli update
```

旧版 CLI 更新失败或需要手动兜底时，先升级 CLI，再同步完整技能包：

```bash
npm install -g @sifta/cli@latest
npx -y skills add onenorthlab/sifta-skills -g --all
```

更新完成后，重启 Agent 或新开会话，让新 Skill 生效。

## `sifta-cli find-people`

用于 Skill / Agent 的候选人搜索入口。

```bash
sifta-cli find-people \
  --query "AI Agent MCP LLM observability infra engineer open source" \
  --checkpoint "找上海 AI Agent/infra 工程师，有 LLM observability 开源证据" \
  --filter '{"titles":["AI Engineer","Infra Engineer"],"skills":["AI Agent","LLM observability"],"locations":["Shanghai"]}' \
  --feedback '[{"feedback":"上一轮候选人更像顾问，请从学生、共同作者、前同事继续扩展全职候选"}]' \
  --sources '["github"]' \
  --target-count 10 \
  --save
```

参数：

| 参数                  | 必填     | 说明                                                                       |
| --------------------- | -------- | -------------------------------------------------------------------------- |
| `--input <json>`      | 否       | 完整 `find_people` 请求 JSON 对象；显式 flag 会覆盖同名字段。              |
| `--query <text>`      | 请求必填 | 给连接器的主搜索文本；可由 `--input.query` 提供。                          |
| `--checkpoint <text>` | 请求必填 | 用户本轮原始输入；可由 `--input.checkpoint` 提供。不要写复述或压缩搜索词。 |
| `--filter <json>`     | 否       | 结构化筛选条件 JSON 对象。                                                 |
| `--feedback <json>`   | 否       | 人工审查反馈 JSON 数组；由 Agent 根据上一轮结果和用户反馈整理。            |
| `--target-count <n>`  | 否       | 目标候选人数，1-10。                                                       |
| `--sources <json>`    | 否       | 候选人来源 JSON 字符串数组；当前只支持 `github`、`linkedin`、`x`。         |
| `--mode <mode>`       | 否       | `default` 或 `research`。                                                  |
| `--save`              | 否       | 保存本轮结果到 Web `/sourcing` 历史；等价于 Public API `persist: true`。   |
| `--trace`             | 否       | 返回脱敏 `toolTrace`，用于渠道输入或工具调用排查。                         |
| `--pretty`            | 否       | 人类可读输出。不要用于 Agent 解析。                                        |

默认不要 `--save`：探索性宽召回、弱证据结果或尚未人工审查的试探查询只保留 JSON。用户明确要求保存、落库、同步到 Web、稍后回看，或 Agent 判断本轮结果已通过基本质量门、值得沉淀给用户复核时，追加 `--save`。保存成功后 JSON 会包含：

```json
{
	"persisted": {
		"sessionId": "session_id",
		"runId": "run_id",
		"candidateCount": 3,
		"webPath": "/sourcing?sessionId=session_id"
	}
}
```

最终回复应把 `persisted.webPath` 作为 Web 回看路径给用户。`--save` 只写入当前用户 API key 所属账号，不接受 CLI 传入 `userId`。

`--input` 用于减少 CLI 后续变动。下面两条命令等价，后一种适合 API 增加低频字段或临时实验字段时使用：

```bash
sifta-cli find-people \
  --query "AI Agent MCP LLM infra engineer open source" \
  --checkpoint "找上海 AI Agent 工程师" \
  --sources '["github"]' \
  --save

sifta-cli find-people \
  --input '{"query":"AI Agent MCP LLM infra engineer open source","checkpoint":"找上海 AI Agent 工程师","sources":["github"],"persist":true}'
```

`--sources` 必须是 JSON 字符串数组，例如 `--sources '["github"]'` 或
`--sources '["linkedin"]'`。不要写 `--sources github`、`--sources linkedin` 或
`sources=github`；这些容易让本地 Agent 复制成非结构化参数。不要把 OpenAlex、Scholar、
arXiv、Hugging Face、ModelScope、网页、公司页或社区平台写入 `--sources`；它们是找人来源
和证据补全入口，不是当前 Public API 的候选人 source。

使用 Sifta CLI 时，`--query` 必须符合按来源定制的查询合同，详见
[query-contract.md](query-contract.md)。简要规则：

- GitHub：英文技术关键词 + 工程角色词，例如 `AI Agent MCP LLM infra engineer open source`。
- LinkedIn / 产品 / GTM：用户语言的自然人才画像，保留中文岗位、地区、公司和职能信号。
- 研究找人来源：先保留 paper/lab/company/project/repo/dataset 找人来源线索，再转候选人渠道。
- 学术图谱寻访：找人来源可由宿主 Agent 原生学术 / 网页搜索建立；使用 CLI 时
  `--mode research` 只作为 direct connector 默认来源选择、结构化调用轨迹和连接器输入，
  不是独立学术搜索 provider。应说明是否综合
  OpenAlex、Google Scholar、Semantic Scholar、arXiv/OpenReview、Papers with Code 或
  lab/project/homepage。再用 GitHub/LinkedIn/个人主页验证候选人；不要把论文作者直接放进候选人。
- X：只有用户明确授权 X / 公开帖子 / 社区信号时使用。

`--feedback` 用于多轮反馈闭环。Agent 应把用户人工反馈整理成短 JSON 数组，保留
`feedback`、`constraints`、`exclusions` 和 `expansionSeeds`。反馈会进入服务端
`feedbackIngest`，用于影响下一轮 `searchStrategy`、推荐名单、`whyNot` 和
`nextAction`。

如果上一轮人工审查同时包含 GitHub 和 LinkedIn，Agent 应按来源拆成多条
指定来源请求。分别执行需要的来源命令，不要把 GitHub 英文查询和 LinkedIn
中文画像合并成一条混合来源命令。

当前支持的 filter 字段：

| 字段          | 类型       | 示例                                 |
| ------------- | ---------- | ------------------------------------ |
| `titles`      | `string[]` | `["AI Engineer", "Product Manager"]` |
| `locations`   | `string[]` | `["Shanghai", "Remote China"]`       |
| `skills`      | `string[]` | `["AI Agent", "embodied AI"]`        |
| `companies`   | `string[]` | `["Qwen", "ByteDance"]`              |
| `seniorities` | `string[]` | `["senior", "staff"]`                |

## 查询合同

详细规则见 [query-contract.md](query-contract.md)。这里给最常见的三类命令。

GitHub 工程岗：

```bash
sifta-cli find-people \
  --query "AI Agent MCP LLM infra engineer open source" \
  --checkpoint "找 1 个有 AI Agent、MCP 或 LLM infra 的工程人选，优先 GitHub。" \
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

学术图谱通道（需要 Sifta 研究调用轨迹时）：

```bash
sifta-cli find-people \
  --query "LLM reasoning math code training efficiency young researcher PhD intern OpenAlex Google Scholar Semantic Scholar arXiv OpenReview Papers with Code lab project coauthor competition China" \
  --checkpoint "帮一家基础模型团队找 1 个中国生态的高潜研究工程师或研究员。方向是 LLM 推理、数学、代码能力或训练效率。请先综合 OpenAlex、Google Scholar、Semantic Scholar、arXiv/OpenReview、Papers with Code、实验室、导师/共同作者、竞赛或项目页拆找人来源，再转成候选人搜索。Google Scholar 只作为浏览器/人工广泛召回，不假设官方 API；不要把论文作者直接当候选人；必须找到个人资料、GitHub、LinkedIn 或个人主页证据。" \
  --mode research \
  --target-count 1 \
  --trace
```

反馈闭环：

```bash
sifta-cli find-people \
  --query "<下一轮指定来源查询>" \
  --checkpoint "<用户原始目标>" \
  --feedback '[{"feedback":"上一轮候选人更像顾问，请继续找全职候选","constraints":["保留工程落地证据"],"exclusions":["纯论文资料"]}]' \
  --sources '["github"]'
```

下一轮 GitHub 查询必须是短技术关键词；完整人工反馈必须在 `--feedback` JSON 中。
如果反馈涉及多个来源，按来源分别执行对应命令。

## 结构发现

当快捷命令因为 CLI/API 合约变化而失败时，先查看服务端结构，再改用明确 CLI 命令。

```bash
sifta-cli tools
```

工具名：

| 工具          | 用途             |
| ------------- | ---------------- |
| `find_people` | 搜索招聘候选人。 |

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
| `sourceMap`       | 论文、公司、实验室、项目、repo、dataset 等找人来源        |
| `evidenceLog`     | 候选人级证据日志，包含 candidateKey、source、url、claim   |
| `feedbackIngest`  | 用户反馈转成的下一轮约束、排除项和扩展种子                |
| `crmExport`       | 适合飞书 Base / CSV 的稳定字段导出                        |

本地真实验证：

```bash
SIFTA_API_BASE_URL="http://localhost:3050/api" \
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
- `toolTrace[].request` 是否展示每个渠道真实收到的输入；trace 已脱敏，但仍只用于调试和核验。
- `people[].raw`、`evidenceLog`、`crmExport` 是否能支撑候选人判断。
- `warnings` 是否说明未满足的偏好、证据缺口或下一步扩展方向。
