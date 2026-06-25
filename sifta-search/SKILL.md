---
name: sifta-search
metadata:
    version: 0.0.6
    tags: [sifta-search, recruiting, sourcing, candidates]
description: >
    用于两类情况：AI/前沿科技招聘寻访，寻找候选人、人才、强人、创始人 / 运营型负责人 / GTM / DevRel / 研究人选；
    或任何找人/负责人请求夹带私人邮箱、手机号、自动发送、批量外联时做硬停止，不搜索。
    明确不找候选人/不做寻访的公司研究、市场研究、商业化模式、增长打法、JD、销售、合作/KOL、ATS 不要使用。
    用户通常只描述想找什么样的人、能解决什么问题、做过什么结果或经历信号，不会关心 GitHub、LinkedIn、论文或具体头衔；
    渠道选择是内部决策：按能力画像推断工程、产品 / GTM、研究、创始人 / 运营型负责人、候选人档案或触达文案，再决定宿主原生搜索或 Sifta CLI/API。
---

# Sifta 人才搜索

Sifta 是 AI 行业招聘寻访增强层，不是通用网页搜索、公司情报、销售线索、触达、ATS、KOL 合作或独立本地 Agent 运行环境。本技能面向 Codex、Hermes、Claude Code、OpenClaw、Cursor 等宿主 Agent；Sifta 只补候选人渠道、招聘语义、证据结构、项目适配和反馈闭环。先判断本轮是计划、执行还是硬停止：未明确要求执行时只交付计划、来源地图或硬停止判断；明确要求搜索、列候选人、跑一轮或执行时再调用必要工具。
把本技能当作分流入口使用：用户描述想找的人、要补的能力或候选人目标后，本地 Agent 判断是否进入 Sifta 寻访，再选择一个最匹配的场景技能。Sifta CLI/API 是可选命令/连接器层，不是通用搜索替代品。

## 1. 触发范围

只在用户目标是 AI 行业找人、候选人筛选、公开信息核验、候选人复盘或触达草稿时调用 Sifta。用户不必说明渠道、数据库、来源或准确头衔；他们往往只说“找一个能把 X 做起来的人”。先按能力画像理解，再内部决定来源地图：

- 搭系统 / 写核心代码 / 做开源作品证据：工程 / GitHub 优先。
- 把产品、增长、商业化、开发者生态或市场做起来：产品 / GTM / 职业资料优先。
- 做基础模型、训练效率、VLA/WAM、机器人、论文或实验室方向：研究 / 学术来源地图优先。
- 0 到 1、创始人型、早期员工、合伙型人才：创始人 / 运营型负责人，先判断主能力再分流。
- 已知候选人深挖：查公开经历、成就、职业联系方式、风险缺口和候选人档案。
- 候选人触达文案：基于已核验证据写私信、邮件、LinkedIn 消息、引荐介绍或跟进。

不要在这些场景调用 Sifta：

- 普通网页研究、公司情报、行业分析、竞品分析、融资新闻解释。
- 明确说不找候选人、不做寻访、只要公司研究简报、商业化模式 / 增长打法或岗位说明。
- 销售线索、KOL 合作、ATS 管理、排期、offer、触达自动化。
- 非 AI 行业画像，除非用户愿意改写成上述招聘画像之一。

非招聘销售 / BD / 合作线索请求，尤其要求私人邮箱、手机号或批量外联时，硬停止：不调用任何搜索工具，只问 `这是商务线索，不是招聘寻访；要改成招聘 BD/GTM 候选人简报吗？` 并说明不会继续搜索、输出业务线索列表或协助批量发送。

## 2. 宿主 Agent 分工

不要把 Sifta 当作通用网页搜索。

- 行业背景、论文列表、公司新闻、竞品图谱、项目主页阅读：计划类请求不搜索；执行类请求再按证据要求使用宿主 Agent 原生搜索和阅读。
- 执行模式下的 GitHub 工程证据：优先使用宿主 Agent 的 GitHub 搜索、GitHub MCP、`gh` 或浏览器；
  不要为了 GitHub token 单独改走 Sifta CLI/API。额度或认证不足时，引导用户在宿主环境配置
  `gh auth`、`GH_TOKEN` 或 `GITHUB_TOKEN`。只有需要 Sifta 统一 JSON、调用轨迹、反馈闭环、
  回归验证或用户明确要求 Sifta 连接器时，才使用 Sifta CLI/API。
- 执行模式下的学术来源地图：优先使用宿主 Agent 原生学术 / 网页搜索综合学术来源栈；Google Scholar
  只作浏览器/人工广泛召回，不假设官方 API；需要结构化研究轨迹时再走 CLI/API。
