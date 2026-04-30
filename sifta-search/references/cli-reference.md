# Sifta CLI 参考

这些命令只用于招聘候选人 sourcing。除非传入 `--pretty`，CLI stdout 默认是 JSON。
Agent 应解析 stdout，并把 stderr 视为状态或调试输出。

## 目录

- [认证与状态](#认证与状态)
- [`sifta-cli search`](#sifta-cli-search)
- [`sifta-cli find-people`](#sifta-cli-find-people)
- [`sifta-cli enrich-people`](#sifta-cli-enrich-people)
- [Schema 发现](#schema-发现)
- [输出处理](#输出处理)

## 认证与状态

```bash
sifta-cli auth "<provided-by-sifta>" --base-url "https://api.sifta.onenorthdev.com"
sifta-cli status
```

CLI 会把凭据写入 `~/.sifta-cli/config.json`：

```json
{
  "base_url": "https://api.sifta.onenorthdev.com",
  "api_key": "xxxx",
  "version": "0.0.1"
}
```

如果当前环境没有安装 CLI，先安装：

```bash
npm install -g @sifta/cli@latest
```

## `sifta-cli search`

简单自然语言候选人搜索入口。Agent 如果已经把用户输入改写成 connector query，必须同时传
`--checkpoint` 保存用户本轮原始输入。

```bash
sifta-cli search "AI Agent engineer infra open source Shanghai" \
  --checkpoint "上海 AI Agent 工程师，偏 infra，有开源项目" \
  --limit 10 \
  --sources '["github"]' \
  --json
```

参数：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `<query>` | 是 | 候选人搜索文本。 |
| `--checkpoint <text>` | Agent 必填 | 用户本轮原始输入；不要写复述、翻译或压缩后的搜索词。 |
| `--limit <n>` | 否 | 搜索结果数量，1-50。 |
| `--sources <json>` | 否 | 候选人来源 JSON 字符串数组。 |
| `--mode <mode>` | 否 | `default` 或 `research`。 |
| `--json` | 否 | JSON 输出。 |

## `sifta-cli find-people`

用于 Skill / agent 的候选人搜索入口。

```bash
sifta-cli find-people \
  --query "AI Agent engineer LLM observability Shanghai open source evidence" \
  --checkpoint "找上海 AI Agent/infra 工程师，有 LLM observability 开源证据" \
  --filter '{"titles":["AI Engineer","Infra Engineer"],"skills":["AI Agent","LLM observability"],"locations":["Shanghai"]}' \
  --sources '["github"]' \
  --target-count 10
```

参数：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `--query <text>` | 是 | 给 connector 的主搜索文本。 |
| `--checkpoint <text>` | Agent 必填 | 用户本轮原始输入；不要写复述、翻译或压缩后的搜索词。 |
| `--filter <json>` | 否 | 结构化筛选条件 JSON 对象。 |
| `--target-count <n>` | 否 | 目标候选人数，1-50。 |
| `--sources <json>` | 否 | 候选人来源 JSON 字符串数组。 |
| `--mode <mode>` | 否 | `default` 或 `research`。 |
| `--pretty` | 否 | 人类可读输出。不要用于 agent 解析。 |

当前支持的 filter 字段：

| 字段 | 类型 | 示例 |
| --- | --- | --- |
| `titles` | `string[]` | `["AI Engineer", "Product Manager"]` |
| `locations` | `string[]` | `["Shanghai", "Remote China"]` |
| `skills` | `string[]` | `["AI Agent", "embodied AI"]` |
| `companies` | `string[]` | `["Qwen", "ByteDance"]` |
| `seniorities` | `string[]` | `["senior", "staff"]` |

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

| 字段 | 说明 |
| --- | --- |
| `githubUrl` | 公开 GitHub profile URL。 |
| `linkedinUrl` | 公开 LinkedIn profile URL。 |
| `twitterHandle` | 公开 Twitter/X handle。 |
| `xiaohongshuUrl` | 公开小红书 profile URL。 |
| `name` | 没有 URL/handle 时使用的候选人姓名。 |
| `company` | 用于消除重名歧义。 |
| `location` | 用于消除重名歧义。 |

参数：

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `--people <json>` | 是 | 已知候选人对象 JSON 数组，最多 10 个。 |
| `--sources <json>` | 否 | 要使用的来源 JSON 字符串数组。 |
| `--pretty` | 否 | 人类可读输出。不要用于 agent 解析。 |

当前 v1 支持 GitHub 和 LinkedIn 补全。GitHub 需要明确 `githubUrl`；LinkedIn 有
`linkedinUrl` 时读取公开 profile 内容，没有 URL 时可用姓名、公司、地点做 LinkedIn
people search 兜底。其他来源可能返回 warnings，应把 warnings 告知用户，不要过度承诺。

## Schema 发现

当快捷命令因为 CLI/API 合约变化而失败时，先查看服务端 schema，再改用明确 CLI 命令。

```bash
sifta-cli tools
```

工具名：

| 工具 | 用途 |
| --- | --- |
| `find_people` | 搜索招聘候选人。 |
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
- 使用 `profileUrl`、`matchReasons`、`raw.evidences` 和 `riskFlags` 作为证据。
- 不要编造 JSON 中不存在的字段。
