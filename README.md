# Sifta Skills

面向 AI 招聘候选人 sourcing 的 agent skills。Sifta 是本地强 agent 的增强层，不替代
Codex、Claude Code、OpenClaw 或 Cursor 的原生搜索、阅读和推理能力。

这个仓库包含可在 OpenClaw、Claude Code、Codex 中使用的 Sifta skills，也适用于其他支持 `SKILL.md` 标准的 agent。

## 安装

推荐用 `skills` CLI 全局安装：

```bash
npx skills add https://github.com/onenorthlab/sifta-skills.git -y -g
```

如果需要 Sifta CLI/API connector、稳定 JSON、trace、LinkedIn people search、profile
enrichment 或 review feedback，再安装 Sifta CLI：

```bash
npm install -g @sifta/cli@latest
```

配置 API key：

```bash
sifta-cli auth "<SIFTA_API_KEY>" --base-url https://sifta.onenorthdev.com/api
```

检查状态：

```bash
sifta-cli status
```

检查并更新 CLI 与 Sifta skills：

```bash
sifta-cli update --check --json
sifta-cli update
```

安装或认证完成后，重启 OpenClaw、Claude Code、Codex，或开启一个新会话。

## 手动安装

如果当前 agent 暂不支持 `npx skills add`，可以手动复制所有 `sifta-*` skill 目录。

### Claude Code

全局安装：

```bash
git clone https://github.com/onenorthlab/sifta-skills.git /tmp/sifta-skills
mkdir -p "$HOME/.claude/skills"
cp -R /tmp/sifta-skills/sifta-* "$HOME/.claude/skills/"
```

项目内安装：

```bash
mkdir -p .claude/skills
cp -R /tmp/sifta-skills/sifta-* .claude/skills/
```

### Codex

```bash
git clone https://github.com/onenorthlab/sifta-skills.git /tmp/sifta-skills
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R /tmp/sifta-skills/sifta-* "${CODEX_HOME:-$HOME/.codex}/skills/"
```

### OpenClaw

把所有 `sifta-*` 目录复制到 OpenClaw 的 skills 目录，然后重启会话。

## 可用 Skill

外部分发采用 router + 多个短 skill；不要把所有 sourcing 逻辑堆在一个 `SKILL.md` 里。

| Skill | 作用 |
| --- | --- |
| [`/sifta-search`](sifta-search/) | 总控 router，判断是否进入 Sifta 并选择具体短 skill |
| [`/sifta-github-engineering`](sifta-github-engineering/) | GitHub-first 工程和开源候选人 |
| [`/sifta-linkedin-product-gtm`](sifta-linkedin-product-gtm/) | LinkedIn 产品、GTM、增长、商业化和 company-map |
| [`/sifta-academic-graph`](sifta-academic-graph/) | 学术图谱、研究型、基础模型、WAM/VLA 和 early-career research talent |
| [`/sifta-candidate-dossier`](sifta-candidate-dossier/) | 已知候选人 deep-dive、公开经历、成就、联系方式和风险缺口 |
| [`/sifta-outreach-copy`](sifta-outreach-copy/) | 私信、邮件、LinkedIn message、referral intro 和 follow-up 草稿 |
| [`/sifta-review-feedback`](sifta-review-feedback/) | 人工 review 反馈、二轮搜索和 mixed-source 拆分 |

## 能力边界

| 场景 | 推荐执行面 |
| --- | --- |
| GitHub 工程候选人 | 先用宿主 native GitHub search / GitHub MCP / `gh`；需要 Sifta trace 或 review loop 时用 CLI |
| Academic graph / 学术通道 | 先用宿主 academic/web search 建 source map；需要结构化 research trace 时用 CLI |
| LinkedIn 产品、GTM、商业化 | 优先用 Sifta CLI/API connector |
| 已知 profile enrichment | 用 Sifta CLI/API 统一补证据 |
| Candidate dossier / 已知候选人深挖 | 先做 identity resolution，只整理公开信息和公开职业联系方式 |
| Outreach copy / 触达文案 | 只生成 evidence-backed 草稿；发送前必须人工确认 |
| Review feedback 二轮 | 用 `pnpm sifta:review-packet` 和 `pnpm sifta:review-feedback` |

无论是否调用 CLI，都必须按 Sifta 输出质量门交付：候选人必须有个人 profile 证据，source map
线索不能直接变成候选人，coverage warnings 不能省略。联系方式只限公开职业联系方式；不要猜私人
邮箱、手机号、住址或家庭信息。触达能力只生成草稿，不自动发送，不编造关系、共同熟人、薪资、
签证、入职时间或公司资源承诺。

核心 shared references 位于 [`sifta-search/references`](sifta-search/references/)：

| Reference | 作用 |
| --- | --- |
| `intent-routing.md` | 模糊需求临界点、何时追问、何时直接推进 |
| `source-map-recipes.md` | Engineering / Product / GTM / Research / Dossier / Outreach 来源地图 |
| `query-contract.md` | GitHub、LinkedIn、academic、review feedback 的 query / checkpoint 合同 |
| `fit-proof-packet.md` | requirement -> evidence -> source -> confidence -> weakness -> next action 证明包 |
| `output-quality.md` | 输出格式、coverage warning、失败恢复 |

评估集位于 [`sifta-search/evals`](sifta-search/evals/)：

| Eval | 作用 |
| --- | --- |
| `evals.json` | 16 条用户视角 behavior eval，验证 route、source map、CLI/native boundary、Fit Proof Packet 和安全边界 |
| `trigger-evals.json` | 20 条 should-trigger / should-not-trigger query，用于后续跑 skill description trigger eval |

可先用 deterministic domain gate 检查 trigger eval 的语义边界：

```bash
node sifta-search/scripts/evaluate-trigger-domain.mjs
```

该脚本不替代真实 skill trigger telemetry；它只验证正反例标签、near-miss 边界和禁止场景是否被稳定分类。

## 卸载

卸载 Sifta CLI：

```bash
npm uninstall -g @sifta/cli
```

删除本地 CLI 配置：

```bash
rm -rf ~/.sifta-cli
```

删除已安装的 skill：

```bash
rm -rf ~/.codex/skills/sifta-*
rm -rf ~/.agents/skills/sifta-*
rm -rf ~/.claude/skills/sifta-*
```

如果使用了项目内安装，也删除对应项目里的 skill 目录：

```bash
rm -rf .claude/skills/sifta-*
```

卸载后重启 agent，或开启一个新会话。

## 常见问题

**找不到 `sifta-cli`？** 执行 `npm install -g @sifta/cli@latest`。

**未认证？** 执行 `sifta-cli auth "<SIFTA_API_KEY>" --base-url https://sifta.onenorthdev.com/api`。

**收到 `_notice.update`？** 先完成当前搜索，再执行 `sifta-cli update`，然后重启 agent 或新开会话。

**Skill 没有出现？** 确认 `sifta-search/SKILL.md` 和其它 `sifta-*` 目录直接位于 agent 的 skills 目录下，然后重启 agent。
