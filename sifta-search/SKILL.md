---
name: sifta-search
metadata:
    version: 0.0.10
    tags: [sifta-search, recruiting, sourcing, candidates]
description: >
    AI/前沿科技招聘寻访的总控入口。用户要新找候选人、人才、强人、创始人型/超级个体、工程师、
    研究员、产品、GTM、DevRel、市场增长、独立开发者，或不确定该走 GitHub、LinkedIn、论文、
    候选人档案、触达还是反馈续搜时使用；即使用户没说渠道，也要按能力画像分流。
    已知候选人深挖、触达草稿、上一轮反馈若已明确命中对应 Sifta 场景技能，可直接使用场景技能。
    找人请求夹带私人邮箱、手机号、自动发送或批量外联时也使用本技能做硬停止，不搜索。
    明确不找候选人/不做寻访的公司研究、市场研究、商业化模式、增长打法、JD、销售线索、合作/KOL、
    ATS 管理不要使用。
---

# Sifta 人才搜索

Sifta 是 AI 行业招聘寻访增强层，不是通用网页搜索、公司情报、销售线索、触达、ATS、KOL 合作或独立本地 Agent 运行环境。本技能面向 Codex、Hermes、Claude Code、OpenClaw、Cursor 等宿主 Agent；Sifta 只补候选人渠道、招聘语义、证据结构、项目适配和反馈闭环。

把本技能当作分流入口使用：用户描述想找的人、要补的能力或候选人目标后，本地 Agent 判断是否进入 Sifta 寻访，再选择一个最匹配的场景技能。Sifta CLI/API 是可选命令/连接器层，不是通用搜索替代品；执行类找人 run 通过连接器完成时，默认把 run history 同步到 Web，供用户回看和人工复核。

共同执行门、隐私边界、默认地域、helper 停止、Web 保存和最终报告规则见 [references/shared-gates.md](references/shared-gates.md)。最终找人结果必须按 [templates/final-report.md](templates/final-report.md) 输出给招聘负责人，不用工程汇报标题替代 `结论 / 人选和证据 / 其他线索 / 下一步`。

## 1. 先判断本轮类型

| 类型 | 处理 |
| --- | --- |
| 默认执行 | 用户要“找人 / 推荐 / 给几个 / 候选人 / 名单 / 跑一轮”，且能推断能力画像时，进入场景技能执行 |
| 只给计划 | 用户明确说“先规划 / 怎么找 / 来源地图 / 别搜索 / 只要方法”时，只输出找人入口、升级门槛和下一步 |
| 硬停止 | 不清楚是否招聘、画像完全不可推断、私人联系方式、自动发送、销售/合作线索时，不搜索，只问一个必要澄清问题 |

用户不必说明渠道、数据库、来源或准确头衔；先按能力画像理解，再内部分流。不要把 sales lead、KOL 合作、公司研究或市场分析混成候选人寻访。

## 2. 路由表

选择一个最匹配的场景技能；不要把所有技能和参考文件都读进上下文。

| 场景 | 读取 |
| --- | --- |
| 工程、开源、Agent/LLM infra、MCP、GitHub 证据 | [../sifta-github-engineering/SKILL.md](../sifta-github-engineering/SKILL.md) |
| 产品、GTM、增长、商业化、DevRel、公司地图 | [../sifta-linkedin-product-gtm/SKILL.md](../sifta-linkedin-product-gtm/SKILL.md) |
| 研究、WAM/VLA、基础模型、论文、实验室、导师/共同作者 | [../sifta-academic-graph/SKILL.md](../sifta-academic-graph/SKILL.md) |
| 已知候选人深挖、公开经历、成就、公开职业联系方式、身份核验 | [../sifta-candidate-dossier/SKILL.md](../sifta-candidate-dossier/SKILL.md) |
| 招聘私信、邮件、LinkedIn 消息、引荐介绍、跟进文案 | [../sifta-outreach-copy/SKILL.md](../sifta-outreach-copy/SKILL.md) |
| 上一轮人工反馈、分类调整、继续找类似但更匹配的人 | [../sifta-review-feedback/SKILL.md](../sifta-review-feedback/SKILL.md) |
| 创始人型 / 超级个体 / 技术型创始人 / 有创业潜质的独立开发者 | [references/founder-super-individual-playbook.md](references/founder-super-individual-playbook.md)（并按底层能力画像并用工程/学术/GTM 场景技能） |

复合请求按顺序拆：

1. “找人 + 深挖”：先交付可推进人选，再只对已推荐或用户点名的人做候选人档案。
2. “找人 + 写触达”：先形成可推进人选和证据；达到推荐或建议先核实门槛后再写草稿。
3. 没有可推进人选时，只交付结果、其他线索和下一步补证动作，不写伪个性化触达。

