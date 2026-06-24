# Sifta Live Smoke Review Template

用于记录真实 CLI/API smoke。Smoke 只证明 connector contract，不等于候选人质量证明。

```markdown
Case：
- Prompt：
- Runtime：
- Command：

Preflight：
- `sifta-cli status`：
- `/api/v1/tools`：
- Auth state：

Trace Summary：
- executedSources：
- peopleCount：
- warnings：
- searchStrategy：
- providerBudget：

Quality Review：
| Check | Result | Evidence |
| --- | --- | --- |
| Source contract kept | pass/fail | ... |
| Query/checkpoint correct | pass/fail | ... |
| Weak result downgraded | pass/fail | ... |
| Fit Proof Packet possible | pass/fail | ... |
| Coverage Warnings surfaced | pass/fail | ... |

Conclusion：
- Connector status：
- Candidate quality status：
- Next action：
```
