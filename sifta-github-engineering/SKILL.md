---
name: sifta-github-engineering
metadata:
    version: 0.0.6
    tags: [sifta-search, recruiting, sourcing, github, engineering]
description: >
    用于 AI 工程候选人 sourcing，特别是用户要求开源证据、GitHub profile、
    AI Agent、MCP、LLM infra、SDK、runtime、observability、RAG/embedding infra、
    模型应用基础设施、repo contributors、package registry 或 developer proof-of-work 候选人时使用。
    非招聘 repo 调研、公司技术分析、开源项目评估、KOL 合作、PM/GTM 或纯论文综述不要使用。
---

# Sifta GitHub Engineering

招聘目标依赖公开工程 proof-of-work 时走 GitHub-first。GitHub-first 是 primary evidence
channel，不是 exclusive channel：论文、项目页、Papers with Code、company page 或个人主页可以
作为 source-map / identity 补充，但最终工程候选人仍要回到 GitHub profile、repo、个人主页或
等价公开工程证据。GitHub query 使用英文技术关键词和工程角色词，不使用通用网页搜索语法，也不塞
中文招聘叙述。

## Workflow

1. 先确认这是招聘目标；缺 geo、seniority 或数量不阻塞，写入 Assumptions 后推进。
2. 先判断执行面：宿主 agent 的 native GitHub search / GitHub MCP / `gh` 足够时优先使用它们。
3. 需要 Sifta 统一 JSON、trace、review loop，或用户明确要求 Sifta CLI 时，再运行 `sifta-cli status`。
4. 保留用户原始请求作为 `--checkpoint`。
5. `--query` 只放英文技术关键词和角色词，例如 `AI Agent MCP LLM infra engineer open source`。
6. 使用 `--sources '["github"]'`；不要因为 0 result 自动切到 LinkedIn 或 X。若需要外部补充，
   先把 paper/project/company/person leads 写入 `sourceMap` 和 Coverage Warnings。
7. repo/topic/package 命中先是 `source-map lead`；有个人 profile、贡献深度和身份交叉信号后才升级候选。
8. 输出 Candidate Buckets 和 Fit Proof Packet，显式写 Coverage Warnings。

```bash
sifta-cli find-people \
  --query "AI Agent MCP LLM infra engineer open source" \
  --checkpoint "<用户原始招聘目标>" \
  --sources '["github"]' \
  --target-count 10
```

## Quality Gates

- repository fallback 默认是弱线索或待核验，不等于强候选人。
- 只有同时有个人 profile、工程项目、公司/经历或身份交叉信号时，才进入候选池。
- `priority=C`、职业工程证据弱、provider errors、repository fallback 都必须写入 Coverage Warnings。
- native GitHub search 结果也要按同一质量门解释，不能因为不是 CLI 结果就降低证据要求。
- GitHub-first 不排斥学术或网页线索；这些线索只能帮助定位 repo/profile，不能替代候选人证据。
- generic `awesome-*` list、topic list、star/fork 高但缺实现证据的 repo，只能作为 source-map
  或生态影响线索；必须补 maintainer commit、core implementation repo、package、issue/PR 或产品代码证据后才升级。
- Founder、CEO、CTO、高知名度 maintainer 默认放入 `产业标杆` / `推荐人` / `founder-level candidate`
  桶；除非用户明确要 founder-level 候选，否则不要把可招募性未知的人包装成普通全职候选。

## Recall Seeds

Agent/MCP/LLM infra 真实召回时，优先使用能指向实现型贡献的 seed，例如 `FastMCP`、
`model-context-protocol`、`MCP server`、`MCP gateway`、`LiteLLM`、`LLM gateway`、
`agent runtime`、`tool calling`、`observability`、`evaluation framework`。降低只命中
`awesome-list`、curated list 或泛 `AI tools` repo 的权重，并把原因写进 Coverage Warnings。

## References

| Reference | 何时读取 |
| --- | --- |
| [CLI contract](../sifta-search/references/cli-reference.md) | 调用 CLI、auth/status/schema 失败或需要 trace |
| [Query rules](../sifta-search/references/query-contract.md) | 写 GitHub query、修 sources 或处理 0 result |
| [Source map recipes](../sifta-search/references/source-map-recipes.md) | repo fallback、awesome-list、paper/project leads 较多 |
| [State gate](../sifta-search/references/project-brief-and-state.md) | 判断 source-map lead 能否升级候选 |
| [Fit proof](../sifta-search/references/fit-proof-packet.md) / [Output rules](../sifta-search/references/output-quality.md) | 输出候选表和 Coverage Warnings |
