# 输出、质量门和失败恢复

本文件给 `sifta-search` 主 skill 提供详细执行口径。主 skill 只负责 router 和高优先级规则；
这里记录结构字段、输出格式和失败恢复细节。

## 0. Lead -> Candidate 状态机

| 状态 | 说明 | 升级门槛 |
| --- | --- | --- |
| `sourceMapLead` | paper、repo、company、lab、project、dataset、coauthor 等入口线索 | 找到个人 profile、GitHub、LinkedIn、个人主页、lab bio 或用户明确 profile |
| `profileLead` | 已有个人 profile，但 fit 或身份交叉证据不足 | identity 至少 medium，并有与 requirement 相关的公开证据 |
| `candidate` | 可进入候选表的人 | evidence graded，bucket 明确，Fit Proof Packet 完整 |
| `rejected` | 身份冲突、隐私、非公开数据、无关或证据不可追溯 | 写明拒绝/排除原因，不为凑数保留 |

paper/repo/company/lab leads 不能直接变候选人。弱结果优先回到 source map / profile
verification，不要临时补一个看似更强的人填候选人列表。

## 1. 结构字段口径

结构化字段要跟候选人的主要公开证据一致，不要被用户目标里的技术词或单个头衔关键词带偏。
先判断这名候选人为什么被召回，再写 `functionCategory`、`careerStage` 和人才池。

| 主要证据                         | `functionCategory` 示例         | 注意事项                                                     |
| -------------------------------- | ------------------------------- | ------------------------------------------------------------ |
| 代码、模型、infra、SDK、开源贡献 | `Agent/LLM工程`、`WAM/VLA模型`  | 只有公开证据证明主要做工程实现时才归工程类                   |
| 产品规划、PM、roadmap、平台产品  | `AI产品/平台`                   | 不要只因为产品涉及 Agent/LLM/大模型就归工程类                |
| 增长、市场、商业化、DevRel       | `GTM/增长/DevRel`               | 不要只因为所在公司是 AI 产品公司就归产品岗                   |
| 战略规划、商业分析、投资         | `战略/CEO Office/商业分析`      | 需要职业 profile 或公开经历支撑                              |
| 论文、实验室、PI、产业科学家     | `科学顾问资源网络` 或具体研究类 | 强学术人物可能是顾问、推荐人、产业标杆，不一定进入全职候选池 |
| 年轻高潜、博士后期/实习、竞赛和论文信号 | `基础模型研究/研究工程` 或具体研究类 | 必须同时核验个人 profile、贡献强度和公开实现或职业阶段       |
| founder / co-founder / C-level   | 由主要职能决定                  | 创业/高管身份是可用性和职级信号，不是自动分类规则            |

提交结构字段前做一致性检查：

- 工程证据为空，且主要公开证据是产品规划、PM、product lead、平台产品或应用产品时，应填
  `AI产品/平台`。
- 主要证据是增长、市场、商业化、开发者社区、partnerships、DevRel 或出海时，应填
  `GTM/增长/DevRel`。
- 只有论文作者但缺少职业/profile 线索时，说明是研究线索或顾问入口，不包装成完整全职候选人。
- Academic graph 学术通道下，年轻、博士、顶会论文或竞赛奖项都只是入口信号；没有个人
  profile、公开实现、项目贡献或职业阶段证据时，只能进入 source map 或待核验线索。
- Academic graph 学术通道下，如果方案没有说明 OpenAlex、Google Scholar、Semantic Scholar
  或同级 broad graph / broad recall 来源是否已检查，必须写 Coverage Warning；Google Scholar
  不应被写成官方 API connector。

## 2. 候选人输出格式

最终回答本身必须是 Markdown，不是 JSON 或纯文本字段块。

推荐结构：

```markdown
Project Card：
- 目标：<原始候选人目标>
- Assumptions：<缺失信息和保守假设>

Source Map：
- executedSources：<executedSources>
- searched：<GitHub / LinkedIn / OpenAlex / Scholar / company map ...>
- pending：<仍需补充的来源>

Candidate Buckets：
| # | 候选人/Lead | State | Bucket | 来源 | 概况 | Evidence grade | Weakness | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | <name> | candidate / sourceMapLead | 全职候选 / 顾问推荐人 / 产业标杆 / 待核验 | [GitHub](profileUrl) | <headline/location> | A/B/C | <missing evidence> | <action> |

Fit Proof Packet：
| Candidate/Lead | State | Requirement | Evidence | Source | Confidence | Weakness | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| <name> | candidate | <must-have> | <public evidence> | <url/source> | identity=high, fit=medium, evidence=A | <gap> | <action> |

Coverage Warnings：

- <warning>

Next Action：

- <next action>
```

格式要求：

- 每行一个候选人。
- 来源列使用 `[GitHub](url)`、`[LinkedIn](url)` 或 `[Profile](url)`，不输出裸 URL。
- 单元格内容保持短句；“匹配理由”优先控制在 30-50 字以内。
- 不把长段解释塞进表格；确实需要时，在表格后增加“补充说明”。
- 不使用 `候选人：`、`画像：`、`来源：` 这种逐条字段块格式。
- 在飞书、OpenClaw、CLI、Codex 等渠道中都优先输出 Markdown 表格。
- 每个候选人必须有 Fit Proof Packet；没有 evidence/source/confidence/weakness 时不算完整交付。

