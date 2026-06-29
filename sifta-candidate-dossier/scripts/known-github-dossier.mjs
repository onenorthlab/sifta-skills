#!/usr/bin/env node

import { execFileSync } from "node:child_process";

function parseArgs(argv) {
	const args = {
		github: "",
		repo: "",
		query: "",
		maxRepos: 5,
		maxPrs: 3,
	};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const next = argv[index + 1];
		if ((arg === "--github" || arg === "--github-url" || arg === "--github-login") && next)
			args.github = next;
		if (arg === "--repo" && next) args.repo = next;
		if (arg === "--query" && next) args.query = next;
		if (arg === "--max-repos" && next) args.maxRepos = Number(next);
		if (arg === "--max-prs" && next) args.maxPrs = Number(next);
		if (arg.startsWith("--")) index += 1;
	}
	return args;
}

function loginFrom(value) {
	const match = String(value).match(/github\.com\/([^/?#]+)/i);
	return (match ? match[1] : value).replace(/^@/, "");
}

function ghJson(endpoint) {
	const stdout = execFileSync("gh", ["api", endpoint], {
		encoding: "utf8",
		maxBuffer: 8 * 1024 * 1024,
		timeout: 20_000,
	});
	return JSON.parse(stdout);
}

function safeGhJson(endpoint) {
	try {
		return ghJson(endpoint);
	} catch (error) {
		return { error: String(error.message ?? error) };
	}
}

function mdEscape(value) {
	return String(value ?? "")
		.replace(/\|/g, "\\|")
		.replace(/\n/g, " ")
		.trim();
}

function truncate(value, maxLength = 180) {
	const text = mdEscape(value);
	return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function markdownLink(label, url) {
	const href = mdEscape(url);
	return href ? `[${label}](${href})` : "-";
}

function linkifyKnownGitHubUrls(value) {
	return mdEscape(value).replace(/https:\/\/github\.com\/([A-Za-z0-9_.-]+)/gu, (_match, handle) =>
		markdownLink("GitHub", `https://github.com/${handle}`),
	);
}

function scrubContactValues(value) {
	return String(value ?? "")
		.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu, "[公开 contact 字段]")
		.replace(
			/open to (new )?opportunities|open to work/giu,
			"[公开 profile 开放机会相关表述，需触达前确认]",
		);
}

const args = parseArgs(process.argv.slice(2));
const login = loginFrom(args.github);

if (!login) {
	process.stdout.write(
		[
			"# 已知 GitHub 候选人档案",
			"",
			"结论",
			"",
			"- 当前输入缺少可消歧的 GitHub login，无法完成候选人档案；本轮不建议推进候选人。",
			"- 默认地域/市场：中国/中文生态相关人才池优先；只看公开职业信号，不凭姓名、照片、族裔或国籍推断。",
			"",
			"人选和证据",
			"",
			"| 分桶 | 人选 / 线索 | 招聘判断 | 为什么值得聊 | 把握 | 证据来源 | 下一步 | 链接 |",
			"| --- | --- | --- | --- | --- | --- | --- | --- |",
			"| 暂无推荐 | 用户输入 | 本轮不推进 | 缺少可消歧个人资料 | 低 | GitHub 个人资料未执行 | 补 profile 后重试 | - |",
			"",
			"风险和待核验",
			"",
			"| 类型 | 内容 | 为什么重要 | 怎么确认 |",
			"| --- | --- | --- | --- |",
			"| 待核验线索 | 用户输入 | 深挖任务需要个人资料入口 | 请补一个可消歧 profile |",
			"| 覆盖风险 | 没有可消歧个人资料时不能继续深挖 | 防止同名误合并 | 补 GitHub、LinkedIn、个人主页、公司或地点线索 |",
			"| 停止原因 | 缺少可消歧 GitHub login | 不能用搜索猜测同名候选人 | 补 profile 后重试 |",
			"| 执行边界 | 本轮不搜索同名候选人、不查询私人联系方式、不自动触达 | 避免越界 | 用户补可消歧资料后继续 |",
			"",
			"下一步",
			"",
			"- 请补一个 GitHub、LinkedIn、个人主页、公司或地点线索。",
			"",
		].join("\n"),
	);
	process.exit(0);
}

const user = safeGhJson(`users/${encodeURIComponent(login)}`);
const repos = safeGhJson(
	`users/${encodeURIComponent(login)}/repos?per_page=${args.maxRepos}&sort=updated`,
);
let prs = [];
if (args.repo) {
	const result = safeGhJson(
		`search/issues?q=author:${encodeURIComponent(login)}+repo:${args.repo}+is:pr&per_page=${args.maxPrs}`,
	);
	prs = Array.isArray(result.items) ? result.items : [];
}

const publicRepos = Array.isArray(repos) ? repos : [];
const githubProfileLink = markdownLink("GitHub", user?.html_url || `https://github.com/${login}`);
const publicContactSignal = user?.email
	? "GitHub profile 公开 contact 字段存在"
	: "未找到公开职业联系方式";
const lines = [
	"# 已知 GitHub 候选人档案",
	"",
	"结论",
	"",
	`- 深挖对象：${markdownLink("GitHub", `https://github.com/${login}`)}`,
	`- 深挖目标：${linkifyKnownGitHubUrls(args.query || "已知 GitHub 候选人档案")}`,
	"- 默认地域/市场：中国/中文生态相关人才池优先；只看公开职业信号，不凭姓名、照片、族裔或国籍推断。",
	`- 本轮边界：只用公开 GitHub 资料和可选仓库焦点（${mdEscape(args.repo || "无")}），不继续找新人、不自动触达。`,
	"",
	"人选和证据",
	"",
	"| 分桶 | 人选 / 线索 | 招聘判断 | 为什么值得聊 | 把握 | 公开证据 | 下一步 | 链接 |",
	"| --- | --- | --- | --- | --- | --- | --- | --- |",
];

if (user.error) {
	lines.push(
		`| 暂无推荐 | ${mdEscape(login)} | GitHub 资料读取失败 | ${mdEscape(user.error)} | 低 | GitHub profile 未能读取 | 修复认证或 login 后重试 | [GitHub](https://github.com/${mdEscape(login)}) |`,
	);
} else {
	lines.push(
		`| 建议先核实 | ${mdEscape(user.name || user.login)} (${mdEscape(user.login)}) | 先确认是否是目标人选，再判断适合全职、顾问还是推荐人推进 | 有可访问 GitHub 公开资料，需继续核验职业资料和项目归属 | 中 | GitHub profile、公开简介、公司、地点、公开仓库样本 | 补职业资料和项目归属证据 | [GitHub](${mdEscape(user.html_url)}) |`,
	);
}

lines.push(
	"",
	"风险和待核验",
	"",
	"| 类型 | 内容 | 为什么重要 | 怎么确认 |",
	"| --- | --- | --- | --- |",
);

for (const repo of publicRepos.slice(0, args.maxRepos)) {
	lines.push(
		`| 待核验线索 | Repo: ${mdEscape(repo.full_name)}；stars=${repo.stargazers_count}；updated=${repo.updated_at} | 可作为工程活跃度和项目方向入口，但不能证明角色或可用性 | 核 README、commit/PR 和项目 ownership |`,
	);
}

for (const pr of prs.slice(0, args.maxPrs)) {
	lines.push(
		`| 待核验线索 | PR: ${truncate(pr.title, 120)} | 可作为公开贡献入口，但不能证明完整贡献深度 | 核合并状态、讨论和代码贡献范围 |`,
	);
}

if (!publicRepos.length && !prs.length) {
	lines.push(
		"| 覆盖风险 | 预算内没有公开 GitHub 项目证据 | 需要另一个公开个人资料或仓库焦点 | 补 profile / repo 后重试 |",
	);
}

lines.push(
	user.error
		? `| 适配缺口 | ${mdEscape(login)} | GitHub 资料读取失败，无法确认候选人适配 | 确认 login 或认证状态后重试 |`
		: `| 适配证明 | ${mdEscape(user.name || user.login)} (${mdEscape(user.login)}) | ${linkifyKnownGitHubUrls(args.query || "已知候选人公开个人资料审查")}；GitHub profile：${githubProfileLink}；公开简介/公司/地点：${truncate(scrubContactValues([user.bio, user.company, user.location].filter(Boolean).join(" / ") || "未公开"))}；公开职业渠道：${publicContactSignal} | 用户后续批准后：必要时核验职业资料或项目归属 |`,
	"| 覆盖风险 | 本轮只基于有限 GitHub 公开证据 | 不代表完整找人质量证明，候选人相关性仍需人工审查 | 补 LinkedIn、个人主页或项目归属证据 |",
	"| 执行边界 | 不查询私人邮箱、手机号、非公开联系方式，不自动发送消息或提交表单 | 公开职业渠道只限候选人本人公开 profile 字段；不把开放机会字样写成求职意愿结论 | 不猜邮箱格式，也不补私人联系方式 |",
	"| 停止原因 | 已知 GitHub 档案脚手架到这里停止 | 进入触达前必须补职业资料、同人身份和项目归属核验 | 用户确认后再继续 |",
	"",
	"下一步",
	"",
	"- 用户确认后，必要时核验 LinkedIn、个人主页或项目归属；不要自动触达或发送消息。",
);

process.stdout.write(`${lines.join("\n")}\n`);
