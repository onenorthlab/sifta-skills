---
name: sifta-search
metadata:
    version: 0.0.5
    tags: [sifta-search, recruiting, sourcing, candidates]
description: >
    在 AI 行业垂直招聘场景使用 Sifta 做 candidate sourcing、candidate search
    和公开 profile enrichment。用户要寻找、筛选、补全或评估 AI 工程师/开发者、
    具身智能人才、超级个体/独立开发者、创始人、AI 产品经理、GTM/GMT/出海/AI 营销人才、
    研究型论文人才时使用。本 skill 不适用于这些画像之外的通用找人、公司情报、
    销售线索、触达、ATS、KOL 合作或普通网页研究。
---

# Sifta People Search

Sifta 是 AI 行业招聘 sourcing 增强层，不是通用网页搜索、公司情报、销售线索、触达、
ATS、KOL 合作或独立 agent runtime。

本 skill 面向 Codex、Hermes、Claude Code、OpenClaw、Cursor 等宿主 agent。宿主 agent
已经具备搜索、阅读、推理和本地上下文能力；Sifta 只补招聘 sourcing 中更专用、更需要
结构化约束的部分：候选人渠道、招聘语义、证据结构、项目适配和反馈闭环。

把本 skill 当作 router 使用：用户用自然语言描述招聘目标，本地 agent 判断是否进入
Sifta sourcing 路径，再选择工程岗、产品经理、GTM、research-map 或 known profile
补全工作流。Sifta CLI/API 是 command/connector 层，提供数据接入、schema、trace、认证和
版本更新。

## 1. 触发范围

只在用户目标是 AI 行业招聘 sourcing / enrichment / candidate review 时调用 Sifta：

- AI 工程师、开发者：AI Agent、LLM、视频大模型、语音模型、AI infra、应用层开发。
- 具身智能人才：机器人、自动驾驶、感知、控制、仿真、VLA、具身模型。
- 超级个体 / founder：独立开发者、一人公司、AI startup 创始人。
- AI 产品经理：大模型产品、Agent 产品、平台产品、Qwen/字节等团队相关 PM。
- GTM/GMT/出海/营销：增长、商业化、developer marketing、社区增长、AI 产品营销。
- 研究型人才：论文、实验室、arXiv/Google Scholar 证据，可转招聘候选人。

不要在这些场景调用 Sifta：

- 普通网页研究、公司情报、行业分析、竞品分析、融资新闻解释。
- 销售线索、KOL 合作、ATS 管理、排期、offer、触达自动化。
- 非 AI 行业画像，除非用户愿意改写成上述招聘画像之一。

## 2. 宿主 Agent 分工

不要把 Sifta 当作通用 web search。

- 行业背景、论文列表、公司新闻、竞品图谱、项目主页阅读：优先使用宿主 agent 原生搜索和阅读。
- 候选人召回、公开 profile 证据、GitHub/LinkedIn people search、结构化候选人输出：使用 Sifta CLI/API。
- 论文、公司页、实验室页、项目页、repo、dataset 和普通 web 来源只能进入 `sourceMap` /
  `evidenceLog` / `warnings`；除非进一步找到 GitHub、LinkedIn、X 或用户明确提供的个人
  profile，否则不能进入候选人列表。
- 本地 agent 可以用通用搜索补背景或二次证据，但最终候选人结论必须回到 Sifta 返回的
  people/profile 结果或用户明确给出的个人 profile。

## 3. 路由规则

| 用户目标                     | 默认路径                                          | 关键要求                                   |
| ---------------------------- | ------------------------------------------------- | ------------------------------------------ |
| AI 工程师 / 开发者 / infra   | `find-people --sources '["github"]'`              | GitHub-first，保留开源项目和工程证据       |
| 产品经理 / 平台产品 / AI PM  | `find-people --sources '["linkedin"]'`            | LinkedIn-first，产品证据归 `AI产品/平台`   |
| GTM / 增长 / 商业化 / DevRel | 先做 company map，再 LinkedIn people search       | 不推断 relocation、签证、薪资或触达意愿    |
| WAM / VLA / 研究型复杂画像   | 先 source map，再候选人搜索；必要时 research mode | 区分全职候选、顾问、推荐人、产业标杆       |
| 已知 GitHub / LinkedIn URL   | `enrich-people --people '[...]'`                  | 只补全公开 profile 证据，避免重名误合并    |
| 不清楚是否招聘               | 先问一个短问题                                    | 不把客户、创作者、公司或销售线索混成候选人 |

复杂项目顺序：

1. 先理解项目目标：岗位、职能、职级、地域、must-have、avoid。
2. 如需要，先用宿主 agent 建立 source map：paper、company、lab、project、repo、dataset。
3. 再调用 `sifta-cli find-people`；`--query` 必须符合来源合同，不写通用网页搜索语法。
4. `--checkpoint` 必须放用户本轮原始目标，不放改写后的 query。
5. 人工 review 后继续找时，优先使用 `pnpm sifta:review-feedback` 生成 `--feedback` JSON。
6. 解析 JSON 输出，优先读 `people`、`searchStrategy`、`sourceMap`、`evidenceLog`、`crmExport`
   和 `warnings`。

## 4. 命令选择

每个会话第一次调用前先运行：

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

## 5. Query 合同

- `--checkpoint` 必须保留用户本轮原始目标，尤其保留中文岗位、地区、avoid 和证据信号。
- `--query` 按来源选择语言，不是一刀切：
    - GitHub：使用英文技术关键词和角色词，例如 `AI Agent MCP LLM infra engineer open source`；
      不要塞 `候选人`、`找人`、`优先 GitHub` 这类招聘叙述词。
    - LinkedIn / GTM / 产品岗：使用用户语言的自然画像，保留中文岗位、方向、地区和公司信号。
- `--query` 不写 `site:`、`LinkedIn profile only`、逗号关键词堆叠或布尔网页搜索语法。
- GitHub 查询不要写 `GitHub developers in ...`、`clear evidence from GitHub` 这类来源解释词。
- 用户显式指定来源后，所有重试和替代命令必须保留相同 `--sources`。
- 能明确识别岗位、技能、地点、公司时才写入 `filter`；不确定时保留在 `query`。
- 不支持排除公司条件；排除项作为软约束写进 `query` 或人工核验。

详细来源输入合同见 [references/query-contract.md](references/query-contract.md)。

## 6. 质量门

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

## 7. 输出格式

最终回复必须是 Markdown，默认用紧凑表格，不输出原始 JSON。

固定包含：

- 目标：用户原始候选人目标。
- 来源：`executedSources`。
- 候选人表：姓名、画像/方向、来源链接、概况、匹配理由、风险。
- Coverage Warnings：API warnings、provider 失败、召回不足、证据弱、分类不确定。
- Next Action：下一轮继续扩展、人工 review 或停止条件。

不要编造邮箱、电话、薪资、是否愿意搬迁、在职状态或私人联系方式。除非返回 same-person hint
或有明确公开证据，不要断言跨渠道 profile 是同一人。

## 8. 参考

- CLI 命令与 JSON 参数：[references/cli-reference.md](references/cli-reference.md)
- Query / checkpoint / sources 合同：[references/query-contract.md](references/query-contract.md)
- 场景化工作流：[references/workflow-patterns.md](references/workflow-patterns.md)
- 输出、质量门和失败恢复：[references/output-quality.md](references/output-quality.md)
