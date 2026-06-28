# 找人来源方案

本文件定义不同人才方向的找人来源。找人来源用于指导本地 Agent 先去哪里找证据、哪些线索能转成候选人、什么时候使用 Sifta CLI。

目录：

- [1. 总原则](#1-总原则)
- [1.5 为什么从这里找](#15-为什么从这里找可直接讲给用户的白话)
- [2. 岗位找人来源](#2-岗位找人来源)
- [3. 工程方案](#3-工程方案)
- [4. 产品 / GTM / DevRel 方案](#4-产品--gtm--devrel-方案)
- [5. 学术图谱方案](#5-学术图谱方案)
- [6. 候选人档案方案](#6-候选人档案方案)
- [7. 触达方案](#7-触达方案)
- [8. 延伸参考](#8-延伸参考)

## 1. 总原则

- GitHub 优先、LinkedIn 优先、学术优先是主证据渠道，不是唯一渠道。
- 找人来源用来发现入口；候选人必须再经过个人资料验证。
- 找人来源不是候选人池。paper、repo、company、lab、project、dataset 等都先是 `待确认线索`。
- 召回与判级分离：先扩大 raw pool，再按证据分 strong / soft / lead / reject；不要因为 strong 稀缺就返回空，也不要为了非空把 lead 包装成候选。
- 本地 Agent 原生搜索、GitHub MCP、`gh`、浏览器和学术搜索可优先使用。
- CLI 只在需要 Sifta-owned 连接器、结构化候选人返回、调用轨迹、反馈闭环、回归验证或稳定 JSON 时使用。GitHub 不因为 token/auth 成为 CLI 必经路径；优先使用宿主 `gh`、GitHub MCP 或用户自己的 `GH_TOKEN` / `GITHUB_TOKEN`。

升级条件：`待确认线索 -> identity checked -> evidence graded -> candidate bucketed`。每条线索
至少写 `lead`、`sourceFamily`、`whyRelevant`、`conversionBlocker`、`nextVerification`。

## 1.5 为什么从这里找（可直接讲给用户的白话）

用户常不懂为什么去 GitHub 还是领英。需要解释时用这一句，不要抛渠道术语堆叠：

- **工程师 / 独立开发者**：从他们公开的代码和项目看真本事——谁真正写了核心实现、长期维护，而不是只转发收藏别人的东西。
- **产品经理**：从职业经历看他主导过什么产品、解决过什么问题，光公司是 AI 不代表他就是做产品的。
- **市场 / 增长 / GTM / DevRel**：看他实打实把哪个产品的增长、出海或开发者社区做起来过，和你的赛道对不对得上。
- **研究员**：从论文和公开代码一起看——既有研究成果、又能落地实现，而不是只挂了个名。
- **创始人型**：看他能不能既动手做出东西、又能从 0 拉起团队和早期用户；已经大额融资的更适合做顾问或参考标杆。

共同底线：不管从哪找，最后都要落到这个人**可追溯的公开资料**上，确认是同一个人、证据对得上，才算正式人选。

## 2. 岗位找人来源

| 人才方向              | 初始状态                  | 主来源                                                                         | 辅助来源                                                | 进入候选人的最低证据                                            | CLI 适用                                                        |
| --------------------- | ------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------- |
| 工程                  | 待确认线索 / profile lead | GitHub 个人资料、repo、contributors、issues/PR、package registry               | Papers with Code、技术博客、项目页、公司页、LinkedIn    | 个人资料 + 工程作品证据 + 与目标相关的 repo/project/贡献        | 需要统一 JSON、调用轨迹、反馈闭环、回归验证或 direct API 合同时 |
| 产品 / PM             | profile lead              | LinkedIn、职业资料、产品负责人经历、公司/团队背景                              | 产品页、发布记录、媒体、GitHub/X 公开表达、社区         | 职业资料 + 产品/平台/roadmap/ownership 证据                     | LinkedIn 人才搜索                                               |
| GTM / 增长 / DevRel   | 待确认线索 / profile lead | LinkedIn、公司地图、相邻公司池                                                 | 产品发布、社区、媒体、活动、GitHub/X 公开帖子           | 职业资料 + GTM/增长/商业化/社区/DevRel 证据                     | LinkedIn 连接器、公司地图辅助搜索                               |
| AI 研究               | 待确认线索                | OpenAlex、Google Scholar、Semantic Scholar、arXiv/OpenReview、Papers with Code | 实验室页面、个人主页、导师/共同作者图谱、竞赛、GitHub   | 个人主页/GitHub/LinkedIn/个人资料 + 论文/项目/实现/职业阶段证据 | 需要研究调用轨迹或结构化候选人时                                |
| 创始人型 / operator   | 待确认线索 / profile lead | 产品页、GitHub、LinkedIn、公开公司资料                                         | X/社区、媒体、融资/发布记录、用户反馈                   | 个人资料 + 0 到 1 作品/团队/用户/增长证据                       | 通常先走主能力路径，再决定 CLI                                  |
| 超级个体 / 独立开发者 | 待确认线索 / profile lead | 个人主页、产品页、GitHub、公开作品                                             | X、Hugging Face、ModelScope、知乎、即刻、公众号、B 站   | 个人资料 + 公开作品 + 技术/产品/分发证据                        | 通常由宿主 Agent 建找人来源                                     |
| 已知候选人档案        | profile lead              | 用户给的 GitHub/LinkedIn/主页/论文作者/候选人 key                              | 公司简介、演讲、podcast、patent、媒体、Scholar/OpenAlex | 同人置信度 + 公开来源链路                                       | 宿主公开资料核验                                                |
| 触达                  | verified candidate        | 已核验档案 / 推荐名单 / 公开证据                                               | 本轮目标、岗位、渠道、语气、不可说内容                  | 不新增候选人；只使用已核验证据                                  | 通常不用 CLI，除非先补个人资料                                  |

## 3. 工程方案

优先从工程作品证据进入：

1. 技术域：Agent、MCP、LLM infra、observability、RAG、runtime、SDK、model serving。
2. 仓库 / topic / package：contributors、maintainers、recent PRs、issue discussions、stars/forks 只作辅助。
3. 个人资料验证：GitHub 个人资料、个人主页、LinkedIn、公司简介。
4. 匹配依据：仓库与目标需求的直接关系、贡献深度、近期活跃度或长期维护证据。

弱线索：

- 仓库 owner 无个人资料互链。
- 只命中 star/fork 或 keyword。
- 只有组织仓库，没有个人贡献证据。
- 泛 `awesome-*` 列表、精选列表、topic list 或资源合集只证明生态影响或找人来源价值，
  不证明目标方向实现能力；必须补核心实现、维护者提交、package、issue/PR、技术文章或产品代码证据。
- Founder / CEO / CTO / 高知名度 maintainer 默认先进 `产业标杆`、`推荐人` 或 `founder-level`
  分类；除非用户明确要创始人级候选，否则不要直接当普通全职候选。

## 4. 产品 / GTM / DevRel 方案

先建立公司 / 赛道地图，再转候选人搜索：

1. 相邻公司：竞品、同赛道、上游/下游、目标市场相似公司。
2. 职能信号：产品负责人经历、发布记录、增长、商业化、合作伙伴拓展、开发者营销、社区。
3. 候选人搜索：LinkedIn 优先，查询保留用户语言的职能、公司池、市场和地域。
4. 匹配依据：候选人经历与项目阶段、市场、产品类型或开发者生态的对应关系。

不可推断：

- relocation、签证、薪资、求职意愿、触达意愿。
- 只因为公司是 AI 公司就把 GTM 归为产品，或把产品归为工程。

## 5. 学术图谱方案

用于发现尚未被职业履历完全验证的高潜研究人才。

最低路径：

- 至少覆盖两条路径：`paper-first`、`lab-first`、`coauthor-graph`、`competition-signal`、`graph-neighbor`、`advisor-entry`。
- 至少说明两类广泛图谱 / 广泛召回来源：OpenAlex、Google Scholar、Semantic Scholar、arXiv/OpenReview、Papers with Code、lab/project/homepage。

候选人转换：

1. 待确认线索：paper、author、lab、advisor、coauthor、competition、project。
2. 身份核验：个人主页、GitHub、LinkedIn、Scholar 个人资料、实验室简介、用户提供的个人资料。
3. 贡献核验：一作/共同一作、核心实现、official code、dataset/benchmark、竞赛、repo/project maintainer。
4. 招聘分类：年轻高潜全职候选、顾问/推荐人入口、产业标杆、待确认、排除项。

Google Scholar 只作为浏览器/人工 broad recall 或经批准第三方入口，不假设官方 API。

CLI `--mode research` 或候选人回退不是学术来源栈的替代品。若返回的结果主要来自
LinkedIn/GitHub 仓库回退，而缺 OpenAlex、Semantic Scholar、arXiv/OpenReview、Scholar、
lab/homepage 交叉证据，应降级为待确认人选或找人来源线索，并写本轮覆盖缺口。

来源失败处理：

- OpenAlex 广泛召回噪声高：适合扩展图谱，不适合作最终身份凭证。
- Semantic Scholar API 429 或页面不可读：保留为覆盖缺口，不用它硬证明适配度。
- Google Scholar 访问受限：只记录广泛召回线索，不写成官方 API 或已完整读取证据。

## 6. 候选人档案方案

已知候选人深挖不是继续找新人。

固定步骤：

1. 身份消歧：同人置信度和证据。
2. 时间线：公开职业经历、教育、公司、title、时间线。
3. 成就：论文、开源、产品、GTM、社区、组织影响。
4. 公开职业联系方式：个人主页公开 email、GitHub 个人资料公开 email、论文通讯邮箱、公开社交/个人资料链接。
5. 风险缺口：身份冲突、证据缺口、过期事实、无法证明的适配度。

不允许猜私人邮箱、手机号、住址、家庭信息、auth-gated 数据或数据 broker 结果。

## 7. 触达方案

触达只写草稿，不发送。

1. 输入必须来自已核验推荐名单、档案或公开个人资料证据。
2. 选择 1-2 个与岗位相关的个性化切入点。
3. 输出 DM/email/LinkedIn/referral/follow-up 等版本。
4. 每个个性化句子都要绑定公开证据。
5. 给出 Do-not-say 和人工确认清单。

不编造共同熟人、关系、公司资源、薪资、签证、入职时间、职级或候选人兴趣。

## 8. 延伸参考

| 参考文件                                                               | 何时读取                                                                |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [ai-vertical-source-taxonomy.md](ai-vertical-source-taxonomy.md)       | 具身智能、AI Agent、AI 应用、大模型、founder/indie 等复杂画像           |
| [role-fit-rubrics.md](role-fit-rubrics.md)                             | 判断工程、研究、PM、GTM、founder、独立开发者的强证据                    |
| [x-and-community-signals.md](x-and-community-signals.md)               | 用户明确要 X/社区，或 DevRel、独立开发者、超级个体需要公开表达/社区证据 |
| [academic-source-playbook.md](academic-source-playbook.md)             | 学术图谱要执行 paper-first、lab-first、coauthor graph 等路径            |
| [deep-dive-to-outreach-workflow.md](deep-dive-to-outreach-workflow.md) | 从 shortlist 到 dossier、触达草稿、反馈二轮的串联工作流                 |
