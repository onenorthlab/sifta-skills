# Fit Proof Packet

本文件定义如何证明候选人符合用户需求。Sifta 的输出必须让用户知道“为什么这个人值得看”，而不是只看到姓名和 profile。

## 1. 固定结构

每个候选人必须能落到这个证明包：

| 字段 | 含义 |
| --- | --- |
| state | `source-map lead` / `profile lead` / `verified candidate` / `rejected` |
| requirement | 用户需求或转写后的筛选条件 |
| evidence | 公开证据，必须能指向 source |
| source | GitHub / LinkedIn / paper / homepage / repo / talk / company bio 等 |
| confidence | identity / fit / evidence 三类置信度 |
| weakness | 未证明、不满足或需要人工核验的点 |
| next action | 深挖、触达、继续扩展、转顾问/推荐人、排除 |

## 2. 证据质量等级

| 等级 | 说明 | 可作为强候选人吗 |
| --- | --- | --- |
| A | 个人 profile 与目标证据直接匹配，且来源可追溯 | 可以 |
| B | 有强 source-map 或单一 profile 证据，但缺少交叉验证 | 可以作为待复核候选，必须 warning |
| C | repo owner、论文作者、公司/实验室成员、关键词命中等弱线索 | 只能 source-map 或待核验线索 |
| Reject | 身份冲突、非公开信息、与岗位无关、证据无法追溯 | 不进候选表 |

C 级只能作为 lead；B 级可进入待复核候选；A 级才可作为强推荐。隐私、自动发送、
无个人 profile、身份冲突或非公开数据是 dealbreaker，直接 Reject 或 hard stop。

## 3. 接受门

候选人进入候选表前必须满足：

- identity confidence 至少 medium，或明确写成“待核验候选”。
- 至少一个与 requirement 直接相关的公开证据。
- source 链接或来源描述可追溯。
- weakness 不为空；即使强候选也写未验证项。
- 不输出私人联系方式猜测、薪资、求职意愿、relocation、签证、入职时间。

Academic graph 的 paper / lab / advisor / coauthor / competition / project 线索必须先停在 source map；
只有找到个人主页、GitHub、LinkedIn、Scholar profile、lab bio 或用户给出的 profile 后，才可进入候选表。

## 4. 输出模板

候选人表保持紧凑；证明细节放在表后。

```markdown
Project Card：
- 目标：...
- Assumptions：...

Source Map：
- searched: ...
- pending: ...

Candidate Buckets：
| 候选人/Lead | State | Bucket | Evidence grade | Why fit | Weakness | Next action |
| --- | --- | --- | --- | --- | --- | --- |
| ... | verified candidate / source-map lead | 全职候选 / 顾问推荐人 / 产业标杆 / 待核验 | A/B/C | ... | ... | ... |

Fit Proof Packet：
| Candidate/Lead | State | Requirement | Evidence | Source | Confidence | Weakness | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ... | verified candidate | ... | ... | ... | identity=high, fit=medium, evidence=A | ... | ... |

Coverage Warnings：
- ...
```

## 5. 常见失败

| 失败 | 处理 |
| --- | --- |
| 只有 summary，没有 evidence/source | 不算完成；补 Fit Proof Packet |
| 论文作者直接当候选人 | 降级为 source-map lead，继续找 profile |
| repo fallback 被强推 | 降级为 B/C，保留 warning |
| LinkedIn 候选人只有 title 命中 | 写 fit=low/medium，要求补产品/增长/工程证据 |
| outreach copy 没有 personalization evidence | 不能发送；退回补证据或写 generic 草稿 |
