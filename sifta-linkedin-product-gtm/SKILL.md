---
name: sifta-linkedin-product-gtm
metadata:
    version: 0.0.6
    tags: [sifta-search, recruiting, sourcing, linkedin, product, gtm]
description: >
    用于 AI 产品经理、平台产品、Agent 产品、GTM、增长、商业化、
    developer marketing、DevRel 和 company-map 辅助招聘。该 skill 保留用户自然语言
    人才画像进入 LinkedIn people search，并避免把非工程职能误路由到 GitHub。
---

# Sifta LinkedIn Product and GTM

主要证据来自职业 profile、产品 ownership、GTM、增长、商业化、partnerships、DevRel 或相邻
公司经历时走 LinkedIn-first。LinkedIn-first 是 primary people channel，不是 exclusive channel：
company map、产品页、GitHub repo、developer community、X/public posts 或媒体报道可以做辅助
source map，尤其适用于 DevRel、developer marketing、open-source community 和 AI 产品生态岗位；
但非工程候选人的主候选人证据仍应回到 LinkedIn、个人主页或明确职业 profile。这里 Sifta CLI/API
的 connector 价值更明确；宿主 agent 没有稳定 LinkedIn people access 时优先用 Sifta。

## Workflow

1. 使用 CLI 时先运行 `sifta-cli status`。
2. 保留用户原始请求作为 `--checkpoint`。
3. `--query` 使用用户语言，保留岗位、城市、公司、职能和市场信号。
4. 使用 `--sources '["linkedin"]'`。
5. GTM / company-map 场景先建立或复用 company / sector map，再转 people search。
6. DevRel / developer marketing 如果需要 GitHub 或社区证据，把它作为 source-map 辅助；不要把
   非工程岗位误路由成 GitHub-only 候选人搜索。
7. 输出 Candidate Buckets 和 Fit Proof Packet；产品/GTM 候选人也必须有职业证据和 weakness。

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

- 产品规划、平台产品、PM、roadmap 证据归 `AI产品/平台`。
- 增长、营销、商业化、partnerships、DevRel、developer community 证据归 `GTM/增长/DevRel`。
- 不推断 relocation、签证、薪资、触达意愿或求职意愿。
- 不因为产品涉及 Agent、LLM 或 AI，就默认走 GitHub 工程 route。
- LinkedIn-first 不排斥 GitHub、X、产品页或媒体报道，但这些来源只做 company/source map、
  proof-of-work 或公开表达补充；候选人身份仍需职业 profile 验证。

## References

- CLI contract: [../sifta-search/references/cli-reference.md](../sifta-search/references/cli-reference.md)
- Query rules: [../sifta-search/references/query-contract.md](../sifta-search/references/query-contract.md)
- Source map recipes: [../sifta-search/references/source-map-recipes.md](../sifta-search/references/source-map-recipes.md)
- Fit proof packet: [../sifta-search/references/fit-proof-packet.md](../sifta-search/references/fit-proof-packet.md)
- Output rules: [../sifta-search/references/output-quality.md](../sifta-search/references/output-quality.md)
