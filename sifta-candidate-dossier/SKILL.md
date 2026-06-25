---
name: sifta-candidate-dossier
metadata:
    version: 0.0.6
    tags: [sifta-search, recruiting, sourcing, dossier, verification]
description: >
    用于已知候选人深挖、公开资料核验和候选人档案。用户给出候选人姓名、
    GitHub、LinkedIn、个人主页、论文作者、上一轮候选人或候选人 key，并希望查公开职业联系方式、
    过往经历、公开信息、成就、论文、开源贡献、产品/GTM 成果或风险缺口时使用。
    不用于继续找新人、私人信息挖掘、背景调查、auth-gated 数据或自动触达。
---

# Sifta 候选人档案

用户已经有一个明确候选人，想深挖他的公开信息、经历、成就、联系方式或风险时使用本技能。
这不是寻访扩展，不要把深挖任务变成继续找更多人。
没有可消歧身份时硬停止，只问用户补 GitHub、LinkedIn、个人主页、公司或地点线索。

## 执行流程

1. 先做身份消歧：确认输入是同一个人；只有姓名或线索不足时，先要求个人资料或给出
   低置信度说明，不跨渠道硬合并。
2. 已知 GitHub handle/URL 且只需公开职业档案时，先运行 `node scripts/known-github-dossier.mjs --github "<url-or-login>" --query "<用户原始深挖目标>"`；辅助脚本完成后直接整理用户报告，说明结论、公开证据、覆盖风险和下一步，不再网页搜索、打开辅助脚本 URL、扫 raw README、查 LinkedIn 或继续找新人。
3. 有 GitHub、LinkedIn、X、个人主页或用户给出的个人资料时，由宿主 Agent 读取公开 profile 和可追溯材料，按本技能输出结构整理证据；不要调用服务端补证据 API。
4. 用宿主 Agent 原生搜索补公开材料：个人主页、GitHub、LinkedIn 公开资料、Google Scholar、
   OpenAlex、Semantic Scholar、arXiv/OpenReview、Papers with Code、company bio、talk、podcast、
   conference、patent、media、project page；只有用户批准第二轮或辅助脚本不适用时才这么做。
5. 联系方式只收集候选人本人公开职业联系方式：个人主页公开 email、GitHub 公开邮箱、论文通讯邮箱、
   公开社交/个人资料链接。公司公开联系页只能作为非个人公开渠道，不能标成候选人联系方式；
   不要推断私人邮箱格式、手机号、住址、家庭信息或 auth-gated/private 数据。
6. 输出候选人档案：身份、履历时间线、公开成就、证据、联系方式、风险缺口和下一步核验动作。

## 来源清单

| 来源 | 用途 | 边界 |
| --- | --- | --- |
| LinkedIn / company bio | 职业经历、title、公司、地区、时间线 | 不抓取非公开内容，不猜求职意愿 |
| GitHub / project page | 开源贡献、repo、issue、commit、maintainer 身份 | 仓库 owner 缺身份互链时只写低置信度 |
| 个人主页 | 身份互链、公开 email、项目、CV、论文、talk | 只记录公开职业联系信息 |
| Google Scholar / OpenAlex / Semantic Scholar | 论文、引用、共同作者、研究方向 | Google Scholar 不假设官方 API |
| arXiv / OpenReview / Papers with Code | preprint、submission、official code、benchmark | 论文作者仍需个人资料核验 |
| Media / talks / podcast / patents | 公开成就、观点、商业或技术影响力 | 标明来源和日期，避免过期事实 |

## 输出格式

```markdown
目标：<用户想深挖的人和目的>
身份核验：<同人置信度 + 证据>

| 模块 | 结论 | 证据 | 置信度 |
| --- | --- | --- | --- |
| 履历时间线 | ... | ... | 高/中/低 |
| 公开成就 | ... | ... | 高/中/低 |
| 技术/产品/GTM 证据 | ... | ... | 高/中/低 |
| 联系方式 / 公开渠道 | ... | ... | 高/中/低 |
| 风险与缺口 | ... | ... | 高/中/低 |

覆盖风险：
- <privacy/source gaps and stopped verification>

下一步：
- <需要人工核验或下一步搜索>
```

## 质量门

- 最终答复必须保留覆盖风险；辅助脚本停止时不要把停止标记、脚本名、命令、参数或运行过程写进用户答复。
- 不输出未公开的私人电话、住址、家庭信息、身份证件、私人邮箱猜测或数据 broker 结果。
- 联系方式必须有公开来源链接；没有公开联系方式时写“未找到公开职业联系方式”，不要猜。
- 同名、同机构、同论文作者不足以合并身份；必须有个人资料互链、主页、项目或明确公开证据。
- 成就要分层：论文 / 开源 / 产品 / 商业 / 社区 / 组织影响力，不混成一段泛 summary。
- 过往经历、title 和时间线只写公开来源支持的事实；不推断离职、薪资、意愿或可入职时间。

## 参考

| 参考文件 | 何时读取 |
| --- | --- |
| [已知 GitHub 辅助脚本](scripts/known-github-dossier.mjs) | 已知 GitHub handle/URL 的小批量候选人档案 |
| [CLI 合同](../sifta-search/references/cli-reference.md) | 需要 auth/status/schema 或 `find-people` 调用轨迹 |
| [状态门槛](../sifta-search/references/project-brief-and-state.md) | 身份不清 -> 个人资料线索 -> 已验证的人 |
| [来源地图方案](../sifta-search/references/source-map-recipes.md) | 补公开来源清单或学术/GitHub 线索 |
| [适配证明](../sifta-search/references/fit-proof-packet.md) | 候选人档案要转招聘适配判断 |
| [输出规则](../sifta-search/references/output-quality.md) / [查询规则](../sifta-search/references/query-contract.md) | 输出风险或修补全输入 |
