---
name: sifta-search
metadata:
    version: 0.0.3
    tags: [sifta-search, recruiting, sourcing, candidates]
description: >
    在 AI 行业垂直招聘场景使用 Sifta 做 candidate sourcing、candidate search
    和公开 profile enrichment。用户要寻找、筛选、补全或评估 AI 工程师/开发者、
    具身智能人才、超级个体/独立开发者、创始人、AI 产品经理、GTM/GMT/出海/AI 营销人才、
    研究型论文人才时使用。本 skill 不适用于这些画像之外的通用找人、公司情报、
    销售线索、触达、ATS、KOL 合作或普通网页研究。
---

# Sifta People Search

Sifta 是面向 AI 行业垂直招聘 sourcing 的候选人搜索工具。它不是通用网页搜索、
公司情报、销售线索、触达、ATS、KOL 合作或独立 agent runtime。

本 skill 面向 Codex、Hermes、Claude Code、OpenClaw 等宿主 agent。宿主 agent 通常已经
具备网页搜索、论文阅读、公司新闻检索、代码阅读和多步推理能力；这些通用能力不需要
由 Sifta 重复实现。Sifta 只补招聘 sourcing 中更专用、更需要结构化约束的部分：

- 候选人渠道：GitHub、LinkedIn 以及服务端支持的公开 profile / people search。
- 招聘语义：把用户随意描述转成项目内候选人判断。
- 证据结构：区分 academic、career、engineering、network 证据。
- 项目适配：判断候选人在本项目下是全职候选、负责人、顾问、推荐人、标杆还是暂缓。
- 反馈闭环：把用户反馈转成下一轮搜索约束。

使用 Sifta 的目标是：把招聘画像转成一份紧凑、可解释、有公开证据支撑的候选人
列表。工作流要保持收敛：搜索公开候选人来源，总结匹配理由，标注不确定性，不
编造私人信息。

## 目标画像

当前只覆盖 AI 行业候选人画像：

- AI 工程师、开发者：AI Agent、LLM、视频大模型、语音模型、AI infra、应用层开发。
- 具身智能人才：机器人、自动驾驶、感知、控制、仿真、VLA、具身模型相关工程师或岗位。
- 超级个体：独立开发者、一人公司、solo builder，有自建产品或可验证公开作品。
- 创始人：founder、co-founder、自己运营产品或 AI startup 的人。
- 产品经理：AI 产品经理、字节产品经理、Qwen 或大模型团队相关 PM。
- GTM/GMT 营销：出海营销、增长、AI 产品营销、developer marketing、社区增长。
- 研究型人才：专注学术、论文发表、arXiv/Google Scholar 证据，可转招聘候选人。

如果用户请求这些画像之外的人群，先说明当前 skill 只面向 AI 行业招聘 sourcing，并询问
是否要把需求改写成上述画像之一。

## 环境与认证

Sifta 当前使用 CLI 模式。

每个会话第一次调用 Sifta CLI 前，先运行 `sifta-cli status`。如果缺少
`sifta-cli`，先用 `npm install -g @sifta/cli@latest` 安装。如果未认证，或命令语法
不确定，阅读 [references/cli-reference.md](references/cli-reference.md)。CLI 可通过
`sifta-cli auth` 的本地配置或 `SIFTA_API_KEY` 调用服务端。

不要静默打开浏览器，也不要请求服务端供应商密钥。

## 命令选择

选择能完成目标的最小命令：

| 意图                                    | 优先命令                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| 候选人搜索                              | `sifta-cli find-people --query "<query>" --checkpoint "<原始用户目标>" --target-count 10` |
| 能明确拆出 title/skill/location/company | `sifta-cli find-people --query "<query>" --checkpoint "<原始用户目标>" --filter '{...}'`  |
| 已知 profile 或 handle 补全             | `sifta-cli enrich-people --people '[...]'`                                                |
| CLI/API schema 变化                     | `sifta-cli tools` 查看 schema，然后改用当前明确命令                                       |

