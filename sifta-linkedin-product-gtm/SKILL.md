---
name: sifta-linkedin-product-gtm
metadata:
    version: 0.0.6
    tags: [sifta-search, recruiting, sourcing, linkedin, product, gtm]
description: >
    只在用户明确要找 AI 产品/GTM/增长/商业化/DevRel/partnerships 候选人、人选或人才时使用。
    明确不找候选人/不做 sourcing 的公司研究、市场分析、增长打法、商业化模式、JD、销售 lead、渠道合作/KOL 不要使用。
    找 BD/市场负责人等 people lead 且要求私人邮箱、手机号、自动发送或批量外联时，只 hard stop，不搜索。
    使用 LinkedIn/career profile 作为主候选证据，避免把非工程职能误路由到 GitHub。
---

# Sifta LinkedIn Product and GTM

主要证据来自职业 profile、产品 ownership、GTM、增长、商业化、partnerships、DevRel 或相邻
公司经历时走 LinkedIn-first。LinkedIn-first 是 primary people channel，不是 exclusive channel：
company map、产品页、GitHub repo、developer community、X/public posts 或媒体报道可以做辅助
source map，尤其适用于 DevRel、developer marketing、open-source community 和 AI 产品生态岗位；
但非工程候选人的主候选人证据仍应回到 LinkedIn、个人主页或明确职业 profile。这里 Sifta CLI/API
的 connector 价值更明确；宿主 agent 没有稳定 LinkedIn people access 时优先用 Sifta。

## Workflow

1. 先确认岗位族是 Product/GTM/DevRel 或可从用户目标推断；不要因 AI/Agent/LLM 自动转工程。
   如果用户明确说不找候选人、不做 sourcing，或只要公司研究 brief、商业化模式/增长打法、JD 文案、销售/BD/partnership lead，退出 Sifta，交给宿主原生研究或做 hard stop；私人联系方式、手机号、自动发送、批量外联请求不调用搜索工具。
2. 默认 plan-first：用户没有明确要求“现在搜索/给候选人/列出候选人”时，只输出 company/title/source-map plan、query plan、evidence gate 和 Coverage Warnings；`找/挖/帮我推进一下`、`不知道 title`、`帮我看怎么找` 不算执行请求，不调用 CLI、web search、browser，不查官网，不做 live company validation。
3. 用户明确要求执行且只要 1-3 个强线索时，运行 `node scripts/small-batch-product-gtm.mjs --query "<用户语言画像>" --checkpoint "<用户原始目标>" --target-count 3`。stdout 有 `STOP_AFTER_HELPER=true` 时直接整理最终答案，保留 `Stop Condition`、`Coverage Warnings` 和停止条件，不再追加 web/exa/company validation、browser lookup 或第二次 `find-people`。如果 helper 失败或返回 0 人，本轮只报告 failure/warnings/next action，不用 web/exa/native search 替换候选人。
4. 需要更大 shortlist、trace 或 review loop 时才直接运行 `sifta-cli status` + `find-people`。
5. 保留用户原始请求作为 `--checkpoint`；`--query` 使用用户语言，保留岗位、城市、公司、职能和市场信号；使用 `--sources '["linkedin"]'`。
6. GTM / company-map 场景先建立或复用 company / sector map，再转 people search；plan-first 只能把用户给定公司标为 `unverified seed`，connector 不可用时只交付 source plan，不声称找到人。
7. company/sector map 只是 `source-map lead`；LinkedIn/职业 profile + 职能证据后才是 candidate。
8. DevRel / developer marketing 如果需要 GitHub 或社区证据，把它作为 source-map 辅助；不要把
   非工程岗位误路由成 GitHub-only 候选人搜索。
9. 输出 Candidate Buckets 和 Fit Proof Packet；产品/GTM 候选人也必须有职业证据和 weakness。

Plan-first output must include:

```text
Coverage Warnings: 未执行 live search；公司池为用户给定/待验证；不推断求职意愿、薪资、签证、relocation 或触达意愿。
```

Below CLI examples are for explicit execution only; do not run or output them as the plan-first answer.

Product example:

```bash
sifta-cli find-people \
  --query "上海 AI Agent 产品经理，具备大模型应用、智能体平台或 Agent 产品规划经验" \
  --checkpoint "<用户原始招聘目标>" \
  --sources '["linkedin"]' \
  --target-count 10
```

GTM example:

```bash
sifta-cli find-people \
  --query "在 AI video、AI avatar 或 AI creator tool 公司负责 GTM、增长或商业化的人，最好有相邻公司经验，并能覆盖目标市场" \
  --checkpoint "<用户原始招聘目标和公司/市场约束>" \
  --sources '["linkedin"]' \
  --target-count 10
```

## Quality Gates

- 最终答复必须保留字面 `Coverage Warnings`；helper 停止时写明 `Stop condition: helper output is final` 或同等停止条件。
- 产品规划、平台产品、PM、roadmap 证据归 `AI产品/平台`。
- 增长、营销、商业化、partnerships、DevRel、developer community 证据归 `GTM/增长/DevRel`。
- `partnerships` 只指候选人职业职能证据；不要把商务合作对象、销售 lead list 或 partner 页面当候选人来源。
- 不推断 relocation、签证、薪资、触达意愿或求职意愿。
- 不因为产品涉及 Agent、LLM 或 AI，就默认走 GitHub 工程 route。
- LinkedIn-first 不排斥 GitHub、X、产品页或媒体报道，但这些来源只做 company/source map、
  proof-of-work 或公开表达补充；候选人身份仍需职业 profile 验证。

## References

| Reference | 何时读取 |
| --- | --- |
| [Small-batch helper](scripts/small-batch-product-gtm.mjs) | 用户只要 1-3 个 Product/GTM 强线索 |
| [Execution budget](../sifta-search/references/execution-budget.md) | 控制 CLI 次数、latency 和重复搜索 |
| [CLI contract](../sifta-search/references/cli-reference.md) | 调用 LinkedIn connector、auth/status/schema 失败 |
| [Query rules](../sifta-search/references/query-contract.md) | 写 LinkedIn/Product/GTM query 或拆 mixed-source feedback |
| [Source map recipes](../sifta-search/references/source-map-recipes.md) | company map、adjacent company pool 或 DevRel 社区证据 |
| [State gate](../sifta-search/references/project-brief-and-state.md) | company/sector lead 升级候选前 |
| [Fit proof](../sifta-search/references/fit-proof-packet.md) / [Output rules](../sifta-search/references/output-quality.md) | 输出候选表和 Coverage Warnings |
