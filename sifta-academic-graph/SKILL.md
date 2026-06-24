---
name: sifta-academic-graph
metadata:
    version: 0.0.6
    tags: [sifta-search, recruiting, sourcing, research, academic-graph]
description: >
    用于 academic graph sourcing，覆盖 foundation model、math、code、
    training efficiency、multimodal、WAM/VLA、robotics、research scientist、
    research engineer、PhD intern、early-career researcher，以及论文、实验室、
    OpenAlex、Google Scholar、Semantic Scholar、arXiv/OpenReview、Papers with Code、
    导师/共同作者、竞赛信号驱动的招聘。Google Scholar 只作为浏览器/人工召回入口，不假设官方 API。
---

# Sifta Academic Graph

用户要找高潜研究人才，且最佳信号来自论文、学术图谱、实验室、导师、共同作者、竞赛、
项目页、dataset 或开源实现时，使用 academic graph。公开材料里的学术线索只是入口，候选人
必须再经过个人 profile 验证。

## Workflow

1. 先用宿主 agent 原生学术 / web 搜索建立 source map，不要从泛 people search 开始。
   优先综合 OpenAlex、Google Scholar、Semantic Scholar、arXiv/OpenReview、Papers with Code、
   lab/project/homepage，而不是只搜单一论文库。
2. 覆盖至少两个路径：`paper-first`、`lab-first`、`coauthor-graph`、`competition-signal`、
   `graph-neighbor`、`advisor-entry`。
3. 把 Google Scholar 当作浏览器/人工 broad recall 或经用户批准的第三方入口；不要假设
   Sifta 或 Google 提供官方 Scholar API。
4. 需要 Sifta 统一 JSON、trace 或 research connector 时，再运行 `sifta-cli status` 并使用
   `--mode research`。
5. 把 source-map leads 转成 GitHub、LinkedIn、个人主页或用户提供的 profile 证据。
6. 在身份未验证前，paper/lab/advisor/coauthor/competition/project leads 只能进入 `sourceMap`。
7. 输出时区分年轻高潜全职候选、顾问/推荐人入口、产业标杆、待核验和排除项，并给 Fit Proof Packet。

```bash
sifta-cli find-people \
  --query "LLM reasoning math code training efficiency young researcher PhD intern OpenAlex Google Scholar Semantic Scholar arXiv OpenReview Papers with Code lab project coauthor competition China" \
  --checkpoint "<用户原始研究团队目标和基础能力/潜力要求；保留 Google Scholar 只作为浏览器/人工 broad recall，不假设官方 API>" \
  --mode research \
  --target-count 10
```

## Academic Source Stack

| Source | Use For | Boundary |
| --- | --- | --- |
| OpenAlex | works / authors / institutions / topics graph，引用、共同作者、机构和方向扩展 | 可作为程序化 source-map 数据源；不能直接证明可招聘性 |
| Google Scholar | broad recall、漏召回补充、作者主页和引用入口 | 浏览器/人工入口或经批准第三方；不假设官方 API，不做未授权 scraping |
| Semantic Scholar | paper / author search，citation/reference graph，related papers | 适合和 OpenAlex 交叉验证；作者消歧仍需 profile 核验 |
| arXiv / OpenReview | 最新 preprint、会议 submission、review venue、基础模型方向论文 | 论文作者只进 `sourceMap`，不能直接进 `people` |
| Papers with Code / HF Papers | task、benchmark、dataset、official code、repo link | 用于找实现者和项目线索；仓库 owner 仍需身份验证 |
| Lab / project / personal homepage | 实验室成员、项目 contributor、个人身份、当前阶段 | 是 candidate conversion 的关键证据，不等于求职意愿 |
| GitHub / LinkedIn / X / user profile | 候选人 profile、工程证据、职业阶段、公开表达 | 只有这里或个人主页能把 source-map lead 转成候选人 |

## Quality Gates

- 论文作者不是候选人，直到找到个人 profile 并核验身份。
- Academic graph 输出必须说明至少两个 source families；如果没有使用 OpenAlex、Google Scholar、
  Semantic Scholar 中任一 broad graph / broad recall 来源，需要写 Coverage Warning。
- `--mode research` 或 CLI people fallback 不能替代 academic source stack。CLI 若返回 LinkedIn/GitHub
  profile 但缺 OpenAlex / Semantic Scholar / arXiv / OpenReview / Scholar / lab/homepage 交叉证据，
  只能作为待核验候选或 source-map lead，并必须写 Coverage Warning。
- PI、导师或资深科学家通常先进入推荐人、顾问或产业标杆池，不默认作为全职候选。
- 年轻、博士阶段、顶会论文或竞赛奖项只是入口信号，不是充分证据。
- 不推断求职意愿、薪资、可入职时间、relocation 或是否愿意回到某地区。

## Live Recall Guardrails

- 先输出 `sourceMap`，再输出 `people`；如果还没形成 source map，不要急着给候选人名单。
- OpenAlex 噪声、Semantic Scholar API 429、Google Scholar 访问受限都要进入 Coverage Warnings；
  不要把 provider gap 包装成候选人质量证明。
- 只有个人主页 / GitHub / LinkedIn / lab bio / Scholar profile 与论文或项目 evidence 可交叉验证时，
  才能给 `confidence=high`；否则最多 `medium`，并写明 identity 或 evidence weakness。
- Founder、PI、头部科学家、标杆论文作者更常是 `产业标杆`、`顾问` 或 `推荐人`；年轻全职候选要从
  学生、共同作者、实验室成员、project collaborator、official code contributor 中继续扩展。

## References

- CLI contract: [../sifta-search/references/cli-reference.md](../sifta-search/references/cli-reference.md)
- Query rules: [../sifta-search/references/query-contract.md](../sifta-search/references/query-contract.md)
- Source map recipes: [../sifta-search/references/source-map-recipes.md](../sifta-search/references/source-map-recipes.md)
- Fit proof packet: [../sifta-search/references/fit-proof-packet.md](../sifta-search/references/fit-proof-packet.md)
- Output rules: [../sifta-search/references/output-quality.md](../sifta-search/references/output-quality.md)
