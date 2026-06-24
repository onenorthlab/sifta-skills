---
name: sifta-outreach-copy
metadata:
    version: 0.0.6
    tags: [sifta-search, recruiting, outreach, copy]
description: >
    用于已知候选人或 candidate dossier 之后的 recruiting outreach copy：DM、email、
    LinkedIn message、referral intro、follow-up 文案。用户要求基于候选人公开证据、
    项目/岗位、触达渠道、语气和限制生成可人工确认的触达草稿时使用。
---

# Sifta Outreach Copy
用于已知候选人、上一轮候选人结果或 candidate dossier 之后的触达文案。目标是生成 evidence-backed、可人工确认的 recruiter / founder / hiring manager outreach 草稿，不做发送自动化，不做联系方式抓取。

## Workflow

1. 先读取或复用 candidate dossier、上一轮候选人表、用户提供的公开 profile / evidence。
2. 确认项目 / 岗位、触达渠道、语气、约束和不可说内容；缺失但风险可控时写入 Assumptions。
3. 从公开证据中选择 1-2 个 personalization angle：项目、开源贡献、论文、产品经历、社区影响或职业方向。
4. 生成 2-3 个渠道版本，例如 short DM、email、LinkedIn message、referral intro、follow-up。
5. 保留每个个性化句子的证据来源，不把弱证据包装成确定事实。
6. 给出人工确认清单：事实、称谓、渠道、链接、合规和发送前需要用户确认的点。

## Required Inputs

| Input | Required | Notes |
| --- | --- | --- |
| 候选人公开证据 | yes | dossier、GitHub、LinkedIn public profile、个人主页、论文、repo、公开访谈等 |
| 项目 / 岗位 | yes | 公司 / 团队、岗位、方向、must-have、location / remote 如已知 |
| 触达渠道 | yes | email、LinkedIn、X/DM、referral intro、follow-up 等 |
| 语气 | yes | founder-style、professional、warm、concise、technical、low-pressure 等 |
| 约束 | yes | 长度、语言、是否提公司名、是否提岗位名、是否需要 CTA |
| 不可说内容 | yes | 薪资、签证、入职时间、公司资源、候选人隐私、竞争对手等限制 |

## Message Angle

- 只用公开、可引用、和岗位相关的证据做 personalization。
- 优先把候选人证据和项目需求连接起来，而不是堆砌赞美。
- 保持低压力 CTA：询问是否愿意了解、是否方便 brief chat、是否可转给合适的人。
- 对高不确定性证据使用柔性表述：`I noticed your public work on...`、`your profile suggests...`。

## Safety Boundaries

- 不自动发送，不点击发送按钮，不代替用户做最终确认。
- 不抓取、猜测或生成私人联系方式；没有公开职业联系方式时只建议使用用户已有渠道或公开 profile。
- 不编造与候选人的关系、内推关系、共同熟人或对方兴趣。
- 不夸大公司资源、融资、团队、客户、影响力或岗位确定性。
- 不承诺薪资、签证、入职时间、职级、title、offer 或面试结果。
- 不使用敏感 / 私人信息，包括年龄、家庭、健康、住址、私人邮箱猜测、非公开社交内容。
- 不暗示“我们一直关注你”“看过你很多活动轨迹”等过度了解。

## Output Format

```markdown
目标：<候选人 + 项目/岗位 + 渠道目标>
Assumptions：
- <缺失输入和采用的保守假设>

Message Strategy：
- Angle: <为什么这个切入点和岗位相关>
- Tone: <语气和长度策略>
- CTA: <低压力下一步>

Drafts：
1. <Channel / version name>
   <draft>
2. <Channel / version name>
   <draft>
3. <Channel / version name, optional>
   <draft>

Personalization Evidence：
| Claim in copy | Public evidence | Confidence |
| --- | --- | --- |
| ... | ... | high/medium/low |

Risks/Do-not-say：
- <不能说或需要人工确认的点>
Next Action：
- <发送前人工确认清单>
```

## References

- CLI contract: [../sifta-search/references/cli-reference.md](../sifta-search/references/cli-reference.md)
- Query rules: [../sifta-search/references/query-contract.md](../sifta-search/references/query-contract.md)
- Source map recipes: [../sifta-search/references/source-map-recipes.md](../sifta-search/references/source-map-recipes.md)
- Fit proof packet: [../sifta-search/references/fit-proof-packet.md](../sifta-search/references/fit-proof-packet.md)
- Output rules: [../sifta-search/references/output-quality.md](../sifta-search/references/output-quality.md)
