---
name: sifta-academic-graph
metadata:
    version: 0.0.10
    tags: [sifta-search, recruiting, sourcing, research, academic-graph]
description: >
    用于学术图谱候选人寻访，覆盖 foundation model、math、code、training efficiency、multimodal、WAM/VLA、robotics、research scientist / engineer、PhD intern、early-career researcher，以及论文、实验室、OpenAlex、Google Scholar、Semantic Scholar、arXiv/OpenReview、Papers with Code、导师/共同作者和竞赛信号。论文综述、趋势或引用网络分析本身不要使用，除非要转成招聘找人来源。
---

# Sifta 学术图谱

用户要找高潜研究人才，且最佳信号来自论文、学术图谱、实验室、导师、共同作者、竞赛、dataset、项目页或开源实现时，使用学术图谱路径。论文和实验室只是入口，候选人必须再经过个人资料和贡献验证。

## 执行流程

1. 先按共享执行门判断执行、计划或硬停止；只缺地域、职级或数量时写入假设后推进。
2. 用户未指定地区时默认 `中国/中文生态相关人才池优先`；只看公开职业信号。
3. 执行时先建立找人来源，再输出人选；至少覆盖两个路径族：`paper-first`、`profile-first`、`lab-first`、`coauthor-graph`、`competition-signal`、`advisor-entry`。
4. 优先综合 OpenAlex、Semantic Scholar、arXiv/OpenReview、Papers with Code、Google Scholar、lab/project/homepage；Google Scholar 只作为浏览器/人工入口或经批准第三方入口，不假设官方 API。
5. 需要 Sifta 统一 JSON、调用轨迹或研究连接器时，再运行 `sifta-cli status` 并使用 `--mode research`。
6. 按状态升级：论文/实验室/共同作者线索 -> 已消歧个人资料线索 -> 已验证贡献的候选人 -> 分类。

## 核心路径

paper-first 必须走 `paper -> code -> identity alias -> contribution depth -> career stage`：

- 先找 official code、项目页、Papers with Code、HF Papers 或论文链接 repo；无代码时只保留 paper-only lead。
- code 到 contributors：看 owner、contributors、commit / PR / README maintainer；一作不自动等于核心实现者。
- identity alias：论文作者、GitHub、主页、Scholar、OpenReview、LinkedIn、lab bio 至少需要一条公开互链或署名证据。
- contribution depth：核心模块、持续贡献、official implementation 或 maintainer 才能升级；单次 commit / 文档贡献最高 lead。

profile-first 是召回补充，不是 strong 证明：公开个人资料命中方向词只能证明“可能相关”；没有 paper/code/project/contribution depth 前最高 soft，bio-only 或 repo-thin 是 lead。

## 数据源精度优先级（重要——先读）

OpenAlex 的 author 端点**中文人名消歧很差**：会把多个同名真人合并成一个跨学科噪声实体（实测：连 Diffusion Policy 一作 Cheng Chi、InstructGPT 一作 Long Ouyang 都被合并进地质/医学/半导体 profile）。所以 OpenAlex 程序化 helper 是**广度召回**，精度天花板低，它的结果**必须**靠下面判断准则 + 交叉核验消歧，别直接采信 author profile。

按精度优先选源（都免费、多数无需 key）：

| 目标人群 | 首选源 | 为什么 |
| --- | --- | --- |
| **前沿 / 顶会研究员** | **arXiv 官方 API**（几乎所有 AI 论文的预印本、免费无 key、最新最全、直连稳定）拉方向论文→作者 → 再走 `paper→code→GitHub` + Google Scholar / 个人主页核身份 | AI 研究者真实足迹在 arXiv+Scholar；身份靠代码仓/主页交叉，不靠 OpenAlex 消歧 |
| **大模型工程师 / 研究工程师** | HuggingFace Hub（模型→作者，见工程 skill）、GitHub `topic:`、论文→Papers with Code 官方仓→GitHub 贡献者 | 身份直接可用、零消歧 |
| **中国大陆学者补充** | Google Scholar（作者主页/机构/合作者，中国研究者普遍有；无官方 API，走浏览器/搜索入口）、AMiner | 身份与机构核验关键 |
| 引用图扩展 | OpenAlex helper（下节，`cites:` 引用图） | 覆盖广、引用图稳健，但**作者消歧差**、只作召回入口不作身份源 |

