# Sifta 工作流模式

这些模式用于指导 agent 在 AI 行业垂直招聘 sourcing 场景中选择命令、组织查询和解释结果。
Sifta 当前只覆盖候选人搜索、候选人补全和候选人评估；不要扩展成公司情报、销售线索、
ATS 管理、触达或 KOL 合作。

## 目录

- [1. AI 工程师和开发者](#1-ai-工程师和开发者)
- [2. 具身智能人才](#2-具身智能人才)
- [3. 超级个体和创始人](#3-超级个体和创始人)
- [4. AI 产品经理](#4-ai-产品经理)
- [5. GTM/GMT 和出海营销](#5-gtmgmt-和出海营销)
- [6. 研究型人才](#6-研究型人才)
- [7. 已知 profile 或 handle 补全](#7-已知-profile-或-handle-补全)
- [8. 搜索后筛选与 review](#8-搜索后筛选与-review)
- [9. 无结果或弱结果恢复](#9-无结果或弱结果恢复)

## 1. AI 工程师和开发者

覆盖 AI Agent 开发、LLM 开发、视频大模型、语音模型、AI infra 和应用层工程师。
“研发岗”“开发者”“开发工程师”“模型/infra/应用层工程师”等工程型表述必须显式使用
`--sources '["github"]'`；代码、开源、SDK、框架、runtime、observability、agent infra
是更强的 GitHub 信号。只有当用户明确指定使用 LinkedIn 搜索时，才切换到 LinkedIn。

```bash
sifta-cli find-people --query "AI Agent engineer LLM infra open source evidence TypeScript Python" \
  --checkpoint "找 AI Agent 开发、LLM infra、开源项目证据强的工程师" \
  --sources '["github"]' \
  --target-count 10
```

如果用户给出公司或地点偏好，把明确条件写入 filter：

```bash
sifta-cli find-people --query "video generation multimodal diffusion text-to-video" \
  --checkpoint "找视频大模型工程师，多模态生成，公开项目或论文证据" \
  --filter '{"titles":["AI Engineer","ML Engineer"],"skills":["video generation","multimodal"],"locations":["China"]}' \
  --sources '["github"]' \
  --target-count 10
```

验证方式：

- 优先引用 GitHub repo、贡献、项目说明、profile summary 和 `matchReasons`。
- 区分 AI infra 与应用层；只凭关键词命中时标为弱证据。
- 不要推断候选人当前求职意愿。

## 2. 具身智能人才

覆盖机器人、自动驾驶、感知、控制、仿真、VLA、具身模型相关工程师或岗位。职业经历和论文
通常同等重要，默认 GitHub + LinkedIn；论文证据明显重要时使用 research mode。

```bash
sifta-cli find-people --query "具身智能 机器人 VLA control simulation engineer GitHub LinkedIn evidence" \
  --checkpoint "找具身智能方向人才，机器人/VLA/仿真/控制都可以，有公开工程或职业证据" \
  --target-count 10
```

论文导向：

```bash
sifta-cli find-people --query "embodied AI robotics VLA researcher engineer paper evidence" \
  --checkpoint "找具身智能方向研究型或工程型人才，优先论文和公开 profile 证据" \
  --mode research \
  --target-count 10
```

验证方式：

- 区分机器人/自动驾驶/仿真/控制/大模型方向，不要把泛 AI 工程师直接包装成具身智能。
- 如果只有论文作者但缺少工程 profile，说明这是研究线索，不要包装成完整候选人。
- 如果公司或实验室名称有多义，先在结果解释里标注不确定性。

## 3. 超级个体和创始人

覆盖独立开发者、一人公司、solo builder、founder、co-founder、自己运营 AI 产品的人。
这类画像常常不是标准 title；把自建产品、公开作品、项目链接、产品运营证据保留在 query。

```bash
sifta-cli find-people --query "AI solo founder indie hacker independent developer building AI product GitHub public product evidence" \
  --checkpoint "找 AI solo founder、独立开发者或一人公司，有自建 AI 产品或 GitHub 作品" \
  --sources '["github"]' \
  --target-count 10
```

Founder 更偏职业背景时：

```bash
sifta-cli find-people --query "AI startup founder co-founder building AI agent product public profile" \
  --checkpoint "找 AI startup founder/co-founder，自己在做 AI agent 产品，有公开 profile" \
  --sources '["linkedin"]' \
  --target-count 10
```

验证方式：

- 证据应指向自建产品、公开 repo、产品主页、founder/co-founder 公开身份或长期维护项目。
- 不要把“个人影响力大”当作超级个体证据；需要作品或产品证据。
- 如果结果更像 KOL/创作者合作对象，而不是招聘候选人，要明确降级或剔除。

## 4. AI 产品经理

覆盖 AI 产品经理、大模型产品、Agent 产品、字节产品经理、Qwen 或大模型团队相关 PM。
优先 LinkedIn；GitHub 通常只是辅助信号。

```bash
sifta-cli find-people --query "AI product manager LLM product ByteDance Qwen agent product experience" \
  --checkpoint "找 AI 产品经理，做过大模型、Agent 产品，或有字节/Qwen 相关经历" \
  --sources '["linkedin"]' \
  --target-count 10
```

更明确的团队背景：

```bash
sifta-cli find-people --query "Qwen team product manager 大模型产品 Agent 产品 experience" \
  --checkpoint "找 Qwen 团队相关产品经理，有大模型产品或 Agent 产品经验" \
  --sources '["linkedin"]' \
  --target-count 10
```

验证方式：

- 引用 headline、工作经历、产品方向和团队背景；不要用普通 PM 直接替代 AI PM。
- Qwen、字节等团队线索需要公开 profile 支撑；没有明确证据时写成“可能相关”。
- 如果用户要求竞品产品分析，说明那不是本 skill 主路径。

## 5. GTM/GMT 和出海营销

覆盖 GTM/GMT、出海营销、增长、AI 产品营销、developer marketing、社区增长。优先 LinkedIn；
如果用户给出公开 handle，可用 enrichment 补全公开内容信号。

```bash
sifta-cli find-people --query "AI GTM GMT go-to-market overseas marketing growth developer marketing AI product" \
  --checkpoint "找 AI GTM/GMT、出海营销或增长人才，做过 AI 产品或 developer marketing" \
  --sources '["linkedin"]' \
  --target-count 10
```

Developer marketing / community growth：

```bash
sifta-cli find-people --query "AI developer marketing community growth DevRel GTM open source product" \
  --checkpoint "找 AI developer marketing、社区增长或 DevRel 人才，有开源或开发者产品经验" \
  --sources '["linkedin"]' \
  --target-count 10
```

验证方式：

- 区分招聘候选人与 KOL 合作对象；本 skill 只输出可招聘的人才线索。
- 引用增长、出海、开发者社区、AI 产品营销等职业证据。
- 不要输出报价、投放建议或商业合作判断。

## 6. 研究型人才

覆盖专注学术、论文发表、arXiv/Google Scholar 证据的人才。使用 `--mode research`，
但最终仍要说明候选人是否可作为招聘线索。

```bash
sifta-cli find-people --query "RAG evaluation agent benchmark researcher engineer paper evidence GitHub profile" \
  --checkpoint "找 RAG evaluation 和 agent benchmark 研究型人才，有论文或公开工程证据" \
  --mode research \
  --target-count 10
```

更偏模型方向：

```bash
sifta-cli find-people --query "speech model researcher LLM paper author engineer public profile" \
  --checkpoint "找语音模型或 LLM 方向研究型人才，有论文作者和公开 profile 证据" \
  --mode research \
  --target-count 10
```

验证方式：

- 区分论文作者证据、工程 profile 证据和招聘可用性。
- 如果只找到论文作者但没有公开职业/profile 线索，说明它只是研究线索。
- 不要编造邮箱、机构归属或当前在职状态。

## 7. 已知 profile 或 handle 补全

用户给出 GitHub、LinkedIn、Twitter/X、小红书 URL 或 handle，且目标仍是上述 AI 行业招聘画像时，
使用 `enrich-people`。每次最多 10 人。

```bash
sifta-cli enrich-people \
  --people '[{"githubUrl":"https://github.com/example"},{"linkedinUrl":"https://www.linkedin.com/in/example/"}]'
```

只知道姓名时，尽量补充公司、地点或画像以减少重名：

```bash
sifta-cli enrich-people \
  --people '[{"name":"张三","company":"某 AI 公司","location":"上海"}]' \
  --sources '["linkedin"]'
```

验证方式：

- 只汇报返回 JSON 中存在的 profile、证据、公开联系方式和 warnings。
- 不要把重名候选人当作同一人。
- 如果 profile 不是 AI 行业招聘画像，直接说明不匹配。

## 8. 搜索后筛选

先用 `find-people` 得到候选人，再基于返回证据人工式 triage。

```bash
sifta-cli find-people --query "AI Agent engineer infra open source Shanghai" \
  --checkpoint "上海 AI Agent 工程师，偏 infra，有开源项目" \
  --target-count 10
```

Triage 规则：

- 强匹配：画像、岗位/方向、技术或业务信号和公开证据都清楚，直接保留。
- 弱匹配：只命中少量关键词或证据不足，标注风险。
- 不匹配：不属于当前 AI 行业画像，或行业/方向明显不符，直接剔除。
- 模糊：部分匹配但证据不足，标注为可能匹配并说明需要人工核验。

验证方式：

- 不要让候选人的弱关键词命中覆盖缺失证据。
- 所有判断都必须能追溯到返回的 `profileUrl`、`matchReasons`、`raw.evidences` 或 `riskFlags`。

## 9. 无结果或弱结果恢复

当搜索没有返回候选人或结果质量弱时，先调整查询，不要立即得出否定结论。

优先调整顺序：

1. 放宽 title，例如从 `Staff AI Infra Engineer` 放宽到 `AI Engineer`。
2. 放宽画像中的非核心要求，例如先找 AI Agent 工程师，再人工筛 infra。
3. 放宽地点，例如从城市放宽到国家、地区或 remote。
4. 切换来源，例如 LinkedIn 结果弱时尝试 GitHub，反之亦然。
5. 研究型人才或具身智能论文证据相关时切换到 `--mode research`。

示例：

```bash
sifta-cli find-people --query "China AI engineer agent LLM platform public project experience" \
  --checkpoint "中国 AI 工程师，有 agent、LLM 平台或公开项目经验" \
  --target-count 10
```

验证方式：

- 向用户说明“这次搜索没有返回候选人”或“证据较弱”，不要说“没有这种人”。
- 给出一个具体的下一步查询，而不是泛泛建议“扩大范围”。
