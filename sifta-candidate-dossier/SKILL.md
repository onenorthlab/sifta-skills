---
name: sifta-candidate-dossier
metadata:
    version: 0.0.8
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
2. 已知 GitHub handle/URL 且只需公开职业档案时，先运行 `node scripts/known-github-dossier.mjs --github "<url-or-login>" --query "<用户原始深挖目标>" --json`；辅助脚本返回的是结构化初筛档案，不是最终招聘判断。
   - 默认这是一次 GitHub-only 已知人档案：helper 结束后必须停止工具使用并直接整理用户报告；不要再运行 `curl`、`gh api`、网页搜索、浏览器、原生搜索或其它 URL 抓取来补证据。
   - helper 返回的 repo、PR、profile、社交链接或公司链接只是报告证据或下一步核验对象，不等于用户批准继续抓取这些 URL。
   - 最终报告必须用白话写明“本轮没有继续找新人 / 不扩展新候选，只围绕已知 GitHub profile 和公开职业资料核验”。
   - 只有用户明确要求第二轮补证、或用户在原始请求里同时给出 LinkedIn/个人主页/company bio/官方博客/项目页等具体非 GitHub URL 时，才补查这些已知 URL；仍然只围绕同一个人，不做同名搜索、不要抓 auth-gated 内容、不要猜私人联系方式。
   - 如果 helper 只返回薄 GitHub 线索，不要为了凑强结论而搜索新人；把该人写成 profile lead / 待核验档案，说明还缺职业资料、项目归属、当前角色和公开职业渠道。
   - 用户可见按 `../sifta-search/templates/final-report.md`：结论、人选和证据、其他线索 / 需要确认、下一步；不要新增「身份核验」「公开工程证据」「联系方式」等顶层标题，不输出命令、脚本名、参数、events 或运行过程。
3. 有 GitHub、LinkedIn、X、个人主页或用户给出的个人资料时，由宿主 Agent 读取公开 profile 和可追溯材料，按本技能输出结构整理证据；不要调用服务端补证据 API。
4. 用宿主 Agent 原生搜索补公开材料：个人主页、GitHub、LinkedIn 公开资料、Google Scholar、
   OpenAlex、Semantic Scholar、arXiv/OpenReview、Papers with Code、company bio、talk、podcast、
   conference、patent、media、project page；只有用户批准第二轮或辅助脚本不适用时才这么做。
5. 联系方式只收集候选人本人公开职业联系方式：个人主页公开 email、GitHub 公开邮箱、论文通讯邮箱、
   公开社交/个人资料链接。公司公开联系页只能作为非个人公开渠道，不能标成候选人联系方式；
   不要推断私人邮箱格式、手机号、住址、家庭信息或 auth-gated/private 数据。
   最终报告必须显式写出不查询私人邮箱、手机号、非公开联系方式，不自动发送消息或提交表单。
6. 输出候选人档案时，身份、履历时间线、公开成就、证据、联系方式和风险缺口都要折进短决策简报：身份和公开证据放「人选和证据」，联系方式只写公开职业渠道和缺口，弱线索、缺口和隐私边界放「其他线索 / 需要确认」或「下一步」。不要把同一个候选人按 repo、PR、论文拆成多个人选行。
7. 不要把 `hireable=true`、`Open to new opportunities`、`open to work`、profile bio 或状态标记写成“可招聘性”或“求职意愿”结论；最多写“公开 profile 有开放机会相关表述，触达前必须确认当前方向和是否开放外部机会”。

## 来源清单

| 来源                                         | 用途                                           | 边界                                |
| -------------------------------------------- | ---------------------------------------------- | ----------------------------------- |
| LinkedIn / company bio                       | 职业经历、title、公司、地区、时间线            | 不抓取非公开内容，不猜求职意愿      |
| GitHub / project page                        | 开源贡献、repo、issue、commit、maintainer 身份 | 仓库 owner 缺身份互链时只写低置信度 |
| 个人主页                                     | 身份互链、公开 email、项目、CV、论文、talk     | 只记录公开职业联系信息              |
| Google Scholar / OpenAlex / Semantic Scholar | 论文、引用、共同作者、研究方向                 | Google Scholar 不假设官方 API       |
| arXiv / OpenReview / Papers with Code        | preprint、submission、official code、benchmark | 论文作者仍需个人资料核验            |
| Media / talks / podcast / patents            | 公开成就、观点、商业或技术影响力               | 标明来源和日期，避免过期事实        |