AI 研究者的身份足迹主要在 **arXiv（论文）+ Google Scholar（profile）+ GitHub（代码）**，不在小众平台。**OpenReview 已弃用**：2026-06-30 实测无 key 不可用（profile 端点 403、v2 新会议整体 challenge 鉴权），且国内少用。

paper→code→人 的干净链路（最稳）：arXiv/论文 → 官方代码仓（Papers with Code `official=true` 或论文页 GitHub 链接）→ GitHub 贡献者 → 交叉 Scholar/主页 → 真实身份。这条拿到的是带论文背书的干净身份，**优先于 OpenAlex author profile**。

## 程序化召回 helper（arXiv：最新方向论文入口，首选）

找前沿/顶会研究员时，用 `scripts/small-batch-arxiv.mjs` 拉**最新方向论文**（arXiv 官方 API，免费无 key、直连稳定、最新最全，避开 OpenAlex 全文搜易 504 的坑）。给方向词 + arXiv 分类，返回论文 + 作者 + **官方代码链接**，按客观项粗排（有官方代码=最高，能直接 `paper→code→GitHub` 拿干净身份）。

```bash
node scripts/small-batch-arxiv.mjs --query "vision language model" --category cs.CV --category cs.CL --max-results 30 --json
# 常用分类：cs.CV(视觉) cs.CL(NLP) cs.LG(ML) cs.AI cs.RO(机器人) cs.MA(多智能体)
```

它只给论文+作者名字串（arXiv 无 profile/机构/消歧），`needsAgentJudgment` 明列你要判的：谁是核心作者、走 paper→code→GitHub + Scholar/主页核身份、是否中国生态（读论文首页/主页）、职业阶段与可招性。**带官方代码的论文优先追**——这条链拿到的是带论文背书的干净 GitHub 身份。

## 程序化召回 helper（OpenAlex：引用图扩展）

有了标杆论文想沿**引用图**找"在它之上继续做"的梯队时，用 `scripts/small-batch-academic.mjs`（OpenAlex 开放 API，无需 key）做程序化召回，输出对齐 proposal JSON（`people` / `leadPeople` / `sourceLeads` / `recallPaths` / `legsCovered`）。它只产初步候选池，不替代上面的身份/贡献证据核验：候选最高 `soft`，资深 PI 进顾问/标杆池。

**首选：`--seed` 种子 + 引用图召回（从具名标杆论文锚定，精度最高）。** 当你能点名一到几篇标杆论文/模型（如 OpenVLA、Diffusion Policy、RoboMamba）时，直接给种子，让引擎从标杆本身的一作/通讯 + 引用该标杆的近期论文作者展开——方向由标杆保证，能直接找到"在标杆之上继续做"的年轻高潜全职梯队，比泛关键词搜精度高得多，也避开 OpenAlex 全文搜索易 504 的问题。

```bash
# 种子可以是 OpenAlex work id（W 开头）、DOI，或论文标题（标题走全文搜索，环境不稳时可能失败，优先给 work id / DOI）
node scripts/small-batch-academic.mjs \
  --query "diffusion policy visuomotor robot manipulation" \
  --seed W4385403811 --seed "10.15607/rss.2023.xix.026" \
  --target-count 4 --max-elapsed-ms 55000
```

给了 `--seed` 时，种子 / 引用图召回优先跑（占用大部分候选详情预算），泛关键词的 paper-first / profile-first 退居补充。

**补充：无种子时的泛关键词召回**（精度较低，仅在无法点名标杆时用）：全球引用排序召回（works 按全球引用排序 → 一作/通讯）+ 中国机构地域召回（works 按 `authorships.institutions.country_code:cn|hk|tw` 过滤，落实中国优先、补全球排序漏掉的中国机构研究者）。这些是召回方式，不等同上文 `paper-first` / `profile-first` 证据路径族。