## 3. 内部执行顺序

1. 压缩项目简报：目标问题、能力画像、默认地域、must-have、排除项、核验证据。可推断就写假设并推进；硬停止才问一个短问题。
2. 复杂画像先读 [references/ai-vertical-source-taxonomy.md](references/ai-vertical-source-taxonomy.md) 和 [references/role-fit-rubrics.md](references/role-fit-rubrics.md)，把行业方向、角色族和强证据变成内部来源地图。
3. 按场景 skill 执行；小批量 helper、native search、CLI/API、学术来源或候选人档案的选择由场景 skill 决定。
4. 如果调用 CLI，`--query` 必须符合 [references/query-contract.md](references/query-contract.md)；`--checkpoint` 放用户本轮原始目标、约束、默认地域假设和核验标准，不当保存备注或 CRM note。
5. 如果解析 JSON，优先读 `people`、`searchStrategy`、`sourceMap`、`evidenceLog`、`crmExport` 和 `warnings`。
6. 跨源融合：同一轮为同一画像跑了多个来源 helper（如研究型工程师同时跑 GitHub + 学术），用 [scripts/merge-proposals.mjs](scripts/merge-proposals.mjs) 把多个 proposal JSON 按公开互链（相同 GitHub login / ORCID / 个人主页 host / Twitter handle）**保守**合并去重，叠加多源证据。它只靠强公开身份锚合并、绝不靠同名合并；`crossSourceConfirmed` 的人是跨画像"超级个体"（如研究型工程师、infra 创业 CTO），优先核验。跨源确认是身份可信度增强，不是可招聘性结论，学术参与的合并 bucket 不自动升 strong。
7. 最终输出回答招聘决策：要求、公开证据、为什么值得聊、还要确认、下一步。

## 4. 命令边界

使用 CLI/API 时，每个会话第一次调用前先运行：

```bash
sifta-cli status
```

常用命令形态见 [references/cli-reference.md](references/cli-reference.md)。`find-people` 主路径默认追加 `--save` 并返回 `persisted.webPath`；最终回复应给出 Web 回看路径。保存只表示这轮找人可回看、可复核，不表示候选人已进入 shortlist、待触达或 pipeline。隐私 hard-stop、未认证、provider failure、0 人结果、schema 检查或用户要求不保存时，用 `--no-save`。

只有高频稳定字段优先使用独立 flag。Public API 新字段、临时实验字段或低频字段优先通过 `--input` JSON 传完整请求；显式 flag 会覆盖 `--input` 同名字段。

## 5. 质量门

不能把弱结果包装成强推荐：

- 论文、仓库、公司、实验室、项目、数据集、网页线索不能直接变候选人；必须找到个人资料或用户明确提供的公开个人资料。
- 默认中国/中文生态相关人才池未被用户放宽时，缺公开职业信号的人只能作为其他线索、产业标杆或待核验对象。
- Product/GTM/LinkedIn 主路径失败时，不输出全职候选、strong/soft shortlist 或“建议先聊”的候选表；只输出产业标杆、其他线索、阻塞原因和修复动作。
- 公开 email、公开主页、公开 profile 可以输出并标来源；私人邮箱、手机号、住址、家庭信息、data broker 或 auth-gated 内容不能查询、推断或输出。

详细质量门、失败恢复和最终报告口径见 [references/output-quality.md](references/output-quality.md)。

## 6. 参考

按需读取，不要一次读完：

| 文件 | 用途 |
| --- | --- |
| [references/shared-gates.md](references/shared-gates.md) | 共同执行门、默认地域、隐私、helper 停止、Web 保存 |
| [references/intent-routing.md](references/intent-routing.md) | 模糊需求、硬停止、找人向导 |
| [references/project-brief-and-state.md](references/project-brief-and-state.md) | 项目简报、状态机、线索升级 |
| [references/source-map-recipes.md](references/source-map-recipes.md) | 来源地图、公司图谱、相邻入口 |
| [references/founder-super-individual-playbook.md](references/founder-super-individual-playbook.md) | 创始人/超级个体：榜单反查、在营创始人降级为标杆、可招 vs 标杆二分输出 |
| [references/query-contract.md](references/query-contract.md) | CLI/API 参数和来源查询合同 |
| [references/cli-reference.md](references/cli-reference.md) | CLI status、find-people、schema 和失败恢复 |
| [references/execution-budget.md](references/execution-budget.md) | 小批量预算和停止条件 |
| [references/output-quality.md](references/output-quality.md) | 最终报告、warnings、失败恢复 |
| [templates/final-report.md](templates/final-report.md) | 用户可见报告模板 |
