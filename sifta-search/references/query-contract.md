# 查询合同

本文件定义 `sifta-search` 生成 `sifta-cli find-people` 参数时的合同。
不要把这些参数当成提示词文案；它们是连接器输入。

GitHub 和学术图谱可以先由宿主 Agent 使用原生搜索、MCP、`gh` 或网页搜索执行；当需要
Sifta CLI/API 的连接器、调用轨迹、反馈闭环或稳定 JSON 时，再使用本合同生成 CLI 参数。
无论是否调用 CLI，最终输出仍要遵守同一证据和本轮覆盖缺口质量门。

目录：

- [1. 参数职责](#1-参数职责)
- [1.1 默认地域合同](#11-默认地域合同)
- [2. GitHub 查询](#2-github-查询)
- [3. LinkedIn / 产品 / GTM 查询](#3-linkedin--产品--gtm-查询)
- [4. 研究找人来源查询](#4-研究找人来源查询)
- [5. X 查询](#5-x-查询)
- [6. 已知个人资料核验](#6-已知个人资料核验)
- [7. 失败恢复](#7-失败恢复)

## 1. 参数职责

| 参数           | 职责                              | 规则                                                                                                       |
| -------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `--query`      | 发给候选人连接器的渠道输入        | 按来源定制；短、可执行、适合该渠道                                                                         |
| `--checkpoint` | 用户本轮原始招聘目标              | 保留中文业务语境、岗位、地区、must-have、avoid、证据信号                                                   |
| `--sources`    | 用户授权或 Skill 选择的候选人渠道 | 必须写 JSON 字符串数组；当前只支持 `github`、`linkedin`、`x`；显式指定后，重试、回退、反馈闭环必须保持一致 |
| `--filter`     | 明确结构化条件                    | 只写确定的 title / skill / location / company / seniority                                                  |
| `--feedback`   | 人工审查后的下一轮约束            | 由 Agent 根据上一轮结果和用户反馈整理；不要把长反馈塞进 GitHub 查询                                        |
| `--trace`      | 排障用脱敏调用轨迹                | 日常用户输出不默认打开；仅在排查渠道输入或工具调用时使用                                                   |

## 1.1 默认地域合同

用户未指定候选人地区、远程、全球或海外市场时，默认
`geoBias=中国/中文生态相关人才池优先`。这不是族裔、国籍或姓名判断；只使用公开职业资料中的
中国大陆、港澳台、中文教育/工作/社区、中国市场或中国相关机构/公司信号。

| 参数 / 来源                     | 默认地域处理                                                                                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 本轮目标                        | 在“假设”写 `默认地域/市场：中国/中文生态相关人才池优先（不做族裔推断）`                                                                         |
| `--checkpoint`                  | 保留用户原始目标，并追加默认地域假设                                                                                                            |
| GitHub `--query`                | 保持英文技术关键词和工程角色词，不写默认地域叙述；GitHub `search/users` 可内部派生 `location:` 变体做召回偏置，repo search 不因默认地域被硬限制 |
| LinkedIn / 产品 / GTM `--query` | 在自然画像中加入“中国/中文生态/中国市场”中最贴合的表达                                                                                          |
| 学术找人来源 `--query`          | 把 China / Chinese-language / 中国机构 / 中文社区 / 中国市场作为找人来源种子之一                                                                |
| `--filter.locations`            | 只在用户把地区说成硬条件时使用；默认地域不自动变成全局硬过滤，但 GitHub people-first 可使用公开 `location:` 变体扩召回                          |

默认地域应影响来源优先级、候选人排序和下一步核验，但不得静默删除找人来源里的强全球证据。
如果人选地域未知或超出默认范围，输出时写入本轮覆盖缺口和 `nextVerification`。如果用户没有明确放宽
为全球人才池，缺公开中国/中文生态相关职业信号的人不能进入候选人或强推荐。
不要凭姓名、照片、外貌、口音、族裔或国籍猜测补这个信号。

## 2. GitHub 查询

GitHub 是工程和开源证据渠道。`--query` 使用英文技术关键词和工程角色词；`--checkpoint`
保留用户中文原始目标和默认地域假设。

如果宿主 Agent 使用原生 GitHub 搜索，也按同样规则构造搜索词：英文技术关键词 + 工程角色词，
不要用中文招聘叙述或 `site:` 网页搜索语法替代 GitHub 语义。默认地域需要分层处理：
people-first 可以用公开 `location:` 变体提高中国/中文生态召回；repo-first 保持技术词、
topic、description/readme 和贡献者路径，不把 repo 搜索硬限制为中国。

GitHub 传参分层：

| 内容                                                | 放哪里                                                                                    | 原因                                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `AI Agent MCP LLM infra engineer open source`       | `--query`                                                                                 | GitHub 能直接消费的技术 / 仓库 / 角色语义                                                                 |
| 用户原话、数量、默认地域/市场、必须条件、排除项     | `--checkpoint`                                                                            | 用于 skill 解释任务和输出核验，不污染 GitHub 搜索词                                                       |
| 用户明确硬地点，例如 `上海`、`中国`、`Remote China` | `--filter.locations` 或下一轮定向查询                                                     | 只有明确硬条件才结构化为全局 filter；people-first 的 `location:` 派生查询不等于全局硬过滤                 |
| 默认中国/中文生态相关人才池                         | 本轮目标、`--checkpoint`、people-first `location:` 派生查询、候选人升级门槛、本轮覆盖缺口 | `location:` 只看公开 profile 字段；不凭姓名、照片、外貌、口音、族裔或国籍推断；缺公开职业信号不进推荐名单 |
| 人工反馈或上一轮排除原因                            | `--feedback`                                                                              | 不拼进 GitHub 查询，避免 0 result 或错误召回                                                              |

GitHub helper 的数量语义：

- `--target-count` 是最终展示 / 推荐人数，不是每次 GitHub API 返回人数。
- `--pool-size`、`--user-search-per-query`、`--max-user-profiles` 控制 raw pool 和 hydrate 预算。
- 质量评估和 pilot 不能用 `target-count=1` 代表找人能力；应先形成足够大的 profile / repo 池，再按证据和地域门槛筛。
- people-first 看召回宽度，repo-first 看实现证据；两条线都要保留 trace 和本轮覆盖缺口。

推荐：

```bash
sifta-cli find-people \
  --query "AI Agent MCP LLM infra engineer open source" \
  --checkpoint "找 1 个有 AI Agent、MCP 或 LLM infra 的工程人选，优先 GitHub。默认地域/市场：中国/中文生态相关人才池优先；不做族裔或国籍推断。" \
  --sources '["github"]'
```

不要这样：

```bash
sifta-cli find-people \
  --query "找 1 个有 AI Agent、MCP 或 LLM infra 的工程人选，优先 GitHub。按人工反馈继续寻访..." \
  --checkpoint "找 1 个有 AI Agent、MCP 或 LLM infra 的工程人选，优先 GitHub。" \
  --sources '["github"]'
```

禁止：

- `候选人`、`找人`、`优先 GitHub`、`按人工反馈继续寻访` 这类招聘叙述词进入 GitHub 查询。
- `site:`、`GitHub developers in ...`、`clear evidence from GitHub` 这类网页搜索或来源解释词。
- 直接把 `feedback`、`constraints`、`exclusions` 拼进 GitHub 查询。
- 超过 GitHub 搜索限制；反馈闭环生成的 GitHub 查询必须控制 UTF-8 字节长度。
- 把来源写成裸字符串，例如 `--sources github` 或 `--sources linkedin`。必须写成
  `--sources '["github"]'` 或 `--sources '["linkedin"]'`。

反馈闭环：

- `--query` 只保留上一轮有效技术词和少量角色词。
- 完整人工反馈通过 `--feedback` 进入 `feedbackIngest`。
- 如果上一轮是仓库回退，下一轮不能把只有仓库 owner 的线索包装成强推荐；必须保留风险提示或转入找人来源。
- 默认地域未被用户放宽时，GitHub 结果必须核验公开中国/中文生态相关职业信号；没有该信号的人只能进入找人来源或待确认，不进推荐名单。
- 如果上一轮同时包含 GitHub 和 LinkedIn，按来源拆成多条下一轮请求；不要把同一个
  GitHub 英文查询同时发给 LinkedIn。

## 3. LinkedIn / 产品 / GTM 查询

LinkedIn 是职业资料和非工程职能证据渠道。`--query` 可以使用用户语言的自然人才画像，
必须保留中文岗位、地区、公司、职能和业务方向信号。

推荐：

```bash
sifta-cli find-people \
  --query "上海 AI Agent 产品经理，具备大模型应用、智能体平台或 Agent 产品规划经验" \
  --checkpoint "我们要找上海 AI Agent 产品经理，最好有大模型应用、智能体平台或字节相关背景。" \
  --sources '["linkedin"]'
```

GTM / 增长 / DevRel：

- 先用宿主 Agent 或找人来源建公司池 / 赛道池。
- `--query` 写职能 + 公司池 / 市场 / 地域信号；缺地区时加入“中国/中文生态/中国市场”中最贴合的表达。
- 不推断 relocation、签证、薪资、触达意愿。
- 主要证据是增长、市场、商业化、developer community、partnerships、DevRel 时，
  `functionCategory` 应是 `GTM/增长/DevRel`。

禁止：

- 把中文产品 / GTM 画像翻译成纯英文关键词后丢失语境。
- 只因为 query 中有 Agent / LLM / 大模型，就把非工程人选归到工程类。
- 在 LinkedIn 查询里加入 `site:linkedin.com/in` 或布尔网页搜索语法。

## 4. 研究找人来源查询

研究找人来源用于 WAM/VLA、论文型人才、技术合伙人、科学顾问、推荐人入口等复杂画像。

规则：

- 先建立 `sourceMap`：paper、lab、company、project、repo、dataset。默认可用宿主 Agent 原生
  学术 / 网页搜索；学术人才必须综合 OpenAlex、Google Scholar、Semantic Scholar、
  arXiv/OpenReview、Papers with Code、lab/project/homepage 中的多类来源，不要只用单一论文库；
  需要 Sifta 研究调用轨迹时再走 `--mode research`。
- `--mode research` 不是独立 OpenAlex、Scholar、Semantic Scholar、arXiv 或网页 connector；
  当前 Public API 仍只接受 `github`、`linkedin`、`x` 作为候选人 `sources`。学术来源栈由宿主
  Agent 建图，CLI 只组织 direct connector 输入、调用轨迹、结构化候选人和 warnings。
- 再从找人来源转入 GitHub / LinkedIn 候选人渠道。
- paper、lab、company、repo、dataset 不能直接进入 `people`。
- 强 PI、founder、产业标杆不自动等于全职候选人；根据项目进入顾问推荐人池、产业标杆池或本轮覆盖缺口。

学术图谱属于研究找人来源的特殊路径，用于寻找基础模型、数学、代码、训练效率、
多模态等方向的早期研究人才和高潜研究工程师。CLI 中的 `--query` 是找人来源种子，
不是最终候选人查询。

学术来源栈：

| 来源                      | 用法                                                                              | 边界                                                          |
| ------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| OpenAlex                  | works / authors / institutions / topics graph，扩展引用、共同作者、机构和研究方向 | 程序化找人来源来源；不能直接证明可招聘性                      |
| Google Scholar            | 广泛召回、漏召回补充、作者主页和引用入口                                          | 浏览器/人工入口或经批准第三方；不假设官方 API，不做未授权抓取 |
| Semantic Scholar          | paper / author search，citation/reference graph，related papers                   | 可与 OpenAlex 交叉验证；作者消歧仍要个人资料核验              |
| arXiv / OpenReview        | 最新预印本、会议投稿、评审场景、基础模型方向论文                                  | 论文作者只能先进入 `sourceMap`                                |
| Papers with Code / 项目页 | 任务、benchmark、dataset、official code、仓库链接                                 | 用于找实现者和项目线索；仓库 owner 仍需身份验证               |
| 实验室 / 个人主页         | 实验室成员、项目贡献者、个人身份、当前阶段                                        | 候选人转换关键证据；不等于求职意愿                            |

推荐：

```bash
sifta-cli find-people \
  --query "LLM reasoning math code training efficiency young researcher PhD intern OpenAlex Google Scholar Semantic Scholar arXiv OpenReview Papers with Code lab project coauthor competition China" \
  --checkpoint "帮一家基础模型团队找 1 个中国生态的高潜研究工程师或研究员。方向是 LLM 推理、数学、代码能力或训练效率。请先综合 OpenAlex、Google Scholar、Semantic Scholar、arXiv/OpenReview、Papers with Code、实验室、导师/共同作者、竞赛或项目页拆找人来源，再转成候选人搜索。Google Scholar 只作为浏览器/人工广泛召回，不假设官方 API；不要把论文作者直接当候选人；必须找到个人资料、GitHub、LinkedIn 或个人主页证据。" \
  --mode research \
  --target-count 1
```

禁止：

- 只搜某个公司名或把高潜研究画像写死成单一公司过滤。
- 论文作者、PI、导师、通讯作者直接进入 `people`。
- 学术图谱输出没有说明是否检查 OpenAlex、Google Scholar、Semantic Scholar 或同级广泛图谱 /
  广泛召回来源。
- 把“博士、竞赛、顶会论文”当成充分条件；还必须核验个人资料、公开实现或职业阶段。
- 因为候选人年轻就推断求职意愿、薪资、可入职时间或离职风险。

## 5. X 查询

X 只在用户明确要求公开表达、社区信号、公开帖子或指定 `--sources '["x"]'` 时使用。

禁止：

- 默认搜索或反馈闭环自动加入 X。
- 因为查询提到“社区”“传播”“影响力”就隐式调用 X。
- 用 X 结果替代 GitHub/LinkedIn 职业证据。

## 6. 已知个人资料核验

规则：

- 用户给出 GitHub / LinkedIn / X URL 或 handle 时，转候选人档案路径，由宿主 Agent 读取公开 profile 和可追溯材料。
- 只核验用户给出的个人资料或明确的姓名 + 公司 + 地点。
- 不猜 LinkedIn URL。
- 不把跨渠道个人资料默认合并为同一人；除非公开证据明确。

## 7. 失败恢复

| 现象                         | 归因                     | 修复                                                                                      |
| ---------------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| GitHub 422 / 查询过长        | GitHub 查询混入长反馈    | 缩短查询；完整反馈放 `--feedback`                                                         |
| GitHub 0 result              | 技术词太窄或混入招聘词   | 回到英文技术关键词 + 工程角色词；避免 `候选人`、`找人`                                    |
| LinkedIn 查询丢中文画像      | 过度翻译                 | 保留中文岗位、地区、公司、职能                                                            |
| 未授权调用 X                 | sources 约束丢失         | 保留显式 `--sources`；默认不调用 X                                                        |
| 学术来源写进 `--sources`     | 混淆找人来源和候选人渠道 | 从 `--sources` 移除；改由宿主 Agent 做找人来源，CLI 只保留 `--mode research` 或候选人渠道 |
| 网页/找人来源线索进入 people | 来源合同破坏             | 只进 `sourceMap` / `evidenceLog` / `warnings`                                             |
| 仓库回退被强推               | 质量门破坏               | 保留本轮覆盖缺口；缺个人资料交叉证据时只作为找人来源入口                                  |
| 辅助脚本返回可用线索         | 执行预算破坏             | 本轮停止；不要继续网页、`gh`、浏览器、LinkedIn 或第二次 CLI                               |
| 辅助脚本没有可用线索         | 召回不足                 | 报告本轮覆盖缺口；询问/建议下一轮，不静默换源                                             |
