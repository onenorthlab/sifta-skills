# Sifta Skills

> 面向 AI 招聘的候选人 sourcing 能力，以 agent skill 的形式提供。

这个仓库包含可在 OpenClaw、Claude Code、Codex 中使用的 Sifta skills，也适用于其他支持 `SKILL.md` 标准的 agent。

## 快速开始

1. 向 Sifta 团队获取 API key。

2. 安装 skills：

   ```bash
   npx skills add onenorthkaton/sifta-skills -y -g
   ```

3. 安装 Sifta CLI：

   ```bash
   npm install -g @sifta/cli@latest
   ```

4. 配置认证：

   ```bash
   sifta-cli auth "<SIFTA_API_KEY>" --base-url https://siftapi.onenorthdev.com
   ```

5. 重启 OpenClaw、Claude Code 或 Codex，然后发起候选人搜索请求。

## 支持的 Agent

| Agent | 安装方式 |
| --- | --- |
| OpenClaw | 推荐使用 `npx skills add onenorthkaton/sifta-skills -y -g` |
| Claude Code | 推荐使用 `npx skills add onenorthkaton/sifta-skills -y -g`，也可手动复制到 `.claude/skills` |
| Codex | 推荐使用 `npx skills add onenorthkaton/sifta-skills -y -g`，也可手动复制到 `~/.codex/skills` |

## 可用 Skill

| Skill | 作用 |
| --- | --- |
| [`/sifta-search`](sifta-search/) | 搜索、筛选和补全 AI 招聘候选人的公开 profile 与证据 |

## 看它如何工作

```text
用户：/sifta-search

Agent：我先检查 Sifta CLI 是否可用。

       Bash(sifta-cli status)
       -> Error: command not found: sifta-cli

       未找到 CLI，先安装。

       Bash(npm install -g @sifta/cli@latest)
       Bash(sifta-cli status)
       -> not authenticated

       Sifta CLI 已安装，但还未认证。请配置 API key：
       sifta-cli auth "<SIFTA_API_KEY>" --base-url https://siftapi.onenorthdev.com

用户：帮我找 10 个上海做 LLM observability 的 AI infra 工程师，优先 GitHub 有公开项目的人。

Agent：Bash(sifta-cli find-people \
         --query "上海 AI infra 工程师 LLM observability GitHub 公开项目" \
         --filter '{"titles":["AI Engineer","Infrastructure Engineer"],"skills":["LLM observability"],"locations":["Shanghai"]}' \
         --sources '["github"]' \
         --target-count 10)
       -> {"people":[...],"warnings":[]}

       找到以下有公开证据的候选人：
       1. <name> - GitHub profile、匹配项目、关键证据、风险提示
       2. <name> - GitHub profile、匹配项目、关键证据、风险提示
       ...
```

## 手动安装

如果你的 agent 暂不支持 `npx skills add`，可以手动复制 skill 目录。

### OpenClaw

把 `sifta-search/` 复制到 OpenClaw 的 skills 目录，然后重启会话。

### Claude Code

全局安装：

```bash
git clone https://github.com/onenorthkaton/sifta-skills.git /tmp/sifta-skills
mkdir -p "$HOME/.claude/skills"
cp -R /tmp/sifta-skills/sifta-search "$HOME/.claude/skills/"
```

项目内安装：

```bash
mkdir -p .claude/skills
cp -R /tmp/sifta-skills/sifta-search .claude/skills/
```

### Codex

```bash
git clone https://github.com/onenorthkaton/sifta-skills.git /tmp/sifta-skills
mkdir -p "${CODEX_HOME:-$HOME/.codex}/skills"
cp -R /tmp/sifta-skills/sifta-search "${CODEX_HOME:-$HOME/.codex}/skills/"
```

手动安装后需要重启 agent，或开启一个新会话。

## CLI 配置

`sifta-search` 通过 `sifta-cli` 调用 Sifta API。agent 本地只需要 Sifta CLI 和 Sifta API key。

GitHub、Exa、TwitterAPI、TikHub、数据库和模型供应商密钥都保存在 Sifta API 服务端。不要向用户索取这些供应商密钥。

也可以通过环境变量配置认证：

```bash
export SIFTA_API_KEY="<SIFTA_API_KEY>"
export SIFTA_API_BASE_URL="https://siftapi.onenorthdev.com"
```

检查状态：

```bash
sifta-cli status
```

## 适用场景

`/sifta-search` 适用于 AI 招聘 sourcing：

- AI 工程师、LLM 工程师、AI infra 工程师、AI 应用开发者
- 机器人、自动驾驶、具身智能、感知、控制、仿真人才
- 独立开发者、一人公司、solo builder、AI startup founder
- AI 产品经理、GTM、增长、developer marketing、出海营销人才
- 有论文、arXiv、Google Scholar 或类似公开证据的研究型人才

不要把它当作通用找人、销售线索、公司情报、KOL 合作或 ATS 工具使用。

## 卸载

```bash
npm uninstall -g @sifta/cli
rm -rf ~/.sifta-cli
rm -rf ~/.codex/skills/sifta-search ~/.agents/skills/sifta-search ~/.claude/skills/sifta-search
```

## 数据与隐私

- 数据来源：Sifta API 返回的公开候选人 profile 和公开证据。
- 查询日志：Sifta 可能记录搜索请求，用于调试、滥用防护和产品改进。
- 使用责任：请遵守适用的招聘、隐私和劳动相关法律。
- 不要编造私人信息，例如个人邮箱、电话、薪资、搬迁意愿或在职状态；除非 API 返回了带证据的数据。

## 常见问题

**找不到 CLI？** 执行 `npm install -g @sifta/cli@latest`。

**未认证？** 执行 `sifta-cli auth "<SIFTA_API_KEY>" --base-url https://siftapi.onenorthdev.com`。

**Skill 没有出现？** 确认 `sifta-search/SKILL.md` 直接位于 agent 的 skills 目录下，然后重启 agent。

**没有返回候选人？** 调整查询：放宽 title、去掉地点、切换来源，或补充更明确的公开证据关键词。

## 链接

- 仓库：[github.com/onenorthkaton/sifta-skills](https://github.com/onenorthkaton/sifta-skills)
- Skill：[`sifta-search/`](sifta-search/)
