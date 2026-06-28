---
name: sifta-github-engineering
metadata:
    version: 0.0.6
    tags: [sifta-search, recruiting, sourcing, github, engineering]
description: >
    用于 AI 工程候选人寻访，特别是用户要求开源证据、GitHub 个人资料、
    AI Agent、MCP、LLM infra、SDK、runtime、observability、RAG / embedding infra、
    模型应用基础设施、仓库贡献者、包注册表或公开工程作品证据候选人时使用。
    用户只要 1-3 个强线索时，先用内置小批量辅助脚本，不要手写多轮 `gh`、网页搜索或 CLI 查询。
    非招聘仓库调研、公司技术分析、开源项目评估、KOL 合作、PM/GTM 或纯论文综述不要使用。
---

# Sifta GitHub 工程候选人

招聘目标依赖公开工程作品证据时走 GitHub 优先路径。GitHub 是主要证据来源，不是唯一来源：
论文、项目页、Papers with Code、公司页面或个人主页可以作为来源地图和身份补充，但最终工程候选人仍要回到 GitHub 个人资料、仓库、个人主页或
等价公开工程证据。GitHub 查询使用英文技术关键词和工程角色词，不使用通用网页搜索语法，也不塞
中文招聘叙述。

## 执行流程

1. 先确认这是招聘目标；缺地域、职级或数量不阻塞，写入“假设”后推进。用户未指定地区时，默认 `中国/中文生态相关人才池优先`；这不是 GitHub 查询里的严格 location filter，也不是族裔推断。
2. 区分计划和执行：用户要求“找人/给候选人/推荐/名单/几个/跑一轮/执行”时就是执行请求；只有用户明确要“怎么找/来源地图/先规划/升级门槛”时，才只输出 GitHub 来源地图、查询方案、证据门槛和覆盖风险，不调用 CLI、网页搜索、浏览器或实时搜索 / 实时核验。
3. 小批量执行要及时停住：用户只要 1-3 个强线索时，不要手写 `gh`/网页循环；默认运行 `node scripts/small-batch-github.mjs --profile agent-runtime-cn --query "<英文技术能力画像>" --target-count 2`。辅助脚本通过 GitHub REST 读取公开数据，先做 query-driven user/repository search，再做 repo owner / contributor / merged PR 作者升级；默认不依赖固定 seed。固定 seed 只能在用户或 Agent 明确需要兜底时通过参数开启，并且只能作为来源地图补充，不能占满候选池。优先使用 `GH_TOKEN` / `GITHUB_TOKEN`，没有 token 时可匿名低额度请求。辅助脚本完成后，内部停止执行并直接整理成用户报告；最终答复保留覆盖风险和下一步，不输出停止标记、命令、events、timing、target-count、脚本名或使用了哪个 skill，也不再查提交、issue、网页或更多仓库。
4. 先判断执行面：宿主 Agent 的 GitHub 搜索、GitHub MCP、`gh`、浏览器或用户自己的 `GH_TOKEN` / `GITHUB_TOKEN` 足够时优先使用它们；小批量仍优先辅助脚本。
5. 不要为了 GitHub token 单独改走 Sifta CLI。额度不足、未认证、rate limit 或 auth failure 时，提示用户在宿主环境配置 `GH_TOKEN` / `GITHUB_TOKEN`、GitHub MCP 或 `gh auth`。需要 Sifta 统一 JSON、调用轨迹、反馈闭环、回归验证，或用户明确要求 Sifta CLI 时，才运行 `sifta-cli status`。
6. 保留用户原始请求和默认地域假设作为 `--checkpoint`。
7. `--query` 只放英文技术关键词和角色词，例如 `AI Agent MCP LLM infra engineer open source`；不要为了默认地域把 GitHub 查询改成中文或加入招聘叙述。
8. 使用 `--sources '["github"]'`；不要因为 0 个结果自动切到 LinkedIn 或 X。若需要外部补充，
   先把论文、项目、公司或个人线索写入来源地图（`sourceMap`）和覆盖风险。
9. 仓库、主题、包命中先是来源线索；有个人资料、贡献深度和身份交叉信号后才升级为候选人。
10. 输出候选人分桶、待核验线索和适配证明，显式写覆盖风险。

## 质量门

