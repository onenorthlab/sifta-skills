---
name: sifta-linkedin-product-gtm
metadata:
    version: 0.0.10
    tags: [sifta-search, recruiting, sourcing, linkedin, product, gtm]
description: >
    用于 AI 产品/GTM/增长/商业化/DevRel/合作伙伴拓展候选人、人选或人才寻访；用户表达“找能把产品、增长、商业化、开发者生态、中国市场或出海做起来的人”时使用。明确不找候选人的公司研究、市场分析、岗位说明、销售线索、KOL 合作不要使用；要求私人邮箱、手机号、自动发送或批量外联时硬停止。
---

# Sifta LinkedIn 产品和 GTM

主要证据来自职业资料、产品负责人经历、GTM、增长、商业化、合作伙伴拓展、DevRel 或相邻公司经历时走 LinkedIn 优先路径。公司地图、产品页、GitHub、开发者社区、X/公开帖子可以辅助，但候选人身份仍需职业资料、个人主页或明确公开资料验证。

## 执行流程

1. 先按共享执行门判断执行、计划或硬停止；确认岗位族是 Product/GTM/DevRel，不要因 AI/Agent/LLM 自动转工程。
2. 用户未指定地区时默认 `中国/中文生态相关人才池优先`；只看公开职业信号。
3. 用户明确执行且只要 1-3 个强线索时，运行 `node scripts/small-batch-product-gtm.mjs --query "<用户语言画像>" --checkpoint "<用户原始目标>" --target-count 3 --json`。
4. helper 完成后按共享执行门停止，按 `../sifta-search/templates/final-report.md` 整理。失败、未认证、API 不可达或 0 人时，不用公开网页 fallback 形成候选名单。
5. 需要更大名单、调用轨迹或反馈闭环时才运行 `sifta-cli status` + `find-people`；`--sources '["linkedin"]'`，`--query` 保留用户自然语言画像、职能、城市、公司、行业、市场和默认地域偏置。
6. GTM / 公司地图场景先建立公司/赛道地图，再转候选人搜索；公司页、活动页和社区账号只是来源线索，不能直接当候选人。
7. DevRel / 开发者营销可用 GitHub、X 或社区证据补充；X-only 弱证据只能进入待核验线索，不能升级成推荐候选人。

## 质量门

- 最终答复和过程隐藏按共享执行门；不要用工程任务汇报标题。
- Product/GTM 候选人必须有职业资料链接、职能证据、为什么值得聊、公开联系路径、结构信号、还要确认和下一步。
- connector 主路径没跑通前，全职候选、strong 和 soft 结论都不成立；只输出产业标杆、其他线索、阻塞原因和修复动作。
- **区分"公司层面指标"和"个人操盘证据"**（增长/GTM 岗最容易糊）：公司 ARR/用户数/增速只证明公司在涨，**不证明这个人是主推手**。要找**个人层面**的证据：本人署名的增长复盘/case 文章、演讲/播客里讲自己的打法、媒体对**本人**的具名报道（非公司报道）、本人主导的具体 campaign/项目。只有公司层面数据 + 本人在职头衔时，证据封顶为"能力相关但个人贡献待核"，在报告里显式标注，别把公司战绩默认算作此人战绩。
- 默认地域对找人入口是排序和核验偏置，对推荐人选是升级门槛；不凭姓名、照片或族裔推断。
- 不推断搬迁、签证、薪资、触达意愿或求职意愿；founder/CEO/自营创业者默认按低可动性或顾问/引荐优先处理。
- DevRel strong 必须有职业资料中的 DevRel/开发者生态/社区/开发者营销职责，并有开发者结果证据；只有 KOL、会议嘉宾或 GitHub org member 时默认 lead。
- helper/connector 回传的 `functionCategory` / `careerStage` / `talentPool` 只是**后端关键词粗分类**（正则命中头衔文本，枚举不尽、跨语言会漏判、founder/benchmark 等词可能误分到"产业标杆池"）。**别直接采信这些标签**：拿候选人的原始 `headline` / `currentTitle` / `currentCompany` / `summary`，按 [角色证明标准](../sifta-search/references/role-fit-rubrics.md) 自己判职能族、角色契合、可动性和分桶；后端标签只作机械提示。同理"是否中国生态"以候选人声明的公司/地点原文为准，由你判断，别只信固定清单。
- 人选名字必须是 Markdown 链接；产品、公司、文章、演讲、项目和社区证据放进“相关作品 / 证据”。

## 计划输出边界

计划阶段必须说明：未执行实时搜索；公司池为用户给定或待验证；不推断求职意愿、薪资、签证、搬迁或触达意愿。CLI 示例只用于明确执行场景，不要在计划阶段直接运行或展示。

## 参考

| 参考文件 | 何时读取 |
| --- | --- |
| [共享执行门](../sifta-search/references/shared-gates.md) | 执行/计划/硬停止、默认地域、helper 停止、过程隐藏 |
| [小批量辅助脚本](scripts/small-batch-product-gtm.mjs) | 用户只要 1-3 个 Product/GTM 强线索 |
| [执行预算](../sifta-search/references/execution-budget.md) | 控制 CLI 次数、延迟和 helper 后停止 |
| [CLI 合同](../sifta-search/references/cli-reference.md) | LinkedIn 连接器、auth/status/schema 失败 |
| [查询规则](../sifta-search/references/query-contract.md) | 写 LinkedIn/Product/GTM query 或拆多来源反馈 |
| [找人来源方案](../sifta-search/references/source-map-recipes.md) | 公司地图、相邻公司池、DevRel 社区证据 |
| [输出规则](../sifta-search/references/output-quality.md) | 输出推荐人选、风险、公开联系路径和下一步 |
| [角色证明标准](../sifta-search/references/role-fit-rubrics.md) / [X 和社区信号](../sifta-search/references/x-and-community-signals.md) | AI 产品、GTM、DevRel 或公开表达补证据 |