- 执行模式下的 LinkedIn 人才搜索、跨轮人工反馈和 CRM 风格输出：
  优先使用 Sifta CLI/API，因为这些是 Sifta 当前最明确的连接器和结构化价值。
- 已知候选人资料补证据由宿主 Agent 读取公开 profile、个人主页、GitHub、LinkedIn、X、
  学术来源和媒体材料后按 Sifta 质量门整理；不要调用服务端补证据 API。
- 论文、公司页、实验室页、项目页、代码仓库、数据集和普通网页来源只能进入 `sourceMap` /
  `evidenceLog` / `warnings`；除非进一步找到 GitHub、LinkedIn、X 或用户明确提供的个人
  资料，否则不能进入候选人列表。
- 本地 Agent 可以用通用搜索补背景或二次证据；最终候选人结论必须有个人资料证据，并按
  Sifta 的输出质量门解释来源、风险和覆盖风险。

## 3. 分流规则

| 用户画像 / 能力信号                       | 默认路径                                                                  | 关键要求                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 搭系统 / 开源 / 本地 Agent 工具链 / 基础设施 / SDK | GitHub 搜索；需要调用轨迹时用 `find-people --sources '["github"]'`        | GitHub 优先，不是只看 GitHub；保留开源项目和工程证据                |
| 产品、平台、用户问题、负责人信号          | 先给 LinkedIn 来源方案；明确执行时用 `find-people --sources '["linkedin"]'` | 不因 AI/Agent 词误转工程；产品证据归 `AI 产品/平台`                 |
| 增长、商业化、出海、开发者生态、开发者社区 | 先给问题/市场/相邻公司/能力信号地图；明确执行时再做候选人搜索             | 用户不知道头衔不阻塞；头衔地图只是内部扩展，不当主输出锚点          |
| WAM / VLA / 研究型复杂画像                | 先来源地图，再候选人搜索；必要时使用研究模式                              | 区分全职候选、顾问、推荐人、产业标杆                                |
| 学术图谱 / 高潜研究人才                   | 先输出学术来源地图方案；明确执行时再搜索                                  | 综合 OpenAlex/Scholar/Semantic Scholar 等；不把论文作者直接当候选人 |
| 已知 GitHub / LinkedIn URL                | 候选人档案 / 宿主公开 profile 核验                                        | 只使用公开个人资料证据，避免重名误合并                              |
| 已知候选人深挖                            | 候选人档案 / 资料补全                                                     | 只查公开信息；联系方式限公开职业渠道                                |
| 候选人触达文案                            | 触达文案                                                                  | 只生成草稿；不自动发送；不编造关系或承诺                            |
| 模糊招聘目标                              | 项目简报门槛；必要时读 `intent-routing.md`                                | 无法判断时硬停止，只问一个短问题；可推断时直接推进                  |
| 不清楚是否招聘                            | 先问一个短问题                                                            | 硬停止；不把客户、创作者、公司或销售线索混成候选人                  |

## 3.5 项目简报门槛

执行前先压缩成项目简报；可推断就写“假设”并推进，只有硬停止才问一个短问题。不要问用户“从什么渠道找”；来源是内部决策。硬停止包括：不清楚是否招聘、能力画像完全不可推断、深挖任务无可消歧个人资料、要求私人联系方式/自动发送，或用户明确要求马上执行付费连接器但未授权。详细字段、最小问题和“来源线索 -> 候选人”状态机见 [references/project-brief-and-state.md](references/project-brief-and-state.md)。

地域缺省不阻塞：用户没有指定候选人所在地区、远程、全球或海外市场时，项目简报写入
`默认地域/市场：中国/中文生态相关人才池优先`。不要把“华人”理解成族裔判断；执行时只看公开职业资料中的中国大陆、港澳台、中文教育/工作/社区、中国市场或中国相关机构/公司信号，不凭姓名、照片、外貌、口音或猜测判断。默认地域对 `sourceMap` 是召回偏置，对候选人分桶是升级门槛：缺少公开中国/中文生态相关信号的人可以保留为来源地图线索、产业标杆或待核验对象，但不能包装成候选人或强线索；用户明确放宽为全球人才池时除外。

## 4. 分流到场景技能

选择一个最匹配的场景技能；不要把所有技能和参考文件都读进上下文。

