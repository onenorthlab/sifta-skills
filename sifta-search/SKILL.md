---
name: sifta-search
metadata:
    version: 0.0.6
    tags: [sifta-search, recruiting, sourcing, candidates]
description: >
    用于两类情况：AI/前沿科技招聘 sourcing 找 candidate/人才/强人/Founder/Operator/GTM/DevRel/研究人选；
    或任何找人/负责人/people lead 请求夹带私人邮箱、手机号、自动发送、批量外联时做 hard stop，不搜索。
    明确不找候选人/不做 sourcing 的公司研究、市场研究、商业化模式、增长打法、JD、销售、合作/KOL、ATS 不要使用。
    用户通常只描述想找什么样的人、能解决什么问题、做过什么结果或经历信号，不会关心 GitHub、LinkedIn、论文或具体头衔；
    渠道选择是内部决策：按能力画像推断 Engineering、Product/GTM、Research、Founder/Operator、Dossier 或 Outreach，再决定 native search 或 Sifta CLI/API。
---

# Sifta People Search

Sifta 是 AI 行业招聘 sourcing 增强层，不是通用网页搜索、公司情报、销售线索、触达、ATS、KOL 合作或独立 agent runtime。本 skill 面向 Codex、Hermes、Claude Code、OpenClaw、Cursor 等宿主 agent；Sifta 只补候选人渠道、招聘语义、证据结构、项目适配和反馈闭环。Plan-first 是默认终态：用户没明确说“现在搜索/列候选人/跑一轮/执行”时，本轮只交付 plan/source map/hard stop，不调用 web search、browser、CLI、`gh` 或 `curl`。
把本 skill 当作 router 使用：用户描述想找的人、要补的能力或候选人目标后，本地 agent 判断是否进入 Sifta sourcing，再选择一个最匹配的 route skill。Sifta CLI/API 是可选 command/connector 层，不是通用搜索替代品。

## 1. 触发范围

只在用户目标是 AI 行业找人、候选人筛选、公开信息补全、候选人复盘或触达草稿时调用 Sifta。用户不必说明渠道、数据库、source 或准确头衔；他们往往只说“找一个能把 X 做起来的人”。先按能力画像理解，再内部决定来源地图：

- 搭系统 / 写核心代码 / 做开源 proof-of-work：Engineering / GitHub-first。
- 把产品、增长、商业化、开发者生态或市场做起来：Product/GTM / career-profile-first。
- 做基础模型、训练效率、VLA/WAM、机器人、论文或实验室方向：Research / academic source-map-first。
- 0 到 1、founder-like、早期员工、合伙型人才：Founder/Operator，先判断主能力再路由。
- 已知候选人 deep-dive：查公开经历、成就、职业联系方式、风险缺口和 candidate dossier。
- 候选人触达文案：基于已核验证据写 DM、email、LinkedIn message、referral intro 或 follow-up。

不要在这些场景调用 Sifta：

- 普通网页研究、公司情报、行业分析、竞品分析、融资新闻解释。
- 明确说不找候选人、不做 sourcing、只要公司研究 brief、商业化模式/增长打法或 JD 文案。
- 销售线索、KOL 合作、ATS 管理、排期、offer、触达自动化。
- 非 AI 行业画像，除非用户愿意改写成上述招聘画像之一。
非招聘 sales/BD/partnership lead 请求，尤其要求私人邮箱、手机号或批量外联时，hard stop：不调用任何搜索工具，只问 `这是商务线索，不是招聘 sourcing；要改成招聘 BD/GTM 候选人 brief 吗？` 并说明不会继续搜索、输出业务 lead list 或协助批量发送。

## 2. 宿主 Agent 分工

不要把 Sifta 当作通用 web search。