默认解析 JSON stdout。不要把 `--pretty` 用于 agent 解析；它只适合人工查看。
真实验证、eval 或排查渠道输入时，可以追加 `--trace`，读取脱敏后的 `toolTrace`；
日常候选人搜索不要默认输出 trace。

## 宿主 agent 分工

不要把 Sifta 当作通用 web search。

- 行业背景、论文列表、公司新闻、竞品图谱、融资新闻、项目主页阅读：优先使用宿主 agent 自带搜索/浏览能力。
- 候选人召回、公开 profile 证据、GitHub/LinkedIn people search、结构化候选人输出：使用 Sifta CLI / API。
- 宿主 agent 通过通用搜索得到的论文、公司、实验室、项目、repo、dataset 可以作为 source map 输入，但不要直接把网页结果当候选人。
- 论文、公司页、实验室页、项目页、repo、dataset 和普通 web 来源只能进入 `sourceMap` / `evidenceLog` / `warnings`；除非进一步找到 GitHub、LinkedIn、X 或用户明确提供的个人 profile，否则不能进入候选人列表。
- 当用户只是在问行业信息、公司信息、论文解释或普通网页研究时，不要调用 Sifta；只有进入招聘候选人 sourcing / enrichment 时才调用。

复杂项目的推荐顺序：

1. 先理解项目目标：岗位、职能、职级、地域、must-have、avoid。
2. 如需要，先用宿主 agent 原生搜索建立 source map：paper、company、lab、project、repo、dataset。
3. 再调用 `sifta-cli find-people` 搜索候选人；`--query` 写面向候选人渠道的紧凑自然语言，不写通用网页搜索语法。
4. 把原始用户输入放入 `--checkpoint`，不要放改写后的 query。
5. 解析 JSON 输出，优先使用 `people`、`searchStrategy`、`sourceMap`、`evidenceLog`、`crmExport` 和 `warnings`。

## Project-aware sourcing

真实招聘不是一次关键词搜索。对于技术合伙人、Head of WAM、研究科学家、GTM/增长负责人等复杂画像，应形成项目上下文：

```json
{
	"project": "某具身智能公司 - WAM 技术合伙人",
	"target_roles": ["技术合伙人", "Head of WAM", "科学家顾问"],
	"geo_bias": "华人生态优先",
	"must_have": ["WAM/VLA/robot data/simulation 至少一项强证据"],
	"avoid": ["只会写论文但没有系统/工程/组织信号的人"]
}
```

候选人输出应回答“这个人在本项目下适合做什么”，而不只是“这个人是谁”。强人也可能只是顾问、推荐人或标杆，不一定进入全职候选池。

### Research-map assisted sourcing

WAM/VLA、具身智能、世界模型、机器人数据、仿真、研究科学家和科学顾问类需求，先建立来源地图再找人。

推荐路径：

- `paper-first`：从论文、project page、共同作者、通讯作者找线索。
- `company-first`：从具身智能、自动驾驶、机器人数据、仿真平台公司找负责人或工程化人才。
- `person-first`：从已知候选人的共同作者、前同事、学生、collaborator 扩展。
- `graph-neighbor`：从共同维护项目、共同出现在 benchmark/data paper 的人扩展。
- `advisor-entry`：PI、产业科学家、founder 可作为顾问或推荐人入口。

调用 Sifta 时，`--query` 应带上项目目标、强证据、地域偏好和已经发现的 source map 线索；`--mode research` 可以用于提示服务端这是研究型寻访，但论文/网页研究本身优先由宿主 agent 完成。

### Company-map assisted GTM/Growth sourcing

AI video、AI animation、AI avatar、creator tool、GTM、增长、商业化、partnerships、global operations 类需求，不要直接搜一句泛化 people query。先建立相似公司/赛道公司池，再从公司池转 LinkedIn/Sifta 查询。

推荐路径：

1. 用宿主 agent 搜索或用户给出的信息建立公司池，例如 AI video、AI animation、AI avatar、creator tool、海外竞品、相邻公司。
2. 生成候选人 query：角色 + 公司相似度 + 市场/地域信号 + seniority。
3. 使用 LinkedIn/Sifta 找人。
4. 输出时区分商业化角色匹配、公司相似度、地域/市场信号、资历和证据风险。