**分工（关键）**：helper 只做确定性的召回 + 客观信号初步排序，**判断你来做**。它不判"是不是综述、是不是同名合并、方向对不对、是不是中国生态"——这些语义判断用正则/枚举会枚举不尽、跨语言失效，故一律交给你。输出里每个候选带：
- `roughBand`（high/mid/low）——只是按引用/发文/近年活跃的机械初步排序，**不是**判级，别当最终档位用；
- `needsAgentJudgment`——明确列出你要判的项（综述弱证据/方向契合/疑似同名合并/中国生态/职业阶段）；
- 原始证据：论文标题（`evidence`）、`conceptTags`、`institutionNames`、`geoStrong`（country_code 事实）、`activeYears`。

拿到 helper 输出后，**必须**按 [学术来源执行手册 §5 判断准则](../sifta-search/references/academic-source-playbook.md) 逐个判级，再走 `paper -> code -> identity alias -> contribution depth` 核验身份与职业阶段。helper 已封顶 soft、写好隐私硬门（不推断可招聘性/不查私人联系方式），但研究证据强弱与方向契合要你自己判，别直接把 `roughBand:high` 当成强候选。

## 质量门

- 计划输出和实时报告按共享执行门；不要把论文列表、来源地图或执行合同做成额外顶层标题。
- 论文作者不是候选人，直到找到个人资料并核验身份；没有个人资料时不要输出完整推荐人选表。
- paper/code/个人资料 URL 不一致时，先做 alias cluster；任一别名命中即可算同人候选，但要写身份风险。
- `--mode research` 或 CLI 回退不能替代学术来源栈；缺 OpenAlex / Semantic Scholar / arXiv / OpenReview / Scholar / lab/homepage 交叉证据时只能待核验。
- PI、导师或资深科学家通常先进入推荐人、顾问或产业标杆池；年轻全职候选从学生、共同作者、实验室成员、project collaborator、official code contributor 中扩展。
- 不推断求职意愿、薪资、可入职时间、relocation 或是否愿意回到某地区；不查询私人联系方式，不自动触达。
- 默认地域是来源优先级和候选人升级门槛；缺公开中国/中文生态职业信号的人不能包装成默认候选，除非用户放宽全球人才池。

## 来源栈

| 来源 | 用途 | 边界 |
| --- | --- | --- |
| OpenAlex / Semantic Scholar | works、authors、institutions、citation graph | 可作程序化来源，不证明可招聘性 |
| Google Scholar | 广泛召回、作者主页入口 | 不假设官方 API |
| arXiv / OpenReview / Papers with Code | 最新论文、任务、official code | 论文作者仍需个人资料核验 |
| lab / project / homepage / GitHub / LinkedIn | 身份、贡献、职业阶段 | 候选人升级关键证据 |

## 参考

| 参考文件 | 何时读取 |
| --- | --- |
| [共享执行门](../sifta-search/references/shared-gates.md) | 执行/计划/硬停止、默认地域、过程隐藏 |
| [找人来源方案](../sifta-search/references/source-map-recipes.md) | 学术优先路径和来源族 |
| [arXiv 最新论文召回](scripts/small-batch-arxiv.mjs) | 找前沿研究员：按方向拉最新论文+作者+官方代码，走 paper→code→身份 |
| [学术来源执行手册](../sifta-search/references/academic-source-playbook.md) | WAM/VLA、研究工程、高潜研究人才 |
| [状态门槛](../sifta-search/references/project-brief-and-state.md) | 论文/实验室/共同作者线索升级候选前 |
| [CLI 合同](../sifta-search/references/cli-reference.md) | `--mode research`、调用轨迹或 CLI auth/schema |
| [查询规则](../sifta-search/references/query-contract.md) | 写研究查询或拆分下一轮请求 |
| [输出规则](../sifta-search/references/output-quality.md) / [适配证明包](../sifta-search/references/fit-proof-packet.md) | 输出推荐人选、还要确认和下一步 |
