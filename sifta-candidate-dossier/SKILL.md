---
name: sifta-candidate-dossier
metadata:
    version: 0.0.6
    tags: [sifta-search, recruiting, sourcing, enrichment, dossier]
description: >
    用于已知候选人 deep-dive、profile enrichment 和 candidate dossier。用户给出候选人姓名、
    GitHub、LinkedIn、个人主页、论文作者、上一轮候选人或候选人 key，并希望查公开职业联系方式、
    过往经历、公开信息、成就、论文、开源贡献、产品/GTM 成果或风险缺口时使用。
    不用于继续找新人、私人信息挖掘、背景调查、auth-gated 数据或自动触达。
---

# Sifta Candidate Dossier

用户已经有一个明确候选人，想深挖他的公开信息、经历、成就、联系方式或风险时使用本 skill。
这不是 sourcing 扩展，不要把 deep-dive 变成继续找更多人。
没有可消歧 identity 时 hard stop，只问用户补 GitHub、LinkedIn、个人主页、公司或地点线索。

## Workflow

1. 先做 identity resolution：确认输入是同一个人；只有姓名或线索不足时，先要求 profile 或给出
   低置信度说明，不跨渠道硬合并。
2. 已知 GitHub handle/URL 且只需公开职业 dossier 时，先运行 `node scripts/known-github-dossier.mjs --github "<url-or-login>" --query "<用户原始 deep-dive 目标>"`；stdout 有 `STOP_AFTER_HELPER=true` 时直接整理答案，保留 `Stop Condition`、`Coverage Warnings` 和停止条件，不再 web search、打开 helper URL、扫 raw README、查 LinkedIn 或继续找新人。
3. 有 GitHub、LinkedIn、X、个人主页或用户给出的 profile 时，可用 `sifta-cli enrich-people`
   补结构化公开证据。
4. 用宿主 agent 原生搜索补公开材料：个人主页、GitHub、LinkedIn public profile、Google Scholar、
   OpenAlex、Semantic Scholar、arXiv/OpenReview、Papers with Code、company bio、talk、podcast、
   conference、patent、media、project page；只有用户批准第二轮或 helper 不适用时才这么做。
5. 联系方式只收集候选人本人公开职业联系方式：个人主页公开 email、GitHub profile email、论文通讯邮箱、
   公开社交/profile 链接。公司公开联系页只能作为非个人 public channel，不能标成候选人联系方式；
   不要推断私人邮箱格式、手机号、住址、家庭信息或 auth-gated/private 数据。
6. 输出 dossier：身份、履历时间线、公开成就、证据、联系方式、风险缺口和下一步核验动作。

```bash
sifta-cli enrich-people \
  --people '[{"githubUrl":"https://github.com/<handle>"}]'
```

## Source Checklist

| Source | Use For | Boundary |
| --- | --- | --- |
| LinkedIn / company bio | 职业经历、title、公司、地区、时间线 | 不抓取非公开内容，不猜求职意愿 |
| GitHub / project page | 开源贡献、repo、issue、commit、maintainer 身份 | repo owner 缺身份互链时只写低置信度 |
| Personal homepage | 身份互链、公开 email、项目、CV、论文、talk | 只记录公开职业联系信息 |
| Google Scholar / OpenAlex / Semantic Scholar | 论文、引用、共同作者、研究方向 | Google Scholar 不假设官方 API |
| arXiv / OpenReview / Papers with Code | preprint、submission、official code、benchmark | 论文作者仍需 profile 核验 |
| Media / talks / podcast / patents | 公开成就、观点、商业或技术影响力 | 标明来源和日期，避免过期事实 |

## Report Format

```markdown
目标：<用户想深挖的人和目的>
身份核验：<same-person confidence + evidence>

| 模块 | 结论 | 证据 | 置信度 |
| --- | --- | --- | --- |
| 履历时间线 | ... | ... | high/medium/low |
| 公开成就 | ... | ... | high/medium/low |
| 技术/产品/GTM 证据 | ... | ... | high/medium/low |
| 联系方式 / 公开渠道 | ... | ... | high/medium/low |
| 风险与缺口 | ... | ... | high/medium/low |

Coverage Warnings：
- <privacy/source gaps and stopped verification>

Next Action：
- <需要人工核验或下一步搜索>
```

## Quality Gates

- 最终答复必须保留字面 `Coverage Warnings`；helper 停止时写明 `Stop condition: helper output is final` 或同等停止条件。
- 不输出未公开的私人电话、住址、家庭信息、身份证件、私人邮箱猜测或数据 broker 结果。
- 联系方式必须有公开来源链接；没有公开联系方式时写“未找到公开职业联系方式”，不要猜。
- 同名、同机构、同论文作者不足以合并身份；必须有 profile 互链、主页、项目或明确公开证据。
- 成就要分层：论文 / 开源 / 产品 / 商业 / 社区 / 组织影响力，不混成一段泛 summary。
- 过往经历、title 和时间线只写公开来源支持的事实；不推断离职、薪资、意愿或可入职时间。

## References

| Reference | 何时读取 |
| --- | --- |
| [Known GitHub helper](scripts/known-github-dossier.mjs) | 已知 GitHub handle/URL 的小批量 dossier |
| [CLI contract](../sifta-search/references/cli-reference.md) | 需要 `enrich-people`、auth/status/schema 或 trace |
| [State gate](../sifta-search/references/project-brief-and-state.md) | ambiguous identity -> profile lead -> verified person |
| [Source map recipes](../sifta-search/references/source-map-recipes.md) | 补公开来源 checklist 或 academic/GitHub 线索 |
| [Fit proof](../sifta-search/references/fit-proof-packet.md) | dossier 要转招聘 fit 判断 |
| [Output rules](../sifta-search/references/output-quality.md) / [Query rules](../sifta-search/references/query-contract.md) | 输出风险或修 enrichment 输入 |
