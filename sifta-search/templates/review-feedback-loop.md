# Sifta Review Feedback Loop Template

用于把人工 review 转成下一轮 source-specific request。

```markdown
Previous Result：
- Result file：
- Review packet：
- Known warnings：

Human Feedback：
| Candidate/Lead | Previous state | Feedback | New state | Reason |
| --- | --- | --- | --- | --- |
| A | candidate | 更像顾问 | advisor/referrer | ... |
| B | candidate | 产业标杆 | benchmark | ... |
| C | sourceMapLead | 证据弱 | rejected/pending-lead | ... |

Generate feedback：
```bash
pnpm sifta:review-packet --out <review-dir> <first-pass.json>
pnpm sifta:review-feedback --out <review-dir>/next <review-dir>/feedback-template.json
```

Next Requests：
| Case | Sources | Query contract | Feedback preserved |
| --- | --- | --- | --- |
| github-next | `["github"]` | English technical tokens | yes |
| linkedin-next | `["linkedin"]` | User-language role/market profile | yes |

Guardrails：
- Keep source-specific queries split.
- Put long review in `--feedback`, not GitHub query.
- Preserve prior warnings and exclusions.
```
