---
name: sifta-candidate-dossier
metadata:
    version: 0.0.11
    tags: [sifta-search, recruiting, sourcing, dossier, verification]
description: >
    用于已知候选人深挖、公开资料核验和候选人档案。用户给出候选人姓名、GitHub、LinkedIn、X、个人主页、论文作者、上一轮候选人或候选人 key，并希望查公开职业联系方式、经历、成就、论文、开源贡献、产品/GTM 成果或风险缺口时使用。不用于继续找新人、私人信息挖掘、背景调查、auth-gated 数据或自动触达。
---

# Sifta 候选人档案

用户已经有一个明确候选人时使用；这不是寻访扩展，不要把深挖变成继续找更多人。没有可消歧身份时硬停止，只问用户补 GitHub、LinkedIn、X、个人主页、公司或地点线索。

## 执行流程

1. 先做身份消歧：确认输入是同一个人。跨渠道合并必须有互链、同 profile、同项目、同公司/主页、同 handle 等证据；只有同名或相似头像不足以合并。
2. 已知 GitHub handle/URL 且只需公开职业档案时，先运行 `node scripts/known-github-dossier.mjs --github "<url-or-login>" --query "<用户原始深挖目标>" --json`。
3. 这不是 GitHub-only 截图：helper 返回 `publicBreadcrumbs` 后，必须做 bounded same-person public expansion，默认 1-2 跳、最多 8-12 个公开 URL，不能只把个人主页、X、LinkedIn 或 repo homepage 写成“下一步可看”。
4. GitHub profile 的 `blog`、`twitter_username`、bio URL、repo homepage、package registry、company/org 是可读公开线索，不需要用户再次批准；没有明确公开链接时才停止并写缺口。
5. X/Twitter 只读公开 profile、bio link 和具体 status URL；具体 status URL 可尝试 FxTwitter、FixupX、vxtwitter 或 `api.fxtwitter.com`，但不能当成完整 X 搜索或登录墙替代。
6. LinkedIn、个人主页、Scholar、OpenAlex、arXiv/OpenReview、Papers with Code、package registry、项目页、company bio 同理：读公开可访问内容，记录同人证据和来源，不抓 auth-gated 内容。
7. 联系方式只输出候选人本人公开职业联系方式：公开 email、公开主页、公开 profile、论文通讯邮箱或社交资料链接，每条写来源；不推断邮箱格式、手机号、住址、家庭信息或 data broker 结果。
8. 输出时显式写明“本轮没有继续找新人 / 不扩展新候选，只围绕已知 profile 和公开职业资料核验”；过程隐藏按共享执行门。

## 输出格式

```markdown
**结论**

- <用户想深挖的人、招聘判断和本轮边界>

**人选和证据**

| 人选 | 招聘判断 | 为什么值得聊 | 相关作品 / 证据 | 还要确认 | 下一步 |
| --- | --- | --- | --- | --- | --- |
| [<人选>](url) | <全职/顾问/推荐人/待核验> | <招聘白话> | <GitHub / 主页 / repo / 论文 / 产品证据> | <身份、当前角色、贡献归属、公开职业渠道> | <核验动作> |

**其他线索 / 需要确认**

| 事项 | 为什么重要 | 怎么确认 |
| --- | --- | --- |
| <身份 / repo / 论文 / 公开职业渠道缺口> | <相关性 / 风险> | <核验动作> |

**下一步**

- <人工核验或下一步搜索>
```

## 质量门

- 最终答复必须保留还要确认和下一步；不要把「身份核验」「公开工程证据」「联系方式」作为额外顶层标题。
- 已知 GitHub dossier 默认不继续找新人、不扩展候选池；如果只使用 GitHub 公开资料，报告必须说明边界。
- 人选名字必须是 Markdown 链接；repo、论文、PR、主页放进“相关作品 / 证据”，不要把 helper 返回的链接改成裸 URL。
- helper 后如果有 `publicBreadcrumbs`，必须先做 bounded same-person public expansion；补证只能验证已知候选人的公开资料、互链、项目归属和职业渠道，不能变成宽泛 web research。
- 候选人本人公开的 email、公开主页、公开 profile 要输出并标来源；没有公开联系方式时写“未找到公开职业联系方式”，不要猜。
- 如果输出公开联系方式，下一步必须写人工核验 / 人工触达边界；不能暗示自动发送或使用私人、未公开联系方式。
- `hireable=true`、`Open to new opportunities`、`open to work`、profile bio 或状态标记不能写成“可招聘性”或“求职意愿”结论；只能转成触达前要确认的问题。
- 成就分层写：论文 / 开源 / 产品 / 商业 / 社区 / 组织影响力；过往经历、title 和时间线只写公开来源支持的事实。

## 参考

| 参考文件 | 何时读取 |
| --- | --- |
| [共享执行门](../sifta-search/references/shared-gates.md) | 公开联系方式、隐私边界、过程隐藏、最终报告 |
| [已知 GitHub 辅助脚本](scripts/known-github-dossier.mjs) | 已知 GitHub handle/URL 的小批量候选人档案 |
| [深挖到建联工作流](../sifta-search/references/deep-dive-to-outreach-workflow.md) | 候选人档案后需要触达、人工确认或反馈二轮 |
| [状态门槛](../sifta-search/references/project-brief-and-state.md) | 身份不清、个人资料线索、已验证的人 |
| [CLI 合同](../sifta-search/references/cli-reference.md) | auth/status/schema 或 `find-people` 调用轨迹 |
| [查询规则](../sifta-search/references/query-contract.md) | 输出还要确认或修补全输入 |
| [输出规则](../sifta-search/references/output-quality.md) / [适配证明包](../sifta-search/references/fit-proof-packet.md) | 候选人档案转招聘适配判断 |