- 执行模式下的行业背景、论文列表、公司新闻、竞品图谱、项目主页阅读：优先使用宿主 agent 原生搜索和阅读；plan-first 不搜索。
- 执行模式下的 GitHub 工程证据：优先使用宿主 agent 的 native GitHub search、GitHub MCP、`gh` 或浏览器；
  需要统一 JSON、trace、review loop 或用户明确要求 Sifta connector 时，再使用 Sifta CLI/API。
- 执行模式下的学术 source map：优先使用宿主 agent 原生学术 / web 搜索综合 academic source stack；Google Scholar
  只作浏览器/人工 broad recall，不假设官方 API；需要结构化 research trace 时再走 CLI/API。
- 执行模式下的 LinkedIn people search、已知 profile enrichment、跨轮 review feedback 和 CRM-style 输出：
  优先使用 Sifta CLI/API，因为这些是 Sifta 当前最明确的 connector / structure 价值。
- 论文、公司页、实验室页、项目页、repo、dataset 和普通 web 来源只能进入 `sourceMap` /
  `evidenceLog` / `warnings`；除非进一步找到 GitHub、LinkedIn、X 或用户明确提供的个人
  profile，否则不能进入候选人列表。
- 本地 agent 可以用通用搜索补背景或二次证据；最终候选人结论必须有个人 profile 证据，并按
  Sifta 的输出质量门解释来源、风险和 coverage warning。

## 3. 路由规则

| 用户画像 / 能力信号          | 默认路径                                          | 关键要求                                   |
| ---------------------------- | ------------------------------------------------- | ------------------------------------------ |
| 搭系统 / 开源 / runtime / infra / SDK | native GitHub search；需要 trace 时用 `find-people --sources '["github"]'` | GitHub-first，不是 GitHub-only；保留开源项目和工程证据 |
| 产品、平台、用户问题、PM-like ownership | 先给 LinkedIn source plan；明确执行时用 `find-people --sources '["linkedin"]'` | 不因 AI/Agent 词误转工程；产品证据归 `AI产品/平台` |
| 增长、商业化、出海、开发者生态、community | 先给问题/市场/相邻公司/能力信号 map；明确执行时再做 people search | 用户不知道头衔不阻塞；title map 只是内部扩展，不当主输出锚点 |
| WAM / VLA / 研究型复杂画像   | 先 source map，再候选人搜索；必要时 research mode | 区分全职候选、顾问、推荐人、产业标杆       |
| 学术图谱 / 高潜研究人才      | 先输出 academic source-map plan；明确执行时再搜索  | 综合 OpenAlex/Scholar/Semantic Scholar 等；不把论文作者直接当候选人 |
| 已知 GitHub / LinkedIn URL   | `enrich-people --people '[...]'`                  | 只补全公开 profile 证据，避免重名误合并    |
| 已知候选人 deep-dive         | candidate dossier / enrichment                    | 只查公开信息；联系方式限公开职业渠道       |
| 候选人触达文案               | outreach copy                                     | 只生成草稿；不自动发送；不编造关系或承诺   |
| 模糊招聘目标                 | Project Brief gate；必要时读 `intent-routing.md`  | 硬阻塞时 hard stop，只问一个短问题；可推断时直接推进 |
| 不清楚是否招聘               | 先问一个短问题                                    | hard stop；不把客户、创作者、公司或销售线索混成候选人 |

## 3.5 Project Brief gate

执行前先压缩成 Project Brief；可推断就写 Assumptions 推进，只有 hard stop 才问一个短问题。不要问用户“从什么渠道找”；source 是内部决策。Hard stop 包括：不清楚是否招聘、能力画像完全不可推断、deep-dive 无可消歧 profile、要求私人联系方式/自动发送，或用户明确要求马上执行付费 connector 但未授权。详细字段、最小问题和 source-map lead -> candidate 状态机见 [references/project-brief-and-state.md](references/project-brief-and-state.md)。

## 4. Route skills

像 router 一样选择一个最匹配 skill；不要把所有 skill 和 reference 都读进上下文。

