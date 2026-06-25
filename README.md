# Sifta Skills

面向 AI 招聘候选人 sourcing 的 agent skills。Sifta 是本地强 agent 的增强层，不替代
Codex、Claude Code、OpenClaw 或 Cursor 的原生搜索、阅读和推理能力。

## 安装

**用 Agent 安装（推荐）：** 把以下提示词发给 Agent，它会按文档自动完成安装和配置：

```
请阅读 https://sifta.onenorthdev.com/doc/cli-setup.md，按步骤为我安装并配置 Sifta CLI，密钥是：<SIFTA_API_KEY>
```

**手动安装：**

```bash
npx -y @sifta/cli@latest install
```

**配置认证：**

```bash
sifta-cli auth "<SIFTA_API_KEY>" --base-url https://sifta.onenorthdev.com/api
```

**验证：**

```bash
sifta-cli status
sifta-cli tools
```

`install` 用于首次安装：持久化安装 Sifta CLI 并安装 Sifta skills。后续收到
`_notice.update` 时再执行 `sifta-cli update`。

安装完成后重启 agent 或新开会话。

## 可用 Skill

外部分发采用 router + 多个短 skill；不要把所有 sourcing 逻辑堆在一个 `SKILL.md` 里。

| Skill                                                        | 作用                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------- |
| [`/sifta-search`](sifta-search/)                             | 总控 router，判断是否进入 Sifta 并选择具体短 skill                  |
| [`/sifta-github-engineering`](sifta-github-engineering/)     | GitHub-first 工程和开源候选人                                       |
| [`/sifta-linkedin-product-gtm`](sifta-linkedin-product-gtm/) | LinkedIn 产品、GTM、增长、商业化和 company-map                      |
| [`/sifta-academic-graph`](sifta-academic-graph/)             | 学术图谱、研究型、基础模型、WAM/VLA 和 early-career research talent |
| [`/sifta-candidate-dossier`](sifta-candidate-dossier/)       | 已知候选人 deep-dive、公开经历、成就、联系方式和风险缺口            |
| [`/sifta-outreach-copy`](sifta-outreach-copy/)               | 私信、邮件、LinkedIn message、referral intro 和 follow-up 草稿      |
| [`/sifta-review-feedback`](sifta-review-feedback/)           | 人工 review 反馈、二轮搜索和 mixed-source 拆分                      |

## 能力边界

| 场景                               | 推荐执行面                                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| GitHub 工程候选人                  | 先用宿主 native GitHub search / GitHub MCP / `gh`；需要 Sifta trace 或 review loop 时用 CLI |
| Academic graph / 学术通道          | 先用宿主 academic/web search 建 source map；需要结构化 research trace 时用 CLI              |
| LinkedIn 产品、GTM、商业化         | 优先用 Sifta CLI/API connector                                                              |
| 已知 profile enrichment            | 用 Sifta CLI/API 统一补证据                                                                 |
| Candidate dossier / 已知候选人深挖 | 先做 identity resolution，只整理公开信息和公开职业联系方式                                  |
| Outreach copy / 触达文案           | 只生成 evidence-backed 草稿；发送前必须人工确认                                             |
| Review feedback 二轮               | 基于上一轮候选人和人工反馈，用 Sifta CLI 继续下一轮搜索                                     |

无论是否调用 CLI，都必须按 Sifta 输出质量门交付：候选人必须有个人 profile 证据，source map
线索不能直接变成候选人，coverage warnings 不能省略。联系方式只限公开职业联系方式；不要猜私人
邮箱、手机号、住址或家庭信息。触达能力只生成草稿，不自动发送，不编造关系、共同熟人、薪资、
签证、入职时间或公司资源承诺。

核心 shared references 位于 [`sifta-search/references`](sifta-search/references/)：

| Reference               | 作用                                                                              |
| ----------------------- | --------------------------------------------------------------------------------- |
| `intent-routing.md`     | 模糊需求临界点、何时追问、何时直接推进                                            |
| `source-map-recipes.md` | Engineering / Product / GTM / Research / Dossier / Outreach 来源地图              |
| `query-contract.md`     | GitHub、LinkedIn、academic、review feedback 的 query / checkpoint 合同            |
| `fit-proof-packet.md`   | requirement -> evidence -> source -> confidence -> weakness -> next action 证明包 |
| `output-quality.md`     | 输出格式、coverage warning、失败恢复                                              |

## 常见问题

**收到 `_notice.update`？** 先完成当前搜索，再执行 `sifta-cli update`，然后重启 agent 或新开会话。

**Skill 没有出现？** 确认 `sifta-search/SKILL.md` 和其它 `sifta-*` 目录直接位于 agent 的 skills 目录下，然后重启 agent。
