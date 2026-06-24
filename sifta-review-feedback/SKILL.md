---
name: sifta-review-feedback
metadata:
    version: 0.0.6
    tags: [sifta-search, recruiting, sourcing, review, feedback]
description: >
    用于 Sifta 候选人搜索后的 review feedback：用户给出人工反馈、要求继续找、
    把某人移入 advisor/referrer/benchmark、排除候选人类型，或希望下一轮保留约束和 warnings
    时使用。
    普通总结、候选表美化或无上一轮结果的新搜索不要使用；新搜索应回到 `sifta-search` router。
---

# Sifta Review Feedback

一轮 Sifta 结果之后使用。用户反馈不是总结文案，而是下一轮 sourcing 的约束、排除项、分桶和扩展种子。
必须有上一轮候选结果、review packet 或明确 candidate/source-map lead；没有则 hard stop 问用户提供上一轮结果。

## Workflow

1. 从上一轮结果生成 review packet。
2. 按用户反馈填写 `feedback-template.json`。
3. 用 `sifta:review-feedback` 生成下一轮请求。
4. 分别执行每个 source-specific request，不把 GitHub 英文 query 和 LinkedIn 中文画像混在一起。
5. 把候选人迁移到 accepted/rejected/advisor/referrer/benchmark/known-network/pending-lead 等状态。
6. 保留 `feedbackIngest`、上一轮 warnings 和来源约束。

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

| Reference | 何时读取 |
| --- | --- |
| [CLI contract](../sifta-search/references/cli-reference.md) | 生成 review packet、feedback 或 CLI next request |
| [Query rules](../sifta-search/references/query-contract.md) | 生成下一轮 source-specific query |
| [State gate](../sifta-search/references/project-brief-and-state.md) | 迁移 advisor/referrer/benchmark/reject/pending-lead |
| [Intent routing](../sifta-search/references/intent-routing.md) | 反馈导致 route 改变或新搜索 |
| [Output rules](../sifta-search/references/output-quality.md) | 保留 warnings、weakness 和下一步动作 |
