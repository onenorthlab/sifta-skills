---
name: sifta-github-engineering
metadata:
    version: 0.0.10
    tags: [sifta-search, recruiting, sourcing, github, engineering]
description: >
    用于 AI 工程人选寻访，特别是用户要求 GitHub、开源证据、AI Agent、MCP、LLM infra、SDK、runtime、observability、RAG / embedding infra、仓库贡献者、包注册表或公开工程作品候选人时使用。用户只要 1-3 个强线索时，先用小批量辅助脚本；非招聘仓库调研、公司技术分析、KOL 合作、PM/GTM 或纯论文综述不要使用。
---

# Sifta GitHub 工程人选

招聘目标依赖公开工程作品证据时走 GitHub 优先路径。GitHub 是主要证据来源，不是唯一来源；论文、项目页、个人主页或 package registry 只能作为找人入口或身份补充，最终人选要回到个人资料、仓库和贡献证据。

## 执行流程

1. 先按共享执行门判断执行、计划或硬停止；缺地域、职级或数量不阻塞，写入假设后推进。
2. 用户未指定地区时默认 `中国/中文生态相关人才池优先`；这是公开职业信号门槛，不做族裔、国籍或姓名推断。
3. 用户只要 1-3 个强线索时，运行 `node scripts/small-batch-github.mjs --profile agent-runtime-cn --query "<英文技术能力画像>" --target-count 2 --json`。`target-count` 是展示上限，不是必须凑满人数；helper 返回 0 或少于目标时，直接报告覆盖缺口，不追加搜索凑数。
4. helper 完成后按共享执行门停止，按 `../sifta-search/templates/final-report.md` 写招聘报告。
5. `--query` 只放英文技术关键词和工程角色词；默认地域、用户原始目标、排除项和风险放进 `--checkpoint`。执行 GitHub people-first 时可内部派生公开 `location:` 变体。
6. 使用 `--sources '["github"]'`；不要因为 0 人自动切 LinkedIn/X。外部网页、论文、项目线索只能进入其他线索和下一步补证动作。
7. GitHub token 不让 CLI 变成必经路径；优先宿主 Agent、GitHub MCP、`gh`、`GH_TOKEN` / `GITHUB_TOKEN`。需要统一 JSON、调用轨迹或反馈闭环时才用 Sifta CLI。
8. 仓库、topic、package 命中先是来源线索；有个人资料、贡献深度和身份交叉信号后才升级候选人。

## 质量门

- 强线索必须来自核心工程 repo 的持续贡献、repo owner 工程作品、merged PR 深度、个人实现型 repo，或公开职业资料交叉验证；awesome-list、教程、资源集合、单次 PR 只能进来源地图。
- 默认地域对找人入口是召回偏置，对推荐人选是升级门槛；缺公开中国/中文生态相关职业信号的人只能作为其他线索、产业标杆或待核验对象，除非用户明确放宽全球人才池。
- 证据强度是首要排序依据，地域/角色偏好是次要依据；不得用地域信号把弱证据包装成 strong。
- 创始人、CEO、CTO、高知名度维护者默认放入产业标杆/推荐人/创始人级候选，除非用户明确要这类全职候选。
- repo、PR、commit 是支撑证据，不是推荐理由本身；输出格式和过程隐藏按共享执行门。
- 召回 helper 会给每个候选附 `reachability`（公开可达通道是否存在 + `hireable` 公开自标记）。它只是同档内微弱排序提示和触达便利信号，**不是可招聘性或求职意愿结论**：`hireable=true` 只能转成"触达前待确认意愿"，不得写成"此人想跳槽/可招"；不输出私人联系方式，不推断 relocation/薪资/可入职时间。

## GitHub 召回架构

| 路径 | 做什么 | 升级门槛 |
| --- | --- | --- |
| people-first | 英文技术词 + `location:` 变体召回，再读 profile、repo、组织/主页信号 | 个人资料 + 工程作品 + 默认地域公开职业信号 |
| repo-first | 搜 repo/topic/description/readme，再看 owner、contributors、merged PR 作者 | 核心工程 repo + 持续贡献/PR 深度 + 身份交叉验证 |

默认先形成较大的 raw profile / repo 池，再筛成 shortlist；不要用最终 `target-count=1` 倒推搜索池大小。seed fallback 默认不用，只能在 query-driven 不足且用户或 Agent 明确需要时作为找人入口补充。

### HuggingFace 模型作者召回（大模型工程师专用干净渠道）

当目标是**大模型工程师 / 研究工程师**（尤其中国生态 Qwen/DeepSeek/GLM/InternLM 等团队核心）时，GitHub 之外多一条更干净的渠道：`scripts/small-batch-hf.mjs`。链路是 `中国 AI 组织种子 → 热门模型 → 模型 commit 作者(真正 push 模型的人) → HF 个人资料`。它的身份是真人自维护、**零同名合并噪声**，实测能直接召回 An Yang(Qwen)、Damai Dai(DeepSeek MoE)、Haoran Wei(DeepSeek-OCR) 这类核心工程师。

```bash
# HF 直连常被重置，必须走代理（与 OpenAlex 学术脚本相反）
NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:7890 \
  node scripts/small-batch-hf.mjs --seed Qwen --seed deepseek-ai --max-authors 20 --json
```

与其它 helper 同构：脚本只做确定性召回 + 客观量级粗排（论文数/关注数/贡献模型下载量），`roughBand` 非权威；`needsAgentJudgment` 明列你要判的项——核心工程师 vs 一次性 contributor、方向契合、是否中国生态、可招性。HF 单源封顶 `lead`，需交叉 GitHub/主页/论文核验身份与贡献深度才升级。约一半候选只有用户名+组织（HF 用户名常等于 GitHub 用户名，可直接交叉）。

## 参考

| 参考文件 | 何时读取 |
| --- | --- |
| [共享执行门](../sifta-search/references/shared-gates.md) | 执行/计划/硬停止、默认地域、helper 停止、过程隐藏 |
| [小批量辅助脚本](scripts/small-batch-github.mjs) | 用户只要 1-3 个 GitHub 强线索 |
| [HF 模型作者召回](scripts/small-batch-hf.mjs) | 找大模型工程师（中国 Qwen/DeepSeek/GLM 等团队核心，干净身份、无消歧噪声，走代理） |
| [召回/排序调参](../sifta-search/references/recall-tuning.md) | 调概念词对、location 偏置、证据/地域权重 |
| [执行预算](../sifta-search/references/execution-budget.md) | 控制实时命令、延迟和 helper 后停止 |
| [CLI 合同](../sifta-search/references/cli-reference.md) | auth/status/schema 或调用轨迹 |
| [查询规则](../sifta-search/references/query-contract.md) | 写 GitHub query、sources 或处理 0 result |
| [输出规则](../sifta-search/references/output-quality.md) | 输出推荐人选、风险和下一步 |
| [状态门槛](../sifta-search/references/project-brief-and-state.md) / [角色证明标准](../sifta-search/references/role-fit-rubrics.md) | 判断线索能否升级候选 |
