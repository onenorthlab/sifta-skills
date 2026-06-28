---
name: sifta-academic-graph
metadata:
    version: 0.0.6
    tags: [sifta-search, recruiting, sourcing, research, academic-graph]
description: >
    用于学术图谱候选人寻访，覆盖 foundation model、math、code、training efficiency、multimodal、
    WAM/VLA、robotics、research scientist / engineer、PhD intern、early-career researcher，以及论文、
    实验室、OpenAlex、Google Scholar、Semantic Scholar、arXiv/OpenReview、Papers with Code、导师/共同作者和竞赛信号；Google Scholar 只作为浏览器/人工召回入口，不假设官方 API。
    论文综述、学术趋势、实验室调研或引用网络分析本身不要使用，除非要转成招聘来源地图。
    用户明确要找研究人才、人选或候选人时，可以用宿主 Agent 原生搜索建立实时来源地图；
    用户只要求方法、来源地图模板、升级门槛或明确说先不要搜索时，才只输出计划。
---

# Sifta 学术图谱

用户要找高潜研究人才，且最佳信号来自论文、学术图谱、实验室、导师、共同作者、竞赛、
项目页、dataset 或开源实现时，使用学术图谱路径。公开材料里的学术线索只是入口，候选人
必须再经过个人资料验证。

工具前先判断执行权：如果用户只是问“怎么找 / 来源地图怎么设计 / 升级门槛是什么”或明确说
“先不要搜索”，不要调用网页搜索、浏览器、CLI、`gh`、`curl` 或任何实时验证。
如果用户说“找研究人才 / 找人选 / 给候选人 / 老板想从论文和实验室找人”，即使同时要求
“给来源地图”“不要只列论文作者”，也视为可以执行的实时来源地图请求。

## 执行流程

1. 先确认是招聘或候选人池目标；只缺地域、职级或数量时写入“假设”后推进。用户未指定地区时，默认 `中国/中文生态相关人才池优先`，把中国机构、中文社区、中国市场或 China / Chinese-language 作为来源地图种子之一；不要把姓名、照片、族裔、国籍或猜测当作信号。
2. 区分计划和执行：用户要求“找人/给候选人/推荐/名单/几个/跑一轮/执行/从论文和实验室里找人才”时就是执行请求；用户只要求“来源地图怎么做/搜索路径/升级门槛/方法论”或明确说“先不要搜索”时，才只输出来源地图、查询方案、个人资料升级门槛和覆盖风险，不做实时搜索。
3. 明确执行时再用宿主 Agent 原生学术 / 网页搜索建立来源地图，不要从泛人才搜索开始。
   优先综合 OpenAlex、Google Scholar、Semantic Scholar、arXiv/OpenReview、Papers with Code、
   lab/project/homepage，而不是只搜单一论文库。
   缺地区时，优先补中国大陆、港澳台、中文教育/工作/社区、中国市场和中国机构相关线索；不要把它当作严格过滤条件。
4. 覆盖至少两个路径：`paper-first`、`lab-first`、`coauthor-graph`、`competition-signal`、`graph-neighbor`、`advisor-entry`。
5. 把 Google Scholar 当作浏览器/人工广泛召回或经用户批准的第三方入口；不要假设
   Sifta 或 Google 提供官方 Scholar API。
6. 需要 Sifta 统一 JSON、调用轨迹或研究连接器时，再运行 `sifta-cli status` 并使用
   `--mode research`。
7. 按状态升级：论文/实验室/共同作者线索 -> 已消歧个人资料线索 -> 已验证贡献的候选人 -> 分桶。
8. 身份未验证前，论文、实验室、导师、共同作者、竞赛和项目线索只能进入 `sourceMap`；输出区分候选、顾问/推荐人、标杆、待核验和排除项。明确执行且需要 CLI 时再读 CLI 参考。

## 学术来源栈