| Skill | 何时读取 |
| --- | --- |
| [../sifta-github-engineering/SKILL.md](../sifta-github-engineering/SKILL.md) | AI 工程师、开源、Agent/LLM infra、MCP、GitHub 证据 |
| [../sifta-linkedin-product-gtm/SKILL.md](../sifta-linkedin-product-gtm/SKILL.md) | 产品经理、GTM、增长、商业化、DevRel、company-map |
| [../sifta-academic-graph/SKILL.md](../sifta-academic-graph/SKILL.md) | 研究型、WAM/VLA、基础模型、论文、实验室、导师/共同作者、竞赛、年轻高潜人才 |
| [../sifta-candidate-dossier/SKILL.md](../sifta-candidate-dossier/SKILL.md) | 已知候选人深挖、公开经历、成就、联系方式、身份核验、dossier |
| [../sifta-outreach-copy/SKILL.md](../sifta-outreach-copy/SKILL.md) | 私信、邮件、LinkedIn message、referral intro、follow-up 文案 |
| [../sifta-review-feedback/SKILL.md](../sifta-review-feedback/SKILL.md) | 用户对上一轮候选人给出反馈后继续找、分桶调整、mixed-source 下一轮搜索 |

复杂项目顺序：

1. 先理解项目目标：要找的人能解决什么问题、能力画像、职级、地域、must-have、avoid。
2. 模糊时按 `intent-routing.md` 判断：可推断就写 Assumptions；hard stop 只问一个最小问题。
3. 如需要，先规划 source map；但 plan-first 只规划，不调用 web search、browser、CLI 或 live validation，并必须说明下一步候选人验证路径、证据获取路径与 Coverage Warnings。Plan-first 输出后停止，不继续读命令 section 或执行搜索。
4. 选择执行面：native search 足够时按 Sifta 质量门交付；需要 connector/trace/review 时调用 CLI；小批量执行必须遵守 execution budget 和 `STOP_AFTER_HELPER` 停止条件。
5. 调 CLI 时，`--query` 必须符合来源合同；`--checkpoint` 必须放用户本轮原始目标。
6. 人工 review 后继续找时，优先使用 `pnpm sifta:review-feedback` 生成 `--feedback` JSON。
7. 解析 JSON 时优先读 `people`、`searchStrategy`、`sourceMap`、`evidenceLog`、`crmExport` 和 `warnings`。
8. 最终输出必须包含 Fit Proof Packet：requirement -> evidence -> source -> confidence -> weakness -> next action。

## 5. 命令选择

使用 Sifta CLI/API 时，每个会话第一次调用前先运行：

```bash
sifta-cli status
```

选择最小命令：

| 意图                              | 命令                                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| 候选人搜索                        | `sifta-cli find-people --query "<query>" --checkpoint "<原始用户目标>" --target-count 10` |
| 明确 title/skill/location/company | `sifta-cli find-people --query "<query>" --checkpoint "<原始用户目标>" --filter '{...}'`  |
| 已知 profile 或 handle 补全       | `sifta-cli enrich-people --people '[...]'`                                                |
| CLI/API schema 变化或命令失败     | `sifta-cli tools`，再按当前 schema 重建命令                                               |

默认解析 JSON stdout。不要把 `--pretty` 用于 agent 解析；它只适合人工查看。真实验证、eval
或渠道输入排查时追加 `--trace`；日常搜索不要默认输出 trace。详细命令见
[references/cli-reference.md](references/cli-reference.md)。

不要静默打开浏览器，不要请求服务端供应商密钥。未认证时按 CLI 参考处理用户级 API key。

## 6. Query 合同

