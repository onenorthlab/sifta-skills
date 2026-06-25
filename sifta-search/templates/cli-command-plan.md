# Sifta CLI Command Plan Template

用于决定是否调用 `sifta-cli`。CLI 是 connector 层，不替代宿主 agent 的 planner、native search 或网页阅读。

~~~markdown
Execution Surface：
- Native first：<GitHub MCP / gh / academic web / browser / none>
- CLI needed because：<stable JSON / trace / LinkedIn connector / review feedback / enrich known profile>
- Small-batch gate：<helper / direct CLI / none>
- Stop condition：<STOP_AFTER_HELPER / plan-first / hard-stop / no stop>
- Same-turn fan-out allowed：<no unless user approved second pass>

Preflight：
```bash
sifta-cli status
```

Command：
```bash
sifta-cli find-people \
  --query "<source-specific connector query>" \
  --checkpoint "<用户本轮原始目标>" \
  --sources '<source json array when applicable, e.g. ["github"] or ["linkedin"]>' \
  --target-count 10
```

Notes：
- Academic research mode may use a research trace/source-map path instead of `--sources`.
- Omit `--sources` only if the current CLI schema says the route does not accept it.
- If a helper output contains `STOP_AFTER_HELPER=true`, final-answer from that output and do not continue searching in this turn.

Expected JSON fields：
- `people`
- `searchStrategy`
- `sourceMap`
- `evidenceLog`
- `crmExport`
- `warnings`

Parser notes：
- Ignore `_notice.update` until current task is complete.
- Do not use `--pretty` for agent parsing.
- Never recommend `sifta-cli search`; current search command is `sifta-cli find-people`.
~~~
