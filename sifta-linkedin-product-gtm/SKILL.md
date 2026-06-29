---
name: sifta-linkedin-product-gtm
metadata:
    version: 0.0.8
    tags: [sifta-search, recruiting, sourcing, linkedin, product, gtm]
description: >
    用于 AI 产品/GTM/增长/商业化/DevRel/合作伙伴拓展候选人、人选或人才寻访；用户只要表达“找能把产品、增长、商业化、开发者生态、中国市场或出海做起来的人”，即使没说渠道或头衔，也应使用。
    明确不找候选人/不做寻访的公司研究、市场分析、增长打法、商业化模式、岗位说明、销售线索、渠道合作/KOL 不要使用。
    找 BD/市场负责人等人选且要求私人邮箱、手机号、自动发送或批量外联时，只硬停止，不搜索。
    使用 LinkedIn/职业资料作为主候选证据，避免把非工程职能误路由到 GitHub。
---

# Sifta LinkedIn 产品和 GTM

主要证据来自职业资料、产品负责人经历、GTM、增长、商业化、合作伙伴拓展、DevRel 或相邻
公司经历时走 LinkedIn 优先路径。LinkedIn 是主要找人渠道，不是唯一渠道：
公司地图、产品页、GitHub 仓库、开发者社区、X/公开帖子或媒体报道可以做辅助找人来源，
尤其适用于 DevRel、开发者营销、开源社区和 AI 产品生态岗位；
但非工程人选的主候选人证据仍应回到 LinkedIn、个人主页或明确职业资料。这里 Sifta CLI/API
的连接器价值更明确；宿主 Agent 没有稳定 LinkedIn 人才搜索 / 人员资料访问能力时优先用 Sifta。

## 执行流程

1. 先确认岗位族是 Product/GTM/DevRel 或可从用户目标推断；不要因 AI/Agent/LLM 自动转工程。
   用户未指定地区时，默认 `中国/中文生态相关人才池优先`，并把“中国/中文生态/中国市场”中最贴合的表达放进查询和项目简报；这不是族裔推断。
   如果用户明确说不找候选人、不做寻访，或只要公司研究简报、商业化模式/增长打法、岗位说明、销售/BD/partnership 线索，退出 Sifta，交给宿主原生研究或做硬停止；私人联系方式、手机号、自动发送、批量外联请求不调用搜索工具。
2. 区分计划和执行：用户要求“找人/给候选人/推荐/名单/几个/跑一轮/执行”时就是执行请求；用户只问“怎么找/来源地图/头衔地图/帮我看怎么找”时，才只输出公司/头衔/找人入口、查询方案、证据门槛和下一步补证动作，不调用 CLI、网页搜索、浏览器，不查官网，不做实时公司核验。
3. 用户明确要求执行且只要 1-3 个强线索时，运行 `node scripts/small-batch-product-gtm.mjs --query "<用户语言画像>" --checkpoint "<用户原始目标>" --target-count 3 --json`。辅助脚本完成后按 `../sifta-search/templates/final-report.md` 整理用户报告，不再追加网页/Exa/公司核验、浏览器查询或第二次 `find-people`。如果辅助脚本失败、未认证、API 不可达或返回 0 人，不要把失败冒充成 connector 成功，也不要用公开网页、Exa、浏览器、公司页、活动页、GitHub/X 社区证据替换候选人；本轮只能交付产业标杆、其他线索、阻塞原因和下一步修复动作，不输出候选人表或“建议先聊”的人选。不要输出停止标记、脚本名、命令、参数、运行过程、`target-count` 或使用了哪个 skill。
4. 需要更大候选名单、调用轨迹或反馈闭环时才直接运行 `sifta-cli status` + `find-people`。
5. 保留用户原始请求、默认地域假设和候选人升级门槛作为 `--checkpoint`；`--query` 使用用户语言，只保留岗位、城市、公司、职能、行业、市场和中国/中文生态/中国市场偏置；使用 `--sources '["linkedin"]'`。
6. GTM / 公司地图场景先建立或复用公司 / 赛道地图，再转候选人搜索；计划阶段只能把用户给定公司标为待确认种子（`unverified seed`），连接器不可用时只交付来源方案，不声称找到人。
7. 公司/赛道地图只是来源线索；LinkedIn/职业资料 + 职能证据后才是候选人。
8. DevRel / 开发者营销如果需要 GitHub 或社区证据，把它作为找人来源辅助；不要把
   非工程岗位误分流成只查 GitHub 的候选人搜索。
9. 输出按 `../sifta-search/templates/final-report.md`：推荐人选必须有职业资料链接、为什么值得聊、相关作品 / 证据、还要确认和下一步；产品/GTM 候选人也必须有职能证据和可推进缺口。即使宿主项目要求工程汇报，也不要用 `已完成 / 验证 / 当前状态 / 剩余建议` 这类标题，最终回复必须是招聘负责人能直接看的找人简报。

计划输出必须包含：

```text
本轮限制：未执行实时搜索；公司池为用户给定或待验证；不推断求职意愿、薪资、签证、搬迁或触达意愿。
```

下面的 CLI 示例只用于明确执行场景；不要把它们作为计划阶段答案直接运行或输出。

产品岗位示例：