| 技能文件                                                                         | 何时读取                                                                   |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [../sifta-github-engineering/SKILL.md](../sifta-github-engineering/SKILL.md)     | AI 工程师、开源、Agent/LLM infra、MCP、GitHub 证据                         |
| [../sifta-linkedin-product-gtm/SKILL.md](../sifta-linkedin-product-gtm/SKILL.md) | 产品经理、GTM、增长、商业化、DevRel、公司地图                              |
| [../sifta-academic-graph/SKILL.md](../sifta-academic-graph/SKILL.md)             | 研究型、WAM/VLA、基础模型、论文、实验室、导师/共同作者、竞赛、年轻高潜人才 |
| [../sifta-candidate-dossier/SKILL.md](../sifta-candidate-dossier/SKILL.md)       | 已知候选人深挖、公开经历、成就、联系方式、身份核验、候选人档案             |
| [../sifta-outreach-copy/SKILL.md](../sifta-outreach-copy/SKILL.md)               | 私信、邮件、LinkedIn 消息、引荐介绍、跟进文案                              |
| [../sifta-review-feedback/SKILL.md](../sifta-review-feedback/SKILL.md)           | 用户对上一轮候选人给出反馈后继续找、分桶调整、多来源下一轮搜索             |

复杂项目顺序：

1. 先理解项目目标：要找的人能解决什么问题、能力画像、职级、地域、必要条件、排除项。
2. 模糊时按 `intent-routing.md` 判断：可推断就写“假设”；硬停止只问一个最小问题。
3. 如果本轮是计划请求，只规划来源地图，不调用网页搜索、浏览器、CLI 或实时验证；说明下一步候选人核验路径、证据获取路径与覆盖风险后停止。
4. 选择执行面：宿主原生搜索足够时按 Sifta 质量门交付；需要连接器、调用轨迹或反馈闭环时调用 CLI；小批量执行必须遵守执行预算和 `STOP_AFTER_HELPER` 停止条件。辅助脚本输出 `STOP_AFTER_HELPER=true` 后，本轮最终答复必须保留 `停止条件` 和 `覆盖风险`，不得用网页/浏览器/原生搜索替换候选人。
5. 调 CLI 时，`--query` 必须符合来源合同；`--checkpoint` 必须放用户本轮原始目标和默认地域假设。
6. 人工反馈后继续找时，把用户反馈整理成 `--feedback` JSON，再用 Sifta CLI 执行下一轮搜索。
7. 解析 JSON 时优先读 `people`、`searchStrategy`、`sourceMap`、`evidenceLog`、`crmExport` 和 `warnings`。
8. 最终输出必须包含适配证明：要求 -> 证据 -> 来源 -> 置信度 -> 风险 -> 下一步。

## 5. 命令选择

使用 Sifta CLI/API 时，每个会话第一次调用前先运行：

```bash
sifta-cli status
```

选择最小命令：

| 意图                              | 命令                                                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| 候选人搜索                        | `sifta-cli find-people --query "<query>" --checkpoint "<原始用户目标>" --target-count 10` |
| 明确头衔/技能/地点/公司           | `sifta-cli find-people --query "<query>" --checkpoint "<原始用户目标>" --filter '{...}'`  |
| 保存到 Web 历史                   | `sifta-cli find-people --query "<query>" --checkpoint "<原始用户目标>" --save`            |
| 新增或低频 API 字段               | `sifta-cli find-people --input '{"query":"...","checkpoint":"..."}'`                      |
| CLI/API schema（结构定义）变化或命令失败 | `sifta-cli tools`，再按当前 schema 重建命令                                               |

默认解析 JSON stdout。不要把 `--pretty` 用于 Agent 解析；它只适合人工查看。需要排查
渠道输入或工具调用时追加 `--trace`；日常搜索不要默认输出调用轨迹。详细命令见
[references/cli-reference.md](references/cli-reference.md)。

`find-people` 默认只返回本轮 JSON，不写 Web 历史。用户明确要求“保存、落库、同步到 Web、稍后在 Web 查看”，或 Agent 判断这轮结果已通过基本质量门、值得沉淀给用户复核时，追加 `--save`。保存成功后 JSON 会包含 `persisted.webPath`，最终回复应给出该 Web 回看路径。探索性宽召回、弱证据候选或尚未人工反馈的试探查询不要默认 `--save`。

为减少 CLI 后续变动，只有高频、稳定字段才优先用独立 flag。Public API 新增字段、临时实验字段或低频字段优先通过 `--input` JSON 传完整请求；显式命令行 flag 会覆盖 `--input` 中的同名字段。

不要静默打开浏览器，不要请求服务端供应商密钥。未认证时按 CLI 参考处理用户级 API key。

## 6. 查询合同

- `--checkpoint` 必须保留用户本轮原始目标，尤其保留中文岗位、地区、排除项和证据信号。
- 用户未指定地区时，项目简报和 `--checkpoint` 写入
  `默认地域/市场：中国/中文生态相关人才池优先（不做族裔推断）`；只在用户把中国/某城市/
  海外市场说成硬条件时才写严格 `filter.locations`。
