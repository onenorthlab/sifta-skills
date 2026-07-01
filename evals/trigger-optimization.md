# sifta-search 触发优化记录（description optimization）

用 skill-creator 的 `run_loop.py` 对 `sifta-search`（分流入口）的 description 做触发优化。追溯用，供汇报引用。

## 2026-06-30 · 第一轮（诚实负结果）

- **方法**：eval set `evals/trigger-eval-sifta-search.json`（10 正例 + 10 负例，均为有迷惑性的边界，已 Owner 签字）。`run_loop.py --model claude-opus-4-8 --max-iterations 5 --runs-per-query 3 --holdout 0.4`（训练 12 / 测试 8，每条跑 3 次）。
- **结果**：`best_description == original_description`——**5 轮迭代没有任何候选跑赢原始描述**。best_train 6/12、best_test 4/8。
- **为什么分低 = 评测信号无效，不是描述差**：逐条看，**所有"该触发"的正例触发率都是 0/3**（"帮我找搞 llm 推理优化的大佬""组 AI Agent 团队物色人""盘 AI coding 创始人"这种教科书级找人请求都没触发）。6/12 分**全来自负例正确地不触发**。即在这个 `claude -p` 测试环境里 **skill 对任何 query 都没被 consult**（正例也不触发）——评测只能测出"负例没触发"，无法区分描述质量。
- **判断**：这是**无效量化信号**，不是描述质量结论。可能原因：①`claude -p` 对"找人"这类看似简单的请求倾向直接处理、不 consult skill（skill-creator 明确警告的 undertriggering 效应）；②测试环境的 skill 安装/检出方式使触发检测失灵。负例全过是"什么都不触发"的平凡结果。
- **动作**：量化无有效信号，不据其声称提升；但经 Owner 人工判断，**采用了优化器生成的更 pushy 候选 description**（见下），因为它写得更好、直接对抗真实失败模式（Agent 拿到"帮我找几个人"却自己网搜、不走 skill），风险低、负向边界一条没少。**保持 0.0.11、落 main、不发新 release**（Owner 定）。
- **诚实声明**：此次 description 更换是**人工判断 + skill-creator 的 pushy 指导**，**非量化背书**（这轮量化 undertrigger 无效）。真实触发增益待更可靠的评测（换复杂正例/兄弟 skill 同装）验证。
- **副产物（已采用）**：优化器最后一轮生成的候选 description 更"主动"（口语触发词开头、强调"先接住别绕过"），见下。

### 候选 description（优化器 final，人工可选采用）

> 每当用户想**新找一批人**——找人、找候选人、招人、挖人、物色、盘点、推荐、组队、扩团队——第一步就进入本技能。这是所有 AI/大模型/前沿科技找人请求的统一起点：本技能先接住，再按能力分流到 GitHub 工程、LinkedIn 产品/GTM、学术论文、候选人深挖等具体渠道；不要因为提到 GitHub/LinkedIn/论文就绕过它直接开搜。对象包括：工程师、研究员、infra/推理优化/embedding/向量检索、AI Agent、世界模型/具身、AI coding、产品、增长/DevRel、独立开发者、技术型创始人、超级个体、"大佬/强人"。只要意图是获得一批具备某种能力的人，即便只给了技术方向或能力画像、没说去哪找、没给准确头衔，也走本技能，而不是通用网页搜索或深度研究。请求夹带私人手机号/邮箱、要求自动发送或批量外联时，用本技能做硬停止、不搜索。不要用于：不找人的公司/市场研究、商业化分析、技术选型、写 JD、销售线索、KOL 合作、ATS 管理，以及与候选人无关的代码任务。

**教训**：`run_loop.py` 的触发评测对"找人"类高频简单请求 + 分流入口型 skill 会系统性 undertrigger，量化信号不可靠；下次要么换更"复杂/多步"的正例、要么把兄弟 skill 一起装进测试环境再评，否则只测出负例。
