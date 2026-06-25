# Execution Budget

执行预算是 Sifta execution reliability 的质量门。它不评价候选人是否真的优秀，只约束本地
agent 不要在小批量 sourcing 中工具发散、重复调用 CLI 或把弱结果包装成完成交付。

## 1. 预算表

| 场景 | duration | web_search | live_command | CLI 搜索 |
| --- | ---: | ---: | ---: | ---: |
| GitHub / Engineering 1-3 强线索 | <= 180s | <= 2 | <= 4 | `find-people` 0 次；helper 1 次 |
| Product/GTM 1-3 强线索 | <= 180s | 0 | <= 3 | `find-people` 最多 1 次 |
| Plan-first | <= 120s | 0 | 0 | 0 |
| Hard-stop / privacy | <= 90s | 0 | 0 | 0 |
| Non-sourcing near-miss | Sifta 不计分 | 允许宿主原生研究 | 允许宿主原生研究 | 0 |

超预算必须进入 eval fail 或报告 warning；不能只因为最终 Markdown 看起来完整就算通过。

## 2. 停止条件

小批量执行优先使用 route skill 的 bundled helper。helper stdout 必须包含 `STOP_AFTER_HELPER=true`。
如果 stdout 还包含 `HARD_STOP_AFTER_HELPER=true` 或 `NO_FALLBACK_WEB=true`，本轮不得用 web/exa/native search 自救。
helper stdout 已包含 Project Card、
Candidate Buckets、Source Map、Fit Proof Packet 和 Coverage Warnings 时，直接整理成最终答复。

除非满足以下任一条件，不继续调用 web search、`gh`、browser、`sifta-cli find-people` 或第二个 helper：

- helper 返回 0 个 usable people / lead。
- helper 明确报告 auth、schema 或 provider 失败。
- 用户明确要求第二轮扩展，并接受更高预算。
- 人工/Owner review 后需要按 feedbackIngest 继续找。

## 3. 计分字段

真实 Codex CLI eval 必须保存：

- `duration_seconds`
- `web_search_count`
- `live_command_count`
- `preflight_command_count`
- `command_texts`
- `model_output_missing`
- `triggered_sifta`
- `used_live_tools`

预算 eval 读取 `benchmark.json` 和每个 case 的 `outputs/timing.json`。重复的
`sifta-cli find-people`、`sifta-cli enrich-people` 或 helper 调用要单独计数。

## 4. 候选质量边界

预算通过只说明执行路径稳定，不说明候选 relevance 通过。候选质量需要单独 Owner review：

| 维度 | 通过口径 |
| --- | --- |
| relevance | 候选人主要经历能回答用户能力画像 |
| evidence strength | 证据不是 title keyword；能追溯到公开 profile、repo、论文或职业材料 |
| source reliability | 来源与候选人身份、职能和贡献相匹配 |
| weakness honesty | 明确写缺口，不推断求职意愿、私人联系方式、薪资、签证或 relocation |

结构通过、预算通过和候选质量通过必须分开报告。