- `--query` 按来源选择语言，不是一刀切：
    - GitHub：使用英文技术关键词和角色词，例如 `AI Agent MCP LLM infra engineer open source`；
      不要塞 `候选人`、`找人`、`优先 GitHub` 或默认地域叙述词。默认地域进入项目简报、候选人升级门槛和核验项。
    - LinkedIn / GTM / 产品岗：使用用户语言的自然画像，保留中文岗位、方向、地区和公司信号。
      缺地区时可把 `中国/中文生态相关人才池优先` 写入自然画像。
    - 学术图谱：先写学术来源地图种子和方向词，明确综合学术来源栈；Google Scholar 不作为官方 API 连接器假设。
      缺地区时把中国机构、中文社区、中国市场或 China / Chinese 作为来源地图种子之一，不自动转成 `filter.locations`。
- `--query` 不写 `site:`、`LinkedIn profile only`、逗号关键词堆叠或布尔网页搜索语法。
- GitHub 查询不要写 `GitHub developers in ...`、`clear evidence from GitHub` 这类来源解释词。
- 用户显式指定来源后，所有重试和替代命令必须保留相同 `--sources`。
- 展示 CLI 命令时，`--sources` 必须写 JSON 字符串数组，例如 `--sources '["github"]'`；不要写 `--sources github`、`--sources linkedin` 或 `sources=github`。
- 能明确识别岗位、技能、地点、公司时才写入 `filter`；不确定时保留在 `query`。
- 不支持排除公司条件；排除项作为软约束写进 `query` 或人工核验。
- 普通公司/市场研究不是候选人寻访。此类请求应明确走宿主 Agent 原生研究；如果用户要转招聘，
  再把公司地图改写成产品/GTM 招聘输入。

详细来源输入合同见 [references/query-contract.md](references/query-contract.md)。

## 7. 质量门

不能把弱结果包装成强推荐。

- `priority=C`、`evidenceStatus=缺职业工程证据`，或仓库回退缺少强
  仓库 / 个人资料交叉信号时，只能作为弱线索或来源地图入口。
- 仓库回退如果同时有明确个人资料、公司/经历信号和强开源项目证据，可以作为
  待复核候选进入候选池，但必须保留覆盖风险。
- 网页 / 论文 / 实验室 / 公司 / 仓库 / 数据集线索不能直接变成候选人；最终候选人来源必须是
  GitHub、LinkedIn、X 或用户明确给出的个人资料。
- 默认中国/中文生态相关人才池未被用户放宽时，缺少公开中国/中文生态相关职业信号的人不能进候选人或强线索分桶；不要凭姓名、照片或族裔猜测补这个信号。
- 非工程岗不因目标里有 Agent/LLM/大模型而归工程类；候选人主要证据是 PM/产品负责人/
  平台产品/应用产品时，归 `AI产品/平台`。
- GTM/增长/商业化/DevRel 主要证据归 `GTM/增长/DevRel`；不要因为公司是 AI 产品就归产品岗。
- 创始人 / 联合创始人 / C-level 是可用性和职级信号，不是自动分类规则。

详细结构字段、输出格式和失败恢复见 [references/output-quality.md](references/output-quality.md)。

## 8. 输出格式

最终回复必须是 Markdown，默认用紧凑表格，不输出原始 JSON。

固定包含：

- 项目简报：用户原始目标、默认地域 / 地域约束、假设、必要条件 / 排除项。
- 来源地图：已用来源和待补来源；每条线索至少包含 `lead`、`sourceFamily`、`whyRelevant`、
  `conversionBlocker`、`nextVerification`。
- 候选人分桶：全职候选、顾问/推荐人、产业标杆、待核验或排除项；待核验线索：论文 / 仓库 / 公司 / 实验室 / 项目线索，不能直接当候选人。
- 适配证明：要求、证据、来源、置信度、风险 / 弱项、下一步。
- 覆盖风险：API 警告 / warnings 字段、来源失败、召回不足、证据弱、分类不确定。
- 下一步：下一轮继续扩展、人工反馈或停止条件。

不要编造邮箱、电话、薪资、是否愿意搬迁、在职状态或私人联系方式。除非返回同人提示（same-person hint）
或有明确公开证据，不要断言跨渠道个人资料是同一人。

## 9. 参考

按需读取：`references/cli-reference.md`、`references/intent-routing.md`、`references/project-brief-and-state.md`、`references/source-map-recipes.md`、`references/query-contract.md`、`references/fit-proof-packet.md`、`references/workflow-patterns.md`、`references/output-quality.md`、`references/execution-budget.md`。

可套用模板：

- `templates/cli-command-plan.md`：判断是否调用 CLI，并整理命令计划。
- `templates/final-report.md`：整理最终候选人报告。
- `templates/review-feedback-loop.md`：把人工反馈转成下一轮请求。
