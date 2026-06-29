# GitHub 召回 / 重排调参（recall-config.json）

何时读取：要调 GitHub 小批量召回的行为（停用词、概念词对、location 偏置、证据/地域权重、弱目录过滤）时。

设计原则：**机制在代码、调参在 config**。

- 机制（不动）：`sifta-github-engineering/scripts/recall-lib.mjs`（`coreQueryTerms` / `queryConceptPairs` / `scoreCandidateTwoAxis`，纯函数）。
- 调参（改这里）：`sifta-github-engineering/scripts/recall-config.json`。Owner 改 config 即可调，无需动逻辑。
- 证明（回归）：`sifta-github-engineering/scripts/recall-lib.test.mjs`（`node --test`，确定性，不依赖 live GitHub）。改 config 或机制后跑它确认两条硬约束没破。

## 为什么这样设计

旧召回脚本把方向词写死成一组 agent 工程关键词（`agent|runtime|MCP|LLM|...`）。结果是 research（VLA / world model / embodied robotics）、DevRel、founder 这类**非 agent 画像被白名单绑架**——查询退化成 `agent runtime`，召回到一堆无关 agent 开发者，真正对的人根本进不了池子。现在召回方向完全由**画像的真实词**驱动（去停用词后的核心词），白名单只在打分时作补充信号。

## 字段说明

| 字段                                                               | 作用                                                                              | 调大 / 调小的影响                                                                    |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `queryStopWords`                                                   | 从画像里剔除的虚词 / 招聘填充词（不含任何领域词）                                 | 加词＝更激进地丢词；**切勿**把领域词加进来，否则又会绑架方向                         |
| `conceptPairMaxTerms`                                              | 最多取前几个核心词组成概念词对                                                    | 调大＝覆盖更多概念、更多 search 调用（更易触发限流）；调小＝更聚焦                   |
| `locationVariants`                                                 | people-first 的公开 `location:` 偏置（默认中国/中文生态优先）                     | 这是**召回偏置**不是地域过滤；放宽全球人才池时可加入全球城市                         |
| `scoring.contrib*`                                                 | 贡献深度阈值与得分（主轴证据）                                                    | 调高阈值＝更难进 strong；这是"证据强度"主轴的核心                                    |
| `scoring.personalImplCapPts`                                       | 个人实现型 repo 证据上限分                                                        | 调大＝更看重个人作品                                                                 |
| `scoring.coreTermMatchPts`                                         | 画像方向词命中加分                                                                | 方向相关性权重                                                                       |
| `scoring.strongTierAt` / `adjacentTierAt`                          | 升 strong / adjacent 的证据分门槛                                                 | 调高＝候选人分桶更严（弱证据更多落入“待核验线索”）                                   |
| `scoring.geoProfilePts` / `geoEcosystemPts` / `hasProfileFieldPts` | **次轴**：地域/角色偏好加分                                                       | 只在同证据档内排序；见下方硬约束                                                     |
| `scoring.secondaryCapPts`                                          | 次轴加分封顶                                                                      | **必须** < `rankMultiplier`，否则会破坏跨档不反超                                    |
| `scoring.rankMultiplier` / `evidenceMultiplier`                    | 排序权重：`score = rank×rankMultiplier + evidence×evidenceMultiplier + secondary` | `rankMultiplier` 必须大于"单档内 evidence×evidenceMultiplier + secondaryCap"的最大值 |
| `weakDirectoryPatterns`                                            | 弱目录/资料集合正则（字符串，编译为 `iu`）                                        | awesome-list / 教程 / 面试题 / 资源合集等，只进来源地图不升候选                      |

## 两条硬约束（recall-lib.test.mjs 守护）

1. **方向词驱动**：`coreQueryTerms` / `queryConceptPairs` 必须用画像真实词，不退化成写死的 agent 关键词。
2. **跨证据档不反超**：排序主轴是证据强度（`evidenceRank`），次轴（地域/角色）只在**同一证据档内**排序。China-only 的弱证据候选**永远不得反超**证据强的人，也不得靠抬地域分把弱证据升档。结构上由 `rankMultiplier > 单档最大次轴+证据增量` 保证。

改完 config 或机制后，务必跑：

```bash
node --test sifta-github-engineering/scripts/recall-lib.test.mjs
```