| 来源 | 用途 | 边界 |
| --- | --- | --- |
| OpenAlex | works / authors / institutions / topics graph，引用、共同作者、机构和方向扩展 | 可作为程序化来源地图数据源；不能直接证明可招聘性 |
| Google Scholar | 广泛召回、漏召回补充、作者主页和引用入口 | 浏览器/人工入口或经批准第三方；不假设官方 API，不做未授权抓取 |
| Semantic Scholar | paper / author search，citation/reference graph，related papers | 适合和 OpenAlex 交叉验证；作者消歧仍需个人资料核验 |
| arXiv / OpenReview | 最新预印本、会议投稿、评审场景、基础模型方向论文 | 论文作者只进 `sourceMap`，不能直接进 `people` |
| Papers with Code / HF Papers | 任务、benchmark、dataset、official code、仓库链接 | 用于找实现者和项目线索；仓库 owner 仍需身份验证 |
| 实验室 / 项目 / 个人主页 | 实验室成员、项目贡献者、个人身份、当前阶段 | 是候选人升级的关键证据，不等于求职意愿 |
| GitHub / LinkedIn / X / 个人资料 | 候选人个人资料、工程证据、职业阶段、公开表达 | 只有这里或个人主页能把来源线索转成候选人 |

## 质量门

- 计划或来源地图输出必须保留覆盖风险，说明未执行实时搜索、线索不能直接升级候选人，以及待核验来源。
- 实时执行输出也必须保留独立小标题 `覆盖风险`，不能只用“验证”“当前状态”或“剩余建议”替代。
- 论文作者不是候选人，直到找到个人资料并核验身份。
- 没有个人资料时不要输出完整候选人分桶，只输出来源地图和个人资料核验动作。
- 学术图谱输出必须说明至少两个来源族；如果没有使用 OpenAlex、Google Scholar、
  Semantic Scholar 中任一广泛图谱或广泛召回来源，需要写覆盖风险。
- `--mode research` 或 CLI 人才搜索回退不能替代学术来源栈。CLI 若返回 LinkedIn/GitHub
  个人资料但缺 OpenAlex / Semantic Scholar / arXiv / OpenReview / Scholar / lab/homepage 交叉证据，
  只能作为待核验候选或来源线索，并必须写覆盖风险。
- PI、导师或资深科学家通常先进入推荐人、顾问或产业标杆池，不默认作为全职候选。
- 年轻、博士阶段、顶会论文或竞赛奖项只是入口信号，不是充分证据。
- 不推断求职意愿、薪资、可入职时间、relocation 或是否愿意回到某地区。
- 默认地域对来源地图是来源优先级和后续核验项，对候选人分桶是升级门槛；缺公开中国/中文生态相关职业信号或地域未知的强线索可以保留为来源地图、标杆或推荐人，但用户未放宽为全球人才池前不能包装成候选人或强线索。

## 实时召回边界

- 先输出 `sourceMap` / 计划，再输出 `people`；如果还没形成来源地图或用户未明确要求执行，不要急着给候选人名单。
- OpenAlex 噪声、Semantic Scholar API 429、Google Scholar 访问受限都要进入覆盖风险；
  不要把来源缺口包装成候选人质量证明。
- 只有个人主页 / GitHub / LinkedIn / lab bio / Scholar 个人资料与论文或项目证据可交叉验证时，
  才能给 `confidence=high`；否则最多 `medium`，并写明身份或证据风险。
- Founder、PI、头部科学家、标杆论文作者更常是 `产业标杆`、`顾问` 或 `推荐人`；年轻全职候选要从
  学生、共同作者、实验室成员、project collaborator、official code contributor 中继续扩展。

## 参考

| 参考文件 | 何时读取 |
| --- | --- |
| [来源地图方案](../sifta-search/references/source-map-recipes.md) | 默认优先读，用于学术优先路径和来源族 |
| [学术来源执行手册](../sifta-search/references/academic-source-playbook.md) / [AI 垂直来源地图](../sifta-search/references/ai-vertical-source-taxonomy.md) / [角色证明标准](../sifta-search/references/role-fit-rubrics.md) | WAM/VLA、大模型、研究工程、高潜研究人才的来源、路径与证据标准 |
| [状态门槛](../sifta-search/references/project-brief-and-state.md) | 论文/实验室/共同作者线索升级候选前 |
| [CLI 合同](../sifta-search/references/cli-reference.md) | 需要 `--mode research`、调用轨迹或 CLI auth/schema |
| [查询规则](../sifta-search/references/query-contract.md) | 写研究查询或拆分指定来源的下一轮请求 |
| [适配证明](../sifta-search/references/fit-proof-packet.md) / [输出规则](../sifta-search/references/output-quality.md) | 输出候选表和覆盖风险 |
