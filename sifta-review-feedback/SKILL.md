---
name: sifta-review-feedback
metadata:
    version: 0.0.6
    tags: [sifta-search, recruiting, sourcing, review, feedback]
description: >
    用于 Sifta 候选人搜索后的 review feedback：用户给出人工反馈、要求继续找、
    把某人移入 advisor/referrer/benchmark、排除候选人类型，或希望下一轮保留约束和 warnings
    时使用。
---

# Sifta Review Feedback

一轮 Sifta 结果之后使用。用户反馈不是总结文案，而是下一轮 sourcing 的约束、排除项、分桶和扩展种子。

## Workflow

1. 从上一轮结果生成 review packet。
2. 按用户反馈填写 `feedback-template.json`。
3. 用 `sifta:review-feedback` 生成下一轮请求。
4. 分别执行每个 source-specific request，不把 GitHub 英文 query 和 LinkedIn 中文画像混在一起。
5. 保留 `feedbackIngest`、上一轮 warnings 和来源约束。

```bash
pnpm sifta:review-packet --out <review-dir> <first-pass.json>
pnpm sifta:review-feedback --out <review-dir>/next <review-dir>/feedback-template.json
```

## Feedback Mapping

| User says | Next constraint |
| --- | --- |
| Too academic | Downrank pure-paper profiles; add engineering lead, system, or founding evidence |
| More like advisor/referrer | Move to advisor/referrer bucket; expand through students, coauthors, ex-colleagues |
| Do not recommend top founders | Keep as advisor, benchmark, or referral entry, not full-time candidate |
| Direction right but evidence weak | Keep as pending lead; add profile, career, and project evidence requirements |
| Already know this person | Mark as known network; use as graph-neighbor seed |
| Identity mismatch | Set identity conflict; do not merge cross-source profiles |

## Source-Specific Rules

- GitHub next query 保持英文技术关键词和角色词。
- LinkedIn/GTM next query 保留用户自然语言人才画像。
- Academic graph next query 保留 source-map 和 profile-verification 约束。
- Mixed-source feedback 必须拆成 source-specific cases。

## References

- CLI contract: [../sifta-search/references/cli-reference.md](../sifta-search/references/cli-reference.md)
- Query rules: [../sifta-search/references/query-contract.md](../sifta-search/references/query-contract.md)
- Intent routing: [../sifta-search/references/intent-routing.md](../sifta-search/references/intent-routing.md)
- Source map recipes: [../sifta-search/references/source-map-recipes.md](../sifta-search/references/source-map-recipes.md)
- Fit proof packet: [../sifta-search/references/fit-proof-packet.md](../sifta-search/references/fit-proof-packet.md)
- Output rules: [../sifta-search/references/output-quality.md](../sifta-search/references/output-quality.md)
