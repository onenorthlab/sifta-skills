# Sifta Final Report Template

用于候选人搜索、source-map-first 搜索或 review-feedback 后的最终 Markdown 输出。不要输出原始 JSON。

```markdown
Project Card：
- 目标：<用户原始目标>
- Assumptions：<缺失信息和保守假设>
- Must-have：<硬条件>
- Avoid：<排除项或风险>

Source Map：
| lead | sourceFamily | whyRelevant | conversionBlocker | nextVerification |
| --- | --- | --- | --- | --- |
| ... | GitHub / LinkedIn / academic / company / lab / project | ... | identity/profile/evidence missing | ... |

Candidate Buckets：
| # | 候选人 | State | Bucket | 来源 | 概况 | Evidence grade | Weakness | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | ... | candidate / rejected | 全职候选 / 顾问推荐人 / 产业标杆 / 待核验 | [Profile](url) | ... | A/B/Reject | ... | ... |

Lead Queue：
| lead | state | sourceFamily | whyRelevant | conversionBlocker | nextVerification |
| --- | --- | --- | --- | --- | --- |
| ... | source-map lead | paper / repo / company / lab / project | ... | identity/profile/evidence missing | ... |

Fit Proof Packet：
| Candidate/Lead | State | Requirement | Evidence | Source | Confidence | Weakness | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ... | candidate | ... | ... | ... | identity=high, fit=medium, evidence=A | ... | ... |

Coverage Warnings：
- <provider、source、identity、weak-result、classification 或 Project Brief warning>

Next Action：
- <停止条件，或后续用户批准后的扩展 / 人工 review / 补证据 / 触达草稿>
```