- `--checkpoint` 必须保留用户本轮原始目标，尤其保留中文岗位、地区、avoid 和证据信号。
- `--query` 按来源选择语言，不是一刀切：
    - GitHub：使用英文技术关键词和角色词，例如 `AI Agent MCP LLM infra engineer open source`；
      不要塞 `候选人`、`找人`、`优先 GitHub` 这类招聘叙述词。
    - LinkedIn / GTM / 产品岗：使用用户语言的自然画像，保留中文岗位、方向、地区和公司信号。
    - Academic graph：先写学术 source-map 种子和方向词，明确综合 academic source stack；Google Scholar 不作为官方 API connector 假设。
- `--query` 不写 `site:`、`LinkedIn profile only`、逗号关键词堆叠或布尔网页搜索语法。
- GitHub 查询不要写 `GitHub developers in ...`、`clear evidence from GitHub` 这类来源解释词。
- 用户显式指定来源后，所有重试和替代命令必须保留相同 `--sources`。
- 展示 CLI 命令时，`--sources` 必须写 JSON 字符串数组，例如 `--sources '["github"]'`；不要写 `--sources github`、`--sources linkedin` 或 `sources=github`。
- 能明确识别岗位、技能、地点、公司时才写入 `filter`；不确定时保留在 `query`。
- 不支持排除公司条件；排除项作为软约束写进 `query` 或人工核验。
- 普通公司/市场研究不是 candidate sourcing。此类请求应明确走宿主 agent 原生研究；如果用户要转招聘，
  再把 company map 改写成产品/GTM recruiting input。

详细来源输入合同见 [references/query-contract.md](references/query-contract.md)。

## 7. 质量门

不能把弱结果包装成强推荐。

- `priority=C`、`evidenceStatus=缺职业工程证据`，或 repository fallback 缺少强
  repo/profile 交叉信号时，只能作为弱线索或 source-map 入口。
- repository fallback 如果同时有明确个人 profile、公司/经历信号和强开源项目证据，可以作为
  待复核候选进入候选池，但必须保留 coverage warning。
- web/paper/lab/company/repo/dataset 线索不能直接变成候选人；最终候选人来源必须是
  GitHub、LinkedIn、X 或用户明确给出的个人 profile。
- 非工程岗不因目标里有 Agent/LLM/大模型而归工程类；候选人主要证据是 PM/product lead/
  平台产品/应用产品时，归 `AI产品/平台`。
- GTM/增长/商业化/DevRel 主要证据归 `GTM/增长/DevRel`；不要因为公司是 AI 产品就归产品岗。
- Founder / co-founder / C-level 是可用性和职级信号，不是自动分类规则。

详细结构字段、输出格式和失败恢复见 [references/output-quality.md](references/output-quality.md)。

## 8. 输出格式

最终回复必须是 Markdown，默认用紧凑表格，不输出原始 JSON。

固定包含：

- Project Card：用户原始目标、Assumptions、must-have / avoid。
- Source Map：已用来源和待补来源；每条 lead 至少包含 `lead`、`sourceFamily`、`whyRelevant`、
  `conversionBlocker`、`nextVerification`。
- Candidate Buckets：全职候选、顾问/推荐人、产业标杆、待核验或排除项；Lead Queue：paper/repo/company/lab/project leads，不能直接当候选人。
- Fit Proof Packet：requirement、evidence、source、confidence、weakness、next action。
- Coverage Warnings：API warnings、provider 失败、召回不足、证据弱、分类不确定。
- Next Action：下一轮继续扩展、人工 review 或停止条件。

不要编造邮箱、电话、薪资、是否愿意搬迁、在职状态或私人联系方式。除非返回 same-person hint
或有明确公开证据，不要断言跨渠道 profile 是同一人。

## 9. 参考

按需读取：`references/cli-reference.md`、`references/intent-routing.md`、`references/project-brief-and-state.md`、`references/source-map-recipes.md`、`references/query-contract.md`、`references/fit-proof-packet.md`、`references/workflow-patterns.md`、`references/output-quality.md`、`references/execution-budget.md`。
评估集：`evals/evals.json`；Trigger gate：`scripts/evaluate-trigger-domain.mjs`。
