# Execution Boundary

本文件约束 agent 在一次用户请求中的工具使用范围，避免小批量 sourcing 变成无边界搜索。

## 1. 默认预算

| 场景 | 推荐边界 |
| --- | --- |
| Plan-first | 只输出 plan/source map/hard stop；不调用 CLI、web、browser 或 `gh` |
| GitHub / Engineering 1-3 强线索 | 优先用 route skill 的小批量 helper 或宿主 GitHub 工具；不要同轮反复换源 |
| Product/GTM 1-3 强线索 | 优先用 Sifta CLI/API；connector 不可用时停在 source plan |
| Academic graph | 先做 source map；不要把论文作者直接升级为候选人 |
| Candidate dossier | 只读公开 profile；必要时用 `sifta-cli enrich-people` 补结构化证据 |
| Privacy hard stop | 不搜索；说明边界并问一个必要澄清 |

## 2. 停止条件

满足任一条件时，本轮停止扩展并交付当前结果、warnings 和下一步建议：

- 用户只要 1-3 个强线索，已有可解释的候选或 source-map lead。
- helper 或 CLI 返回了明确的 provider/auth/schema/warning 信息。
- 当前结果只有弱线索，继续搜索也无法补足个人 profile 证据。
- 需要更大范围扩展、跨来源二轮或人工 review 后再继续。
- 涉及私人联系方式、自动发送、ATS/CRM 写入或未授权付费 connector。

不要为了让列表变长而连续调用 web search、browser、`gh`、`sifta-cli find-people`
或多个 helper。下一轮扩展应在用户确认后执行。

## 3. 质量边界

执行路径稳定不等于候选质量通过。最终输出仍要分开说明：

| 维度 | 要求 |
| --- | --- |
| relevance | 候选人主要经历能回答用户能力画像 |
| evidence strength | 证据可追溯到公开 profile、repo、论文、项目页或职业材料 |
| source reliability | 来源与候选人身份、职能和贡献匹配 |
| weakness honesty | 明确写缺口，不推断求职意愿、私人联系方式、薪资、签证或 relocation |

弱结果只能作为 source-map lead、pending lead 或 coverage warning，不能包装成强推荐。
