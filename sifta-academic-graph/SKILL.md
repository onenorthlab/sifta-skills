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
| [学术来源执行手册](../sifta-search/references/academic-source-playbook.md) | WAM/VLA、研究工程、高潜研究人才 |
| [状态门槛](../sifta-search/references/project-brief-and-state.md) | 论文/实验室/共同作者线索升级候选前 |
| [CLI 合同](../sifta-search/references/cli-reference.md) | `--mode research`、调用轨迹或 CLI auth/schema |
| [查询规则](../sifta-search/references/query-contract.md) | 写研究查询或拆分下一轮请求 |
| [输出规则](../sifta-search/references/output-quality.md) / [适配证明包](../sifta-search/references/fit-proof-packet.md) | 输出推荐人选、还要确认和下一步 |