- 最终答复必须保留覆盖风险；辅助脚本停止时不要把停止标记、脚本名、命令、参数或运行过程写进用户答复。
- 仓库回退结果默认是弱线索或待核验，不等于强候选人。
- 强线索必须来自核心工程 repo 的持续贡献、repo owner 工程作品、merged PR 深度、个人 repo 工程证据，或公开职业资料交叉验证；单个 PR、awesome-list、目录仓库、资源集合、集成清单和社区列表只能进入来源地图。
- 只有同时有个人资料、工程项目、公司/经历或身份交叉信号时，才进入候选池。
- `priority=C`、职业工程证据弱、来源错误、仓库回退结果都必须写入覆盖风险。
- 宿主原生 GitHub 搜索结果也要按同一质量门解释，不能因为不是 CLI 结果就降低证据要求。
- GitHub 优先不排斥学术或网页线索；这些线索只能帮助定位仓库或个人资料，不能替代候选人证据。
- 默认地域对来源地图是召回偏置，对候选人分桶是升级门槛：优先看公开职业资料里的中国大陆、港澳台、中文教育/工作/社区、中国市场或中国相关机构/公司信号；不得凭姓名、照片、外貌、口音、族裔或国籍猜测。
- 用户没有明确放宽为全球人才池时，缺公开中国/中文生态相关职业信号的人只能作为来源地图线索、产业标杆或待核验对象，不能进入候选人或强线索分桶。
- 最终答复必须显式写明默认地域不是姓名、照片、外貌、口音、族裔或国籍推断；只看公开职业信号。用户要求不走某类连接器、GitHub 额度不足或认证失败时，只写对覆盖面的影响和可选补救；不要默认写“未使用 / 不改用 Sifta CLI”、具体命令或认证过程。
- 泛 `awesome-*` 列表、主题列表、star/fork 高但缺实现证据的仓库，只能作为来源地图
  或生态影响线索；必须补维护者提交、核心实现仓库、package、issue/PR 或产品代码证据后才升级。
- 创始人、CEO、CTO、高知名度维护者默认放入 `产业标杆` / `推荐人` / `创始人级候选人`
  分桶；除非用户明确要创始人级候选，否则不要把可招募性未知的人包装成普通全职候选。

## GitHub 召回架构

Agent/MCP/LLM infra 真实召回时，默认地域是中国/中文生态，但不要把来源写死成一组固定 seed。AI 大项目太多、新项目增长太快，人工 seed 永远枚举不完；seed 只能帮助发现来源地图，不能证明候选质量。

先把用户画像编译成英文技术 query，例如 `AI Agent MCP LLM infra engineer open source`、`agent runtime tool calling function calling`，再同时走两条主路径：

| 路径         | 做什么                                                                               | 升级门槛                                                 |
| ------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| people-first | `search/users`、个人 repo、profile、组织/公司/主页信号                               | 个人资料 + 工程作品 + 默认地域公开职业信号               |
| repo-first   | `search/repositories`、topic/description/readme、owner、contributors、merged PR 作者 | 核心工程 repo + 持续贡献 / merged PR 深度 + 身份交叉验证 |

执行顺序：

1. `search/users`：找公开 GitHub 用户线索，只作为早期 lead，不足以直接证明候选质量。
2. `search/repositories`：用技术词、topic、description/readme 和 recently updated / stars 混合找到核心工程 repo，不预设固定项目清单。
3. repo owner / contributor / merged PR 作者升级：只有个人资料、贡献深度和工程证据足够时才进候选分桶。
4. 潜在人选池：贡献或方向相关但证据不足的人，保留为待核验人选；不要丢掉，也不要包装成强候选。
5. seed fallback：默认不跑。只有 query-driven 召回不足且用户或 Agent 明确需要兜底时才用，并且最多作为兜底来源地图；必须标明 seed 来源，不得和 query-driven 结果混成强证据。

不要让任何单个大仓库占满小批量预算；每个 repo 默认最多升级 1 个候选，其他贡献者进入待核验人选或来源地图。不要让 `langgraph`、`openai-agents-python`、`autogen`、`deepeval` 等全球 seed 先占满小批量预算；它们只能作为用户明确放宽全球人才池后的 benchmark/source-map fallback。降低只命中 `awesome-list`、curated list、资源集合、集成目录或泛 `AI tools` repo 的权重，并把原因写进覆盖风险。

## 参考

| 参考文件                                                                                                                                      | 何时读取                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| [小批量辅助脚本](scripts/small-batch-github.mjs)                                                                                              | 用户只要 1-3 个 GitHub 强线索                          |
| [执行预算](../sifta-search/references/execution-budget.md)                                                                                    | 控制实时命令、延迟和重复搜索                           |
| [CLI 合同](../sifta-search/references/cli-reference.md)                                                                                       | 调用 CLI、auth/status/schema 失败或需要调用轨迹        |
| [查询规则](../sifta-search/references/query-contract.md)                                                                                      | 写 GitHub query、修 sources 或处理 0 result            |
| [来源地图方案](../sifta-search/references/source-map-recipes.md)                                                                              | 仓库回退、awesome-list、论文/项目线索较多              |
| [AI 垂直来源地图](../sifta-search/references/ai-vertical-source-taxonomy.md) / [角色证明标准](../sifta-search/references/role-fit-rubrics.md) | Agent、MCP、AI 应用、独立开发者、founder-like 工程画像 |
| [X 和社区信号](../sifta-search/references/x-and-community-signals.md)                                                                         | 独立开发者、DevRel 或公开社区表达需要作为辅助证据      |
| [状态门槛](../sifta-search/references/project-brief-and-state.md)                                                                             | 判断来源线索能否升级候选                               |
| [适配证明](../sifta-search/references/fit-proof-packet.md) / [输出规则](../sifta-search/references/output-quality.md)                         | 输出候选表和覆盖风险                                   |
