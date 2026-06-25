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
    论文综述、学术趋势、实验室调研或引用网络分析本身不要使用，除非要转成招聘 source map。
    用户只要求 source map、升级门槛或不要只列论文作者时，plan-first 输出，不做 live search。
---

# Sifta Academic Graph

用户要找高潜研究人才，且最佳信号来自论文、学术图谱、实验室、导师、共同作者、竞赛、
项目页、dataset 或开源实现时，使用 academic graph。公开材料里的学术线索只是入口，候选人
必须再经过个人 profile 验证。

工具前先判断执行权：如果用户没有明确说“现在搜索/跑一轮/列候选人/给候选人名单”，不要调用
web search、browser、CLI、`gh`、`curl` 或任何 live validation。`给 source map`、`说明哪些线索能
升级成候选人`、`不要只列论文作者` 是规划请求，直接输出方法和门槛后停止。

## Workflow

1. 先确认是招聘或候选人池目标；只缺地域、职级或数量时写 Assumptions 后推进。
2. 默认 plan-first：用户没有明确要求“现在搜索/给候选人/列出候选人/跑一轮”时，只输出 source-map plan、query plan、profile conversion gate 和 Coverage Warnings；`找/挖/看看能不能`、`从论文/实验室里挖`、`给 source map`、`说明哪些线索能升级成候选人`、`不要只列论文作者` 都是规划请求，不做 live search。
3. 明确执行时再用宿主 agent 原生学术 / web 搜索建立 source map，不要从泛 people search 开始。
   优先综合 OpenAlex、Google Scholar、Semantic Scholar、arXiv/OpenReview、Papers with Code、
   lab/project/homepage，而不是只搜单一论文库。
4. 覆盖至少两个路径：`paper-first`、`lab-first`、`coauthor-graph`、`competition-signal`、
   `graph-neighbor`、`advisor-entry`。
5. 把 Google Scholar 当作浏览器/人工 broad recall 或经用户批准的第三方入口；不要假设
   Sifta 或 Google 提供官方 Scholar API。
6. 需要 Sifta 统一 JSON、trace 或 research connector 时，再运行 `sifta-cli status` 并使用
   `--mode research`。
7. 按状态升级：paper/lab/coauthor lead -> identity-checked profile lead -> contribution-checked candidate -> bucket。
8. 身份未验证前，paper/lab/advisor/coauthor/competition/project leads 只能进入 `sourceMap`；输出区分候选、顾问/推荐人、标杆、待核验和排除项。明确执行且需要 CLI 时再读 CLI reference。

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
- 没有个人 profile 时不要输出完整 Candidate Buckets，只输出 Source Map 和 profile-verification action。
- Academic graph 输出必须说明至少两个 source families；如果没有使用 OpenAlex、Google Scholar、
  Semantic Scholar 中任一 broad graph / broad recall 来源，需要写 Coverage Warning。
- `--mode research` 或 CLI people fallback 不能替代 academic source stack。CLI 若返回 LinkedIn/GitHub
  profile 但缺 OpenAlex / Semantic Scholar / arXiv / OpenReview / Scholar / lab/homepage 交叉证据，
  只能作为待核验候选或 source-map lead，并必须写 Coverage Warning。
- PI、导师或资深科学家通常先进入推荐人、顾问或产业标杆池，不默认作为全职候选。
- 年轻、博士阶段、顶会论文或竞赛奖项只是入口信号，不是充分证据。
- 不推断求职意愿、薪资、可入职时间、relocation 或是否愿意回到某地区。

## Live Recall Guardrails

- 先输出 `sourceMap` / plan，再输出 `people`；如果还没形成 source map 或用户未明确要求执行，不要急着给候选人名单。
- OpenAlex 噪声、Semantic Scholar API 429、Google Scholar 访问受限都要进入 Coverage Warnings；
  不要把 provider gap 包装成候选人质量证明。
- 只有个人主页 / GitHub / LinkedIn / lab bio / Scholar profile 与论文或项目 evidence 可交叉验证时，
  才能给 `confidence=high`；否则最多 `medium`，并写明 identity 或 evidence weakness。
- Founder、PI、头部科学家、标杆论文作者更常是 `产业标杆`、`顾问` 或 `推荐人`；年轻全职候选要从
  学生、共同作者、实验室成员、project collaborator、official code contributor 中继续扩展。

## References

| Reference | 何时读取 |
| --- | --- |
| [Source map recipes](../sifta-search/references/source-map-recipes.md) | 默认优先读，用于 academic-first 路径和 source families |
| [State gate](../sifta-search/references/project-brief-and-state.md) | paper/lab/coauthor lead 升级候选前 |
| [CLI contract](../sifta-search/references/cli-reference.md) | 需要 `--mode research`、trace 或 CLI auth/schema |
| [Query rules](../sifta-search/references/query-contract.md) | 写 research query 或拆 source-specific next request |
| [Fit proof](../sifta-search/references/fit-proof-packet.md) / [Output rules](../sifta-search/references/output-quality.md) | 输出候选表和 Coverage Warnings |
