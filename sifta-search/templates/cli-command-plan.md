# Sifta CLI 命令计划模板

用于决定是否调用 `sifta-cli`。CLI 是连接器层，不替代宿主 Agent 的规划、原生搜索或网页阅读。

~~~markdown
执行面：
- 原生优先：<GitHub MCP / gh / 学术网页搜索 / 浏览器 / 不需要>
- 需要 CLI 的原因：<LinkedIn/Exa/X 连接器 / 稳定 JSON / 调用轨迹 / 人工反馈 / 回归验证 / 已知个人资料补全>
- 默认地域：<用户未指定时写“中国/中文生态相关人才池优先；不做族裔推断”；只在用户明确硬地域时转成 filter>
- 小批量门槛：<辅助脚本 / 直接 CLI / 不需要>
- 小批量边界：<完成后停止 / 仅计划 / 硬停止 / 无>
- 同轮扩展：<除非用户批准第二轮，否则不扩展>

预检：
```bash
sifta-cli status
```

命令：
```bash
sifta-cli find-people \
  --query "<符合来源合同的查询>" \
  --checkpoint "<用户本轮原始目标>" \
  --sources '<适用时填写来源 JSON 数组，例如 ["github"] 或 ["linkedin"]>' \
  --target-count 10
```

说明：
- 学术研究模式可以使用研究轨迹 / 来源地图路径，不一定使用 `--sources`。
- 只有当前 CLI 结构明确不接受 `--sources` 时才省略。
- 缺省地域要进入项目简报、`--checkpoint` 和候选人升级门槛；GitHub 查询不加入地域叙述，LinkedIn/Product/GTM 和学术来源地图可加入自然语言地域/市场偏置。
- CLI 只是薄连接器层：提供 Exa、LinkedIn、X、后续 ATS/CRM 或 direct API 的工具访问、结构化 JSON、schema、trace 和 warnings；不要把 skill workflow 再封装成 CLI 里的第二套 sourcing agent。
- GitHub 不因为 token 成为 CLI 必经路径；优先使用宿主 Agent、`gh`、GitHub MCP 或用户自己的 `GH_TOKEN` / `GITHUB_TOKEN`。额度或认证不足时，提示用户配置宿主 GitHub 凭据。
- 如果辅助脚本完成、失败或返回 0 人，基于该输出整理用户报告，本轮不要继续搜索。
- 最终用户答复不要输出停止标记、脚本名、命令、参数、events、timing 或 `target-count`。

预期 JSON 字段：
- `people`
- `searchStrategy`
- `sourceMap`
- `evidenceLog`
- `crmExport`
- `warnings`

解析说明：
- 先完成当前任务，再处理 `_notice.update`。
- 不要把 `--pretty` 用于 Agent 解析；它只适合人工查看。
- 不要推荐 `sifta-cli search`；当前搜索命令是 `sifta-cli find-people`。
~~~