## 输出格式

```markdown
**结论**

- <用户想深挖的人、招聘判断和本轮边界>

**人选和证据**

| 人选 | 招聘判断 | 为什么值得聊 | 相关作品 / 证据 | 还要确认 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| [<人选>](url) | <全职/顾问/推荐人/待核验判断> | <一句招聘白话> | <GitHub / 主页 / repo / 论文 / 产品证据> | <身份、当前角色、贡献归属、公开职业渠道> | <核验动作> |

**其他线索 / 需要确认**

| 事项 | 为什么重要 | 怎么确认 |
| --- | --- | --- |
| <身份 / repo / 论文 / 公开职业渠道缺口> | <相关性 / 风险> | <核验动作> |
| <隐私边界> | <避免猜测私人信息或自动触达> | <只使用公开职业资料> |

**下一步**

- <需要人工核验或下一步搜索>
```

## 质量门

- 最终答复必须保留还要确认和下一步补证动作；辅助脚本停止时不要把停止标记、脚本名、命令、参数或运行过程写进用户答复。
- 最终答复必须使用短决策简报：结论、人选和证据、其他线索 / 需要确认、下一步；不要把「身份核验」「公开工程证据」「联系方式」作为顶层标题，相关内容放进「人选和证据」和「其他线索 / 需要确认」。
- 已知 GitHub dossier 默认不继续找新人、不扩展候选池；如果只使用 GitHub 公开资料，报告必须显式写出这条边界，避免招聘负责人误以为已经做了新一轮 sourcing。
- 人选名字必须是 Markdown 链接，例如 `[Harrison Chase / hwchase17](https://github.com/hwchase17)`；repo、论文、PR、主页放进“相关作品 / 证据”。不要把 helper 返回的链接改成裸 URL。
- helper 后默认不再补证；如果用户明确批准第二轮或原始请求给出具体非 GitHub URL，补证也只能验证已知候选人的公开资料、互链、项目归属和职业渠道，不能变成继续找新人或宽泛 web research。补证后的事实写成证据和风险，不写搜索过程。
- 不输出未公开的私人电话、住址、家庭信息、身份证件、私人邮箱猜测或数据 broker 结果。
- 隐私边界只在相关场景用白话写出：不查询私人邮箱、手机号、非公开联系方式，不自动发送消息或提交表单。
- 联系方式必须有公开来源链接；没有公开联系方式时写“未找到公开职业联系方式”，不要猜。
- 如果报告提到默认地域/市场或中国/中文生态缺口，必须写清楚只看公开职业信号，不凭姓名、照片、族裔或国籍推断。
- `hireable=true`、`Open to new opportunities`、`open to work`、profile bio 或状态标记不能写成“可招聘性”或“求职意愿”结论；只能转成触达前要确认的问题。
- 同名、同机构、同论文作者不足以合并身份；必须有个人资料互链、主页、项目或明确公开证据。
- 成就要分层：论文 / 开源 / 产品 / 商业 / 社区 / 组织影响力，不混成一段泛 summary。
- 过往经历、title 和时间线只写公开来源支持的事实；不推断离职、薪资、意愿或可入职时间。

## 参考

| 参考文件                                                                                                            | 何时读取                                             |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [已知 GitHub 辅助脚本](scripts/known-github-dossier.mjs)                                                            | 已知 GitHub handle/URL 的小批量候选人档案            |
| [CLI 合同](../sifta-search/references/cli-reference.md)                                                             | 需要 auth/status/schema 或 `find-people` 调用轨迹    |
| [状态门槛](../sifta-search/references/project-brief-and-state.md)                                                   | 身份不清 -> 个人资料线索 -> 已验证的人               |
| [找人来源方案](../sifta-search/references/source-map-recipes.md)                                                    | 补公开来源清单或学术/GitHub 线索                     |
| [深挖到建联工作流](../sifta-search/references/deep-dive-to-outreach-workflow.md)                                    | 候选人档案后需要触达、人工确认或反馈二轮             |
| [角色证明标准](../sifta-search/references/role-fit-rubrics.md)                                                      | 判断工程、研究、PM、GTM、founder、独立开发者的强证据 |
| [适配证明包](../sifta-search/references/fit-proof-packet.md)                                                        | 候选人档案要转招聘适配判断                           |
| [输出规则](../sifta-search/references/output-quality.md) / [查询规则](../sifta-search/references/query-contract.md) | 输出还要确认或修补全输入                             |
