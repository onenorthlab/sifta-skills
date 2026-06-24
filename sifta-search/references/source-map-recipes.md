# Source Map Recipes

本文件定义不同人才方向的来源地图。来源地图用于指导本地 agent 先去哪里找证据、哪些线索能转成候选人、什么时候使用 Sifta CLI。

## 1. 总原则

- GitHub-first / LinkedIn-first / academic-first 是主证据渠道，不是唯一渠道。
- source map 用来发现入口；候选人必须再经过个人 profile 验证。
- source map 不是候选人池。paper、repo、company、lab、project、dataset 等都先是 `source-map lead`。
- 本地 agent 原生搜索、GitHub MCP、`gh`、浏览器和学术搜索可优先使用。
- CLI 只在需要 token/auth、结构化 connector、profile enrichment、trace、review feedback 或稳定 JSON 时使用。

升级条件：`source-map lead -> identity checked -> evidence graded -> candidate bucketed`。每条 lead
至少写 `lead`、`sourceFamily`、`whyRelevant`、`conversionBlocker`、`nextVerification`。

## 2. Role Source Map

| 人才方向 | 初始状态 | 主来源 | 辅助来源 | 进入候选人的最低证据 | CLI 适用 |
| --- | --- | --- | --- | --- | --- |
| Engineering | source-map lead / profile lead | GitHub profile、repo、contributors、issues/PR、package registry | Papers with Code、technical blog、project page、company page、LinkedIn | 个人 profile + 工程 proof-of-work + 与目标相关的 repo/project/贡献 | 需要 GitHub token-backed JSON、trace、review loop 时 |
| Product / PM | profile lead | LinkedIn、职业 profile、product ownership、company/team background | 产品页、launch、media、GitHub/X 公开表达、社区 | 职业 profile + 产品/平台/roadmap/ownership 证据 | LinkedIn people search、profile enrichment |
| GTM / Growth / DevRel | source-map lead / profile lead | LinkedIn、company map、adjacent company pool | product launches、community、media、events、GitHub/X public posts | 职业 profile + GTM/增长/商业化/社区/DevRel 证据 | LinkedIn connector、company-map assisted search |
| AI Research | source-map lead | OpenAlex、Google Scholar、Semantic Scholar、arXiv/OpenReview、Papers with Code | lab pages、personal homepage、advisor/coauthor graph、competitions、GitHub | 个人主页/GitHub/LinkedIn/profile + 论文/项目/实现/职业阶段证据 | 需要 research trace 或结构化候选人时 |
| Known candidate dossier | profile lead | 用户给的 GitHub/LinkedIn/主页/论文作者/候选人 key | company bio、talk、podcast、patent、media、Scholar/OpenAlex | same-person confidence + 公开来源链路 | `enrich-people` |
| Outreach | verified candidate | 已核验 dossier / candidate table /公开证据 | 项目 brief、岗位、渠道、语气、不可说内容 | 不新增候选人；只使用已核验证据 | 通常不用 CLI，除非先补 enrichment |

## 3. Engineering Recipe

优先从 proof-of-work 进入：

1. 技术域：Agent、MCP、LLM infra、observability、RAG、runtime、SDK、model serving。
2. Repo / topic / package：contributors、maintainers、recent PRs、issue discussions、stars/forks 只作辅助。
3. Profile verification：GitHub profile、personal homepage、LinkedIn、company bio。
4. Fit proof：repo 与目标需求的直接关系、贡献深度、近期活跃度或长期维护证据。

弱线索：

- repo owner 无 profile 互链。
- 只命中 star/fork 或 keyword。
- 只有组织仓库，没有个人贡献证据。
- generic `awesome-*` list、curated list、topic list 或资源合集只证明生态影响或 source-map
  价值，不证明目标方向实现能力；必须补 core implementation、maintainer commit、package、issue/PR、
  technical post 或产品代码证据。
- Founder / CEO / CTO / 高知名度 maintainer 默认先进 `产业标杆`、`推荐人` 或 `founder-level`
  桶；除非用户明确要 founder-level 候选，否则不要直接当普通全职候选。

## 4. Product / GTM / DevRel Recipe

先建立 company / sector map，再转 people search：

1. 相邻公司：竞品、同赛道、上游/下游、目标市场相似公司。
2. 职能信号：product ownership、launch、growth、commercialization、partnerships、developer marketing、community。
3. People search：LinkedIn-first，query 保留用户语言的职能、公司池、市场和地域。
4. Fit proof：候选人经历与项目阶段、市场、产品类型或开发者生态的对应关系。

不可推断：

- relocation、签证、薪资、求职意愿、触达意愿。
- 只因为公司是 AI 公司就把 GTM 归为产品，或把产品归为工程。

## 5. Academic Graph Recipe

用于发现尚未被职业履历完全验证的高潜研究人才。

最低路径：

- 至少覆盖两条路径：`paper-first`、`lab-first`、`coauthor-graph`、`competition-signal`、`graph-neighbor`、`advisor-entry`。
- 至少说明两类 broad graph / broad recall 来源：OpenAlex、Google Scholar、Semantic Scholar、arXiv/OpenReview、Papers with Code、lab/project/homepage。

候选人转换：

1. source-map lead：paper、author、lab、advisor、coauthor、competition、project。
2. identity check：个人主页、GitHub、LinkedIn、Scholar profile、lab bio、user-provided profile。
3. contribution check：first/co-first author、核心实现、official code、dataset/benchmark、竞赛、repo/project maintainer。
4. recruiting bucket：年轻高潜全职候选、顾问/推荐人入口、产业标杆、待核验、排除项。

Google Scholar 只作为浏览器/人工 broad recall 或经批准第三方入口，不假设官方 API。

CLI `--mode research` 或 people fallback 不是 academic source stack 的替代品。若返回的结果主要来自
LinkedIn/GitHub repo fallback，而缺 OpenAlex、Semantic Scholar、arXiv/OpenReview、Scholar、
lab/homepage 交叉证据，应降级为待核验候选或 source-map lead，并写 Coverage Warning。

Provider failure handling：

- OpenAlex broad recall 噪声高：适合扩展 graph，不适合作最终 identity proof。
- Semantic Scholar API 429 或页面不可读：保留为 coverage gap，不用它硬证明 fit。
- Google Scholar 访问受限：只记录 broad recall 线索，不写成官方 API 或已完整读取证据。

## 6. Dossier Recipe

已知候选人深挖不是继续找新人。

固定步骤：

1. identity resolution：same-person confidence 和证据。
2. timeline：公开职业经历、教育、公司、title、时间线。
3. achievement：论文、开源、产品、GTM、社区、组织影响。
4. public contact：个人主页公开 email、GitHub profile email、论文通讯邮箱、公开社交/profile 链接。
5. risk gaps：身份冲突、证据缺口、过期事实、无法证明的 fit。

不允许猜私人邮箱、手机号、住址、家庭信息、auth-gated 数据或数据 broker 结果。

## 7. Outreach Recipe

触达只写草稿，不发送。

1. 输入必须来自已核验 candidate table / dossier / public profile evidence。
2. 选择 1-2 个与岗位相关的 personalization angle。
3. 输出 DM/email/LinkedIn/referral/follow-up 等版本。
4. 每个个性化句子都要绑定公开证据。
5. 给出 Do-not-say 和人工确认清单。

不编造共同熟人、关系、公司资源、薪资、签证、入职时间、职级或候选人兴趣。
