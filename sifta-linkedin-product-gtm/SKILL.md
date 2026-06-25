---
name: sifta-linkedin-product-gtm
metadata:
    version: 0.0.6
    tags: [sifta-search, recruiting, sourcing, linkedin, product, gtm]
description: >
    只在用户明确要找 AI 产品/GTM/增长/商业化/DevRel/合作伙伴拓展候选人、人选或人才时使用。
    明确不找候选人/不做寻访的公司研究、市场分析、增长打法、商业化模式、岗位说明、销售线索、渠道合作/KOL 不要使用。
    找 BD/市场负责人等人选且要求私人邮箱、手机号、自动发送或批量外联时，只硬停止，不搜索。
    使用 LinkedIn/职业资料作为主候选证据，避免把非工程职能误路由到 GitHub。
---

# Sifta LinkedIn 产品和 GTM

主要证据来自职业资料、产品负责人经历、GTM、增长、商业化、合作伙伴拓展、DevRel 或相邻
公司经历时走 LinkedIn 优先路径。LinkedIn 是主要找人渠道，不是唯一渠道：
公司地图、产品页、GitHub 仓库、开发者社区、X/公开帖子或媒体报道可以做辅助来源地图，
尤其适用于 DevRel、开发者营销、开源社区和 AI 产品生态岗位；
但非工程候选人的主候选人证据仍应回到 LinkedIn、个人主页或明确职业资料。这里 Sifta CLI/API
的连接器价值更明确；宿主 Agent 没有稳定 LinkedIn 人才搜索 / 人员资料访问能力时优先用 Sifta。

## 执行流程

1. 先确认岗位族是 Product/GTM/DevRel 或可从用户目标推断；不要因 AI/Agent/LLM 自动转工程。
   用户未指定地区时，默认 `中国/中文生态相关人才池优先`，并把“中国/中文生态/中国市场”中最贴合的表达放进查询和项目简报；这不是族裔推断。
   如果用户明确说不找候选人、不做寻访，或只要公司研究简报、商业化模式/增长打法、岗位说明、销售/BD/partnership 线索，退出 Sifta，交给宿主原生研究或做硬停止；私人联系方式、手机号、自动发送、批量外联请求不调用搜索工具。
2. 区分计划和执行：用户要求“找人/给候选人/推荐/名单/几个/跑一轮/执行”时就是执行请求；用户只问“怎么找/来源地图/头衔地图/帮我看怎么找”时，才只输出公司/头衔/来源地图、查询方案、证据门槛和覆盖风险，不调用 CLI、网页搜索、浏览器，不查官网，不做实时公司核验。
3. 用户明确要求执行且只要 1-3 个强线索时，运行 `node scripts/small-batch-product-gtm.mjs --query "<用户语言画像>" --checkpoint "<用户原始目标>" --target-count 3`。辅助脚本完成后直接整理用户报告，不再追加网页/Exa/公司核验、浏览器查询或第二次 `find-people`。如果辅助脚本失败、未认证、API 不可达或返回 0 人，本轮仍按辅助脚本结果停止：最终答案只报告结论、覆盖风险和下一步；不要输出停止标记、脚本名、命令、参数、运行过程、`target-count` 或使用了哪个 skill，不要用网页、Exa、浏览器、公司页、原生搜索或手写 LinkedIn 查询替换候选人，也不要编造候选人表。
4. 需要更大候选名单、调用轨迹或反馈闭环时才直接运行 `sifta-cli status` + `find-people`。
5. 保留用户原始请求和默认地域假设作为 `--checkpoint`；`--query` 使用用户语言，保留岗位、城市、公司、职能、市场信号和默认中国/中文生态相关来源优先级及候选人升级门槛；使用 `--sources '["linkedin"]'`。
6. GTM / 公司地图场景先建立或复用公司 / 赛道地图，再转候选人搜索；计划阶段只能把用户给定公司标为待核验种子（`unverified seed`），连接器不可用时只交付来源方案，不声称找到人。
7. 公司/赛道地图只是来源线索；LinkedIn/职业资料 + 职能证据后才是候选人。
8. DevRel / 开发者营销如果需要 GitHub 或社区证据，把它作为来源地图辅助；不要把
   非工程岗位误分流成只查 GitHub 的候选人搜索。