不要推断 relocation、签证、薪资或触达意愿；这些只能写成待确认风险。

## 更新检查

Sifta CLI 的 JSON 输出可能包含 `_notice.update`，例如：

```json
{ "_notice": { "update": { "cli": "0.0.3" } } }
```

这里的版本号表示需要更新的远端最新版本；只出现有更新的组件。当你在任意命令结果中看到 `_notice.update` 时，
不要影响当前候选人结果解析；先完成用户当前 sourcing 请求，再告知用户有新版本，
并提议执行：

```bash
sifta-cli update
```

如果用户同意，执行 `sifta-cli update`。更新完成后提醒用户：重启 agent 或新开会话，
以加载最新的 `sifta-search` skill。

普通业务命令只读取本地版本缓存；`sifta-cli update --check --json` 才会主动联网刷新缓存。

## 来源策略

根据需要的招聘证据选择来源：

- 默认来源是 GitHub 和 LinkedIn。
- AI 工程师、研发、开发者和偏工程落地的人才，必须显式使用 `--sources '["github"]'`；
  “研发岗”“开发工程师”“模型/infra/应用层工程师”等中文表述也按代码型候选人处理。
  除非用户明确指定使用 LinkedIn 搜索，否则不要加入 LinkedIn 做职业背景核验。
- 具身智能、独立开发者和 founder 如果强调代码、产品或公开作品，优先使用
  `--sources '["github"]'`；如果更强调实验室、公司经历或团队背景，再使用 LinkedIn。
- 产品经理、GTM/GMT 营销和公司/团队背景强相关画像，优先使用 `--sources '["linkedin"]'`。
- 用户显式指定来源后，所有重试、失败恢复和替代命令都必须保留相同 `--sources`；
  不要退回默认来源，否则会混入 GitHub。
- LinkedIn 由服务端通过 Exa People Search 执行，底层请求必须使用 `category: "people"`；
  query 应写成角色、地点、公司、领域词组成的自然语言语义查询，而不是追加
  `LinkedIn profile only` 这类网页搜索限定词。
- 只有当论文证据有助于识别候选人时才使用 `--mode research`。arXiv 和
  Google Scholar 是辅助证据，不是最终候选人主来源。
- Twitter/X 和小红书属于可选公开信号来源。只有用户提供已知 handle、要求公开内容
  信号，或 Sifta API 明确暴露这些来源时才使用；不要把 KOL 合作当作本 skill 的主路径。
- 宿主 agent 的通用搜索结果可以作为 source map 或背景材料，但最终候选人必须来自 Sifta
  返回的 people/profile 结果或用户明确提供的候选人线索。

如果用户请求的来源没有被支持或 API 结果显示未执行该来源，要明确说明。

## 查询计划边界

Skill / agent 负责把用户原始 query 转成搜索计划：

- 始终把用户本轮原始输入原样放入 `--checkpoint`；`--query` 只放面向 connector 的紧凑搜索词。
- `--checkpoint` 不要写复述、翻译、总结或筛选后的搜索词；它必须能还原用户实际说的话。
- 中文用户输入下，`--query` 应使用中文自然语言，保留中文岗位、方向、地区和证据信号。不要先发纯英文关键词串，也不要把上海翻译成 `Shanghai`、把产品经理/增长/商业化翻译成 `product manager` / `growth` / `commercial`；WAM/VLA/LLM/AI Agent/GTM/DevRel 这类专有缩写可以保留。
- `--query` 不要写 `site:`、`LinkedIn profile only`、逗号关键词堆叠或通用网页搜索语法。
- 多轮对话中，`--checkpoint` 使用触发本次搜索的用户原文；如果需要保留上下文，把必要上下文并入
  `--query` 或 `filter`，不要覆盖原始输入。