```bash
sifta-cli find-people \
  --query "上海 AI Agent 产品经理，具备大模型应用、智能体平台或 Agent 产品规划经验" \
  --checkpoint "<用户原始招聘目标>" \
  --sources '["linkedin"]' \
  --target-count 10
```

GTM 示例：

```bash
sifta-cli find-people \
  --query "在 AI 视频、AI 数字人或 AI 创作者工具公司负责 GTM、增长或商业化的人，中国/中文生态相关人才池优先，最好有相邻公司经验，并能覆盖目标市场" \
  --checkpoint "<用户原始招聘目标和公司/市场约束>" \
  --sources '["linkedin"]' \
  --target-count 10
```

## 质量门

- 最终答复必须保留还要确认和下一步补证动作；辅助脚本停止时不要把停止标记、脚本名、命令、参数或运行过程写进用户答复。
- 最终答复不能使用工程任务汇报标题；固定用 `结论 / 人选和证据 / 其他线索 / 下一步` 或无候选时的 `结论 / 原因 / 下一步`。
- 辅助脚本失败、未认证、API 不可达或 0 人时，明确连接器主路径不可用；本轮只输出产业标杆、其他线索、阻塞原因和下一步修复动作，不用公开网页/社区/活动页 fallback 形成候选名单，也不输出候选人表。
- connector 主路径没跑通前，DevRel / Product / GTM 的全职候选、strong 和 soft 结论都不成立；此时战略状态是暂停投入，只做标杆/线索校准和连接器修复。
- 产品规划、平台产品、PM、roadmap 证据归 `AI产品/平台`。
- 增长、营销、商业化、合作伙伴拓展、DevRel、开发者社区证据归 `GTM/增长/DevRel`。
- `partnerships` 只指候选人职业职能证据；不要把商务合作对象、销售线索列表或合作伙伴页面当候选人来源。
- 不推断搬迁、签证、薪资、触达意愿或求职意愿。
- 默认地域对找人入口是排序和核验偏置，对推荐人选是升级门槛；只看公开职业资料里的中国大陆、港澳台、中文教育/工作/社区、中国市场或中国相关机构/公司信号，不推断候选人愿意回国、搬迁或覆盖某市场，也不凭姓名、照片或族裔猜测。
- 不因为产品涉及 Agent、LLM 或 AI，就默认走 GitHub 工程路线。
- LinkedIn 优先不排斥 GitHub、X、产品页或媒体报道，但这些来源只做公司/找人来源、
  公开作品或公开表达补充；候选人身份仍需职业资料验证。
- DevRel strong 必须有职业资料中的 DevRel/开发者生态/社区/开发者营销职责，并有开发者结果证据（SDK/docs/examples、社区治理、活动/演讲、开发者增长或开源生态）；只有 KOL、会议嘉宾、GitHub org member、课程/教程或公开搜索摘要时默认 `lead`，补到独立第二来源后才可 `soft`。
- 人选名字必须是 Markdown 链接，优先链接到 LinkedIn、个人主页或公开资料；产品、公司、文章、演讲、项目和社区证据放入“相关作品 / 证据”，不要和人选混在同一列。不要把 helper 返回的链接改成裸 URL。
- 候选人行内必须回答“怎么联系到”和“可动性结构信号”：优先写进 `下一步`，例如
  `公开职业渠道：LinkedIn；结构信号：在职商务负责人，需先确认当前方向和是否开放外部机会`。
  不要判断求职意愿；自营创业、CEO、founder、公司核心负责人默认按低可动性或顾问/引荐优先处理。
  最终用户答复里每个候选人都要显式保留 `公开联系路径：...；结构信号：...`，不能只给链接或把它们挪到总风险段落。

## 参考

| 参考文件                                                                                                                                                                                                              | 何时读取                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [小批量辅助脚本](scripts/small-batch-product-gtm.mjs)                                                                                                                                                                 | 用户只要 1-3 个 Product/GTM 强线索                                  |
| [执行预算](../sifta-search/references/execution-budget.md)                                                                                                                                                            | 控制 CLI 次数、延迟和重复搜索                                       |
| [CLI 合同](../sifta-search/references/cli-reference.md)                                                                                                                                                               | 调用 LinkedIn 连接器、auth/status/schema 失败                       |
| [查询规则](../sifta-search/references/query-contract.md)                                                                                                                                                              | 写 LinkedIn/Product/GTM query 或拆多来源反馈                        |
| [找人来源方案](../sifta-search/references/source-map-recipes.md)                                                                                                                                                      | 公司地图、相邻公司池或 DevRel 社区证据                              |
| [AI 垂直找人来源](../sifta-search/references/ai-vertical-source-taxonomy.md) / [角色证明标准](../sifta-search/references/role-fit-rubrics.md) / [X 和社区信号](../sifta-search/references/x-and-community-signals.md) | AI 产品、GTM、founder/operator、独立开发者、DevRel 或公开表达补证据 |
| [状态门槛](../sifta-search/references/project-brief-and-state.md)                                                                                                                                                     | 公司/赛道线索升级候选前                                             |
| [适配证明包](../sifta-search/references/fit-proof-packet.md) / [输出规则](../sifta-search/references/output-quality.md)                                                                                               | 输出推荐人选、还要确认和下一步                                      |
