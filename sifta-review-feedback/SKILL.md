---
name: sifta-review-feedback
metadata:
    version: 0.0.6
    tags: [sifta-search, recruiting, sourcing, review, feedback]
description: >
    用于 Sifta 候选人搜索后的人工反馈：用户给出反馈、要求继续找、
    把某人移入顾问/推荐人/产业标杆，排除候选人类型，或希望下一轮保留约束和覆盖风险
    时使用。
    普通总结、候选人分桶美化或无上一轮结果的新搜索不要使用；新搜索应回到 `sifta-search` 路由。
---

# Sifta 人工反馈

一轮 Sifta 结果之后使用。用户反馈不是总结文案，而是下一轮寻访的约束、排除项、分类和扩展种子。
必须有上一轮候选结果、反馈包或明确候选人/来源线索；没有则硬停止，要求用户提供上一轮结果。

## 执行流程

1. 读取上一轮候选人、来源地图、风险提示和用户人工反馈。
2. 把反馈整理成 `feedbackIngest` JSON：保留约束、排除项、扩展种子和分类调整。
3. 按来源拆分下一轮请求，不把 GitHub 英文 query 和 LinkedIn 中文画像混在一起。
4. 用 `sifta-cli find-people --feedback '<json>'` 分别执行每个指定来源的请求。
5. 把候选人迁移到通过、排除、顾问/推荐人、产业标杆、已知人脉或待核验线索等状态。
6. 保留上一轮风险提示、来源约束和用户明确排除项。

示例：

```bash
sifta-cli find-people \
  --query "<下一轮指定来源查询>" \
  --checkpoint "<用户原始目标>" \
  --feedback '[{"feedback":"上一轮候选人更像顾问，请继续找全职候选","constraints":["保留工程落地证据"],"exclusions":["纯论文资料"]}]' \
  --sources '["github"]'
```

## 反馈映射

| 用户反馈           | 下一轮约束                                                 |
| ------------------ | ---------------------------------------------------------- |
| 太学术             | 降低纯论文型资料权重；增加工程落地、系统实现或创业证据要求 |
| 更像顾问/推荐人    | 移入顾问/推荐人分类；通过学生、共同作者、前同事继续扩展    |
| 不要推荐头部创始人 | 保留为顾问、标杆或推荐入口，不作为普通全职候选人           |
| 方向对但证据弱     | 保留为待核验线索；增加个人资料、职业经历和项目证据要求     |
| 已经认识这个人     | 标记为已知人脉；作为图谱邻居种子使用                       |
| 身份不匹配         | 标记身份冲突；不要合并跨来源资料                           |

## 分来源规则

- GitHub 下一轮查询保持英文技术关键词和角色词。
- LinkedIn/GTM 下一轮查询保留用户自然语言人才画像。
- 学术图谱下一轮查询保留来源地图和个人资料核验约束。
- 多来源反馈必须拆成指定来源的独立请求。

## 参考

| 参考文件                                                                         | 何时读取                                            |
| -------------------------------------------------------------------------------- | --------------------------------------------------- |
| [CLI 合同](../sifta-search/references/cli-reference.md)                          | 生成 `--feedback` JSON 或 CLI 下一轮请求            |
| [查询规则](../sifta-search/references/query-contract.md)                         | 生成下一轮指定来源查询                              |
| [状态门槛](../sifta-search/references/project-brief-and-state.md)                | 迁移 advisor/referrer/benchmark/reject/pending-lead |
| [深挖到建联工作流](../sifta-search/references/deep-dive-to-outreach-workflow.md) | 把用户反馈转成下一轮约束、分类迁移和触达前确认      |
| [角色证明标准](../sifta-search/references/role-fit-rubrics.md)                   | 反馈要求更偏工程/研究/PM/GTM/founder/独立开发者时   |
| [意图路由](../sifta-search/references/intent-routing.md)                         | 反馈导致路线改变或新搜索                            |
| [输出规则](../sifta-search/references/output-quality.md)                         | 保留风险、弱点和下一步动作                          |