## 3. Fit Proof Packet

候选人 proof-of-fit 采用 `requirement -> evidence -> source -> confidence -> weakness -> next action`。
详细标准见 [fit-proof-packet.md](fit-proof-packet.md)。

证据等级：

| 等级 | 说明 | 输出口径 |
| --- | --- | --- |
| A | 个人 profile 与目标证据直接匹配，来源可追溯 | 可进入候选表 |
| B | 强 source-map 或单一 profile 证据，缺交叉验证 | 待复核候选，必须 warning |
| C | repo owner、论文作者、公司/实验室成员或关键词命中 | source-map lead 或待核验线索 |
| Reject | 身份冲突、非公开信息、无关或不可追溯 | 不进候选表 |

## 4. 结果解释

优先使用这些结构解释结果：

- `people`
- `searchStrategy`
- `sourceMap`
- `evidenceLog`
- `crmExport`
- `warnings`

不要只看 `summaryMarkdown`。不要编造 JSON 中不存在的字段。不要编造邮箱、电话、薪资、
搬迁意愿、在职状态或私人联系方式。

除非 Sifta 返回 same-person hint，或有明确公开证据，否则不要断言跨渠道 profile 是同一个人；
不确定时写成“可能匹配”。

## 5. Coverage Warnings

必须向用户传达 API 返回的 warnings，尤其是：

- provider/network 失败。
- 指定来源没有执行或没有返回候选人。
- `priority=C` 或 `evidenceStatus=缺职业工程证据`。
- repository fallback returned repo-owner leads。
- source-map lead 被降级，或缺少 profile verification。
- Project Brief 缺失但用 Assumptions 推进。
- 候选人分类不确定。
- 证据只来自单一 profile，缺少交叉验证。

repository fallback 的口径：

- 如果只有 repo 命中，缺少个人 profile、公司/经历或身份信号，只能作为 source-map 入口。
- 如果有明确个人 profile、公司/经历信号和强开源项目证据，可以作为待复核候选进入候选池。
- 即使进入候选池，也必须保留 coverage warning，提示人工验证 repo owner 是否为候选人本人。

academic graph fallback 的口径：

- paper / lab / advisor / coauthor / competition / project 只能解释从哪里继续找人。
- 一作、共一作、竞赛奖项或博士阶段可以提高优先级，但不能替代身份、职业阶段和工程/研究贡献核验。
- PI、导师、通讯作者或头部科学家优先进入顾问/推荐人/产业标杆池；除非用户明确找顾问或科学家全职，并且有 profile 证据支持。
- 如果只找到论文和机构，不输出完整候选人表；应输出 Source Map、待核验线索和下一步 profile/enrichment 动作。

## 6. 失败恢复

命令参数或 schema 变化：

1. 运行 `sifta-cli tools`。
2. 找到 `find_people` 或 `enrich_people` schema。
3. 根据当前 schema 重建命令。
4. 使用明确 CLI 命令重试。

无候选：

- 不要断言不存在这类候选人。
- 说明“这次搜索没有返回候选人”。
- 给出具体调整：放宽 title、去掉地点、切换来源、补充公司/domain 线索，或在论文证据相关时使用 `--mode research`。

弱结果：

- 说明是“弱线索 / 待复核”，不能作为完成交付。
- 优先在同一来源下重写 `--query`、扩大 `--target-count`、补充明确公司或项目线索，或放入 source map。
- 可以使用宿主 agent native search 补证据或扩展 source map，但不能绕过 Sifta 质量门，临时找一个
  看似更强的人填候选人列表。

质量问题归因：

| 现象                                    | 优先归因                 | 修复方向                                               |
| --------------------------------------- | ------------------------ | ------------------------------------------------------ |
| 渠道输入不符合 source-specific contract | Skill / query contract   | GitHub 改英文技术 query；LinkedIn/GTM 保留用户语言画像 |
| 未授权调用 X                            | Sources / API visibility | 保留用户来源约束，检查 Public API source 选择          |
| web/paper 线索进入候选人                | Source contract          | 修 Public API 或结果过滤                               |
| provider `fetch failed`                 | Provider/network         | 写 warnings，不硬编码兜底候选人                        |
| 候选人质量弱但输入正确                  | 覆盖不足 / query pattern | 调 query、补 source map、人工 review                   |
| schema 字段缺失                         | API contract             | 修 structured candidates / CRM export                  |

## 7. 更新检查

Sifta CLI 的 JSON 输出可能包含 `_notice.update`：

```json
{ "_notice": { "update": { "cli": "0.0.3" } } }
```

不要影响当前候选人结果解析；先完成用户当前 sourcing 请求，再告知用户有新版本，并提议：

```bash
sifta-cli update
```

更新后提醒用户重启 agent 或新开会话，以加载最新 Sifta skill suite。