9. 输出候选人分桶和适配证明；产品/GTM 候选人也必须有职业证据和风险。

计划输出必须包含：

```text
覆盖风险：未执行实时搜索；公司池为用户给定/待验证；不推断求职意愿、薪资、签证、搬迁或触达意愿。
```

下面的 CLI 示例只用于明确执行场景；不要把它们作为计划阶段答案直接运行或输出。

产品岗位示例：

```bash
sifta-cli find-people \
  --query "上海 AI Agent 产品经理，具备大模型应用、智能体平台或 Agent 产品规划经验" \
  --checkpoint "<用户原始招聘目标>" \
  --sources '["linkedin"]' \
  --target-count 10
```

GTM 示例：

```bash
sifta-cli find-people \
  --query "在 AI 视频、AI 数字人或 AI 创作者工具公司负责 GTM、增长或商业化的人，中国/中文生态相关人才池优先，最好有相邻公司经验，并能覆盖目标市场" \
  --checkpoint "<用户原始招聘目标和公司/市场约束>" \
  --sources '["linkedin"]' \
  --target-count 10
```

## 质量门

- 最终答复必须保留覆盖风险；辅助脚本停止时不要把停止标记、脚本名、命令、参数或运行过程写进用户答复。
- 辅助脚本失败、未认证、API 不可达或 0 人时，明确本轮没有候选人，只写覆盖风险和下一步；不要把失败报告改写成完整候选人交付。
- 产品规划、平台产品、PM、roadmap 证据归 `AI产品/平台`。
- 增长、营销、商业化、合作伙伴拓展、DevRel、开发者社区证据归 `GTM/增长/DevRel`。
- `partnerships` 只指候选人职业职能证据；不要把商务合作对象、销售线索列表或合作伙伴页面当候选人来源。
- 不推断搬迁、签证、薪资、触达意愿或求职意愿。
- 默认地域对来源地图是排序和核验偏置，对候选人分桶是升级门槛；只看公开职业资料里的中国大陆、港澳台、中文教育/工作/社区、中国市场或中国相关机构/公司信号，不推断候选人愿意回国、搬迁或覆盖某市场，也不凭姓名、照片或族裔猜测。
- 不因为产品涉及 Agent、LLM 或 AI，就默认走 GitHub 工程路线。
- LinkedIn 优先不排斥 GitHub、X、产品页或媒体报道，但这些来源只做公司/来源地图、
  公开作品或公开表达补充；候选人身份仍需职业资料验证。

## 参考

| 参考文件 | 何时读取 |
| --- | --- |
| [小批量辅助脚本](scripts/small-batch-product-gtm.mjs) | 用户只要 1-3 个 Product/GTM 强线索 |
| [执行预算](../sifta-search/references/execution-budget.md) | 控制 CLI 次数、延迟和重复搜索 |
| [CLI 合同](../sifta-search/references/cli-reference.md) | 调用 LinkedIn 连接器、auth/status/schema 失败 |
| [查询规则](../sifta-search/references/query-contract.md) | 写 LinkedIn/Product/GTM query 或拆多来源反馈 |
| [来源地图方案](../sifta-search/references/source-map-recipes.md) | 公司地图、相邻公司池或 DevRel 社区证据 |
| [状态门槛](../sifta-search/references/project-brief-and-state.md) | 公司/赛道线索升级候选前 |
| [适配证明](../sifta-search/references/fit-proof-packet.md) / [输出规则](../sifta-search/references/output-quality.md) | 输出候选表和覆盖风险 |