- GitHub 查询不要写 `GitHub developers in ...`、`clear evidence from GitHub` 这类来源/解释词。
- 能明确识别岗位时，写入 `filter.titles`。
- 能明确识别技能或主题时，写入 `filter.skills`。
- 能明确识别地点时，写入 `filter.locations`。
- 能明确识别公司偏好时，写入 `filter.companies`。
- Founder、超级个体、GTM/GMT 和研究型画像常常不是标准 title；把产品、增长、论文、
  自建项目、团队背景等证据要求保留在 `query` 中，不要强塞进 filter。
- 不支持排除公司条件；如果用户提出排除公司，把它保留在 `query` 里作为软约束，并在结果解释时人工核验。

不要把不确定的推断强塞进 filter。不确定时保留在 `query` 或先追问。

## 歧义处理

当请求可能指向不同目标，且错误搜索会浪费时间或 API 配额时，先问一个简短问题。

常见歧义：

- 公司、产品或项目名称有多个含义。
- 用户把招聘候选人、创作者、客户、公司或销售线索混在一起。
- 用户描述的人群不属于当前 7 类 AI 行业画像。
- 地点、资历或必要证据缺失，且会明显影响搜索方向。
- 用户说“懂 X 的人”，但不清楚证明依据应是公开代码、职业经历、论文还是社交内容。

如果上下文已经足够明确，可以直接说明假设并继续，例如：
“我按招聘候选人理解，优先找 GitHub/LinkedIn 上有 AI infra 公开证据的人。”

## 工作流

1. 用一句话复述候选人目标。
2. 先归类到 7 类 AI 行业画像之一，再根据目标证据选择来源和 mode。
3. 如果是研究型或公司图谱型需求，先用宿主 agent 原生搜索建立 source map；不要把通用网页搜索外包给 Sifta。
4. 运行最小可用 CLI 命令，不传 `--pretty`。
5. 解析 JSON stdout，把 stderr 视为状态或调试信息。
6. 输出紧凑候选人列表，包含 profile 链接、匹配理由、证据、风险提示和下一步动作。
7. 区分证据和推断，标注过期、缺失或较弱的证据。
8. 如果结果较弱，说明原因，并给出一个更窄的后续查询建议。

遇到复杂场景、无结果或弱结果恢复时，再参考
[references/workflow-patterns.md](references/workflow-patterns.md)。

## 结构字段口径

结构化字段要跟候选人的主要公开证据一致，不要被目标公司、技术名词或单个头衔关键词带偏。先判断这名候选人为什么被召回，再写 `functionCategory`、`careerStage` 和人才池：

- 工程证据：代码、模型、infra、SDK、系统实现、开源贡献是主要证据时，归入对应工程类，例如 `Agent/LLM工程`、`WAM/VLA模型`、`数据仿真评测`、`机器人控制落地` 或 `视频世界模型`。
- 产品证据：产品规划、产品运营、roadmap、PM、product lead、AI product、平台产品或应用产品是主要证据时，归入 `AI产品/平台`。不要只因为产品涉及 Agent、LLM、大模型或机器人，就归到工程类。
- GTM 证据：增长、市场、商业化、开发者社区、partnerships、DevRel 或出海是主要证据时，归入 `GTM/增长/DevRel`。不要只因为公司是 AI 产品公司，就归为产品岗。
- 战略证据：战略规划、商业分析、投资、经营分析、CEO Office 或 corporate development 是主要证据时，归入 `战略/CEO Office/商业分析`。
- 研究和顾问证据：论文、实验室、PI、产业科学家、推荐人入口或资源网络是主要证据时，按 `科学顾问资源网络` 或具体研究方向归类，并用 `顾问推荐人池` / `产业标杆池` / `观察池` 表达招聘可用性。
- Founder / co-founder / C-level 是可用性和职级信号，不是自动分类规则。只有用户明确找创始人/高管，或主要匹配证据就是创业/高管身份时，才使用 `产业高管创业者`；否则根据实际职能证据归类，并在 `whyNot` / `risks` 说明全职可用性不确定。

