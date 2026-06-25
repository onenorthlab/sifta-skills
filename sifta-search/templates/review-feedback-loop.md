# Sifta Review Feedback Loop Template

用于把人工 review 转成下一轮 source-specific request。

```markdown
Previous Result：
- Candidate summary：
- Source map：
- Known warnings：

Human Feedback：
| Candidate/Lead | Previous state | Feedback | New state | Reason |
| --- | --- | --- | --- | --- |
| A | candidate | 更像顾问 | advisor/referrer | ... |
| B | candidate | 产业标杆 | benchmark | ... |
| C | sourceMapLead | 证据弱 | rejected/pending-lead | ... |

Next CLI request：
```bash
sifta-cli find-people \
  --query "<next source-specific query>" \
  --checkpoint "<original user goal>" \
  --feedback '[{"feedback":"上一轮候选人更像顾问，请继续找全职候选","constraints":["保留工程落地证据"],"exclusions":["纯论文 profile"]}]' \
  --sources '["github"]'
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
