# Sifta CLI 命令计划模板

用于决定是否调用 `sifta-cli`。CLI 是连接器层，不替代宿主 Agent 的规划、原生搜索或网页阅读。

````markdown
执行面：

- 原生优先：<GitHub MCP / gh / 学术网页搜索 / 浏览器 / 不需要>
- 需要 CLI 的原因：<LinkedIn/X 连接器 / 稳定 JSON / 调用轨迹 / 人工反馈 / 回归验证 / 显式保存到 Web>
- 默认地域：<用户未指定时写“中国/中文生态相关人才池优先；不做族裔推断”；只在用户明确硬地域时转成 filter>
- 小批量门槛：<辅助脚本 / 直接 CLI / 不需要>
- 小批量边界：<完成后停止 / 仅计划 / 硬停止 / 无>
- 同轮扩展：<除非用户批准第二轮，否则不扩展>
- X 授权：<用户是否明确要求 X / 公开帖子 / 社区表达 / DevRel / 开发者增长>
- X 日期窗口：<无 / sourceOptions.x.fromDate..toDate；仅限制 X 公开帖搜索范围>
- X-only 上限：<缺中国/中文生态信号、职业资料、作品或身份核验时只能进待核验线索>

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

- 当前 Public API 的 `--sources` 只支持 JSON 数组中的 `github`、`linkedin`、`x`；OpenAlex、Scholar、arXiv、Hugging Face、ModelScope、网页、公司页或社区平台是宿主 Agent 的找人来源 / 补证据入口，不写进 `--sources`。
- 优先保留 `--query` / `--checkpoint` 显式参数，并用 `--input '<结构字段 JSON>'` 传 `sourceOptions`，避免 skill 依赖某个 CLI 小版本；新版 CLI 的 `--source-options` 只是便利别名。
- `sourceOptions` 当前只支持 `{"x":{"fromDate":"YYYY-MM-DD","toDate":"YYYY-MM-DD"}}`。不要新增或建议 X 专属命令。
- 学术 `--mode research` 只用于 direct connector 的默认来源选择、结构化调用轨迹和结果组织；不是独立 OpenAlex/Scholar/arXiv connector。
- 缺省地域要进入项目简报、`--checkpoint` 和候选人升级门槛；GitHub 查询不加入地域叙述，LinkedIn/Product/GTM 和学术找人来源可加入自然语言地域/市场偏置。
- CLI 只是薄连接器层：提供 Public API 工具访问、结构化 JSON、schema、trace、warnings、feedback 和可选保存；不要把 skill workflow 再封装成 CLI 里的第二套 sourcing agent。
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
````