提交结构字段前，必须对照证据包做一致性检查：如果工程证据为空，且主要公开证据在职业经历中体现为产品规划、产品运营、roadmap、PM、product lead、平台产品或应用产品，则不能填工程类，应填 `AI产品/平台`。不要把用户目标里的 `Agent`、`LLM`、`大模型`、`智能体`、`机器人` 等技术方向词当作候选人的工程职能证据。

## 输出规则

向用户汇报结果时：

- 最终回答本身必须是 Markdown 文本，不是纯文本字段块，也不是 JSON。
- 不要依赖识别当前运行环境；无论在 CLI、OpenClaw、飞书或其他聊天工具中，默认都按
  Markdown 输出。
- 包含候选人姓名、来源、profile URL、headline/location（如有）、匹配理由和关键
  证据。
- 列表型候选人结果默认使用 Markdown 表格，避免逐条长段落堆叠。
- 标注候选人更接近哪类目标画像，例如 `AI 工程师`、`具身智能`、`超级个体`、`Founder`、
  `AI PM`、`GTM/GMT` 或 `研究型人才`。
- 必要时按置信度分组：强匹配、可能匹配、弱匹配。
- 传达 API 返回的 warnings。
- 如果 API 返回 `searchStrategy`、`sourceMap`、`evidenceLog` 或 `crmExport`，优先用这些结构化字段解释搜索路径和证据，不要只看 `summaryMarkdown`。
- 不要编造邮箱、电话、薪资、是否愿意搬迁、在职状态或私人联系方式。
- 除非 Sifta 返回 same-person hint，或有明确公开证据，否则不要断言跨渠道 profile
  是同一个人；不确定时写成“可能匹配”。
- 除非用户要求原始 JSON 或全部结果，否则保持候选人列表紧凑。

按以下结构输出：

```
目标：<原始候选人目标>
来源：<executedSources>

| #   | 候选人 | 画像 / 方向 | 来源                 | 概况                | 匹配理由                  | 风险                       |
| --- | ------ | ----------- | -------------------- | ------------------- | ------------------------- | -------------------------- |
| 1   | <name> | <persona>   | [GitHub](profileUrl) | <headline/location> | <evidence-backed reasons> | <missing or weak evidence> |
```

格式要求：

- 每行一个候选人。
- 来源列使用 `[GitHub](url)`、`[LinkedIn](url)` 或 `[Profile](url)` 形式，不输出裸 URL。
- 单元格内容保持短句；“匹配理由”优先控制在 30-50 字以内。
- 不要把长段解释塞进表格；确实需要时，在表格后增加“补充说明”。
- 不要用代码块包裹最终结果。
- 不要使用 `候选人：`、`画像：`、`来源：`、`概况：`、`匹配理由：`、`风险：` 这种逐条字段块格式。

**注意：** 在任何聊天渠道（包括飞书）中，最终都必须优先输出为 Markdown 表格；即使渠道渲染不完整，也不要改用字段块格式。

## 失败恢复

如果命令因为参数变化失败：

1. 运行 `sifta-cli tools`。
2. 找到相关工具：`find_people` 或 `enrich_people`。
3. 根据返回的 schema 重建参数。
4. 使用 `find-people` 或 `enrich-people` 这些明确 CLI 命令重试。

如果搜索没有返回候选人，不要断言不存在这类候选人。应说明“这次搜索没有返回候选人”，
并提出具体调整：放宽 title、去掉地点、切换来源、补充公司/domain 线索，或在论文证据
相关时使用 `--mode research`。

如果结果质量弱，先判断是哪一层的问题：

- 宿主搜索/source map 不足：补论文、公司池、实验室或相邻公司线索。
- CLI/API 输入不合格：重写 `--query`、`--filter`、`--sources`，保留原始 `--checkpoint`。
- API/provider 覆盖不足：向用户说明来源限制，不要编造候选人。
- 候选人项目适配弱：降低优先级，放入顾问推荐人池、观察池或 warnings，并写清 `why_not`。

## 详细参考

- CLI 命令与 JSON 参数：
  [references/cli-reference.md](references/cli-reference.md)
- 场景化工作流：
  [references/workflow-patterns.md](references/workflow-patterns.md)
