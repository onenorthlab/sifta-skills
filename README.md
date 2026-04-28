# Sifta Skills

面向 AI 招聘候选人 sourcing 的 agent skills。

这个仓库包含可在 OpenClaw、Claude Code、Codex 中使用的 Sifta skills，也适用于其他支持 `SKILL.md` 标准的 agent。

## 安装

推荐用 `skills` CLI 全局安装：

```bash
npx skills add onenorthkaton/sifta-skills -y -g
```

然后安装 Sifta CLI：

```bash
npm install -g @sifta/cli@latest
```

配置 API key：

```bash
sifta-cli auth "<SIFTA_API_KEY>" --base-url https://siftapi.onenorthdev.com
```

检查状态：

```bash
sifta-cli status
```

安装或认证完成后，重启 OpenClaw、Claude Code、Codex，或开启一个新会话。

## 手动安装

如果当前 agent 暂不支持 `npx skills add`，可以手动复制 skill 目录。

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

### OpenClaw

把 `sifta-search/` 复制到 OpenClaw 的 skills 目录，然后重启会话。

## 可用 Skill

| Skill | 作用 |
| --- | --- |
| [`/sifta-search`](sifta-search/) | 搜索、筛选和补全 AI 招聘候选人的公开 profile 与证据 |

## 卸载

卸载 Sifta CLI：

```bash
npm uninstall -g @sifta/cli
```

删除本地 CLI 配置：

```bash
rm -rf ~/.sifta-cli
```

删除已安装的 skill：

```bash
rm -rf ~/.codex/skills/sifta-search
rm -rf ~/.agents/skills/sifta-search
rm -rf ~/.claude/skills/sifta-search
```

如果使用了项目内安装，也删除对应项目里的 skill 目录：

```bash
rm -rf .claude/skills/sifta-search
```

卸载后重启 agent，或开启一个新会话。

## 常见问题

**找不到 `sifta-cli`？** 执行 `npm install -g @sifta/cli@latest`。

**未认证？** 执行 `sifta-cli auth "<SIFTA_API_KEY>" --base-url https://siftapi.onenorthdev.com`。

**Skill 没有出现？** 确认 `sifta-search/SKILL.md` 直接位于 agent 的 skills 目录下，然后重启 agent。
