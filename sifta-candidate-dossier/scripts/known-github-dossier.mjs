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

const args = parseArgs(process.argv.slice(2));
const login = loginFrom(args.github);

if (!login) {
	process.stdout.write(
		[
			"# 已知 GitHub 候选人档案",
			"",
			"项目简报",
			"",
			"- 当前输入缺少可消歧的 GitHub login，无法完成候选人档案。",
			"",
			"来源地图",
			"",
			"| 来源 | 看什么 | 本轮怎么用 |",
			"| --- | --- | --- |",
			"| GitHub 个人资料 | login、公开简介、公开仓库、公开邮箱字段 | 输入缺少可消歧 login，未执行 |",
			"",
			"候选人分桶",
			"",
			"| 分桶 | 人选 | 现在做什么 | 为什么值得聊 | 把握 | 还要确认 | 链接 |",
			"| --- | --- | --- | --- | --- | --- | --- |",
			"| 暂无推荐 | - | - | 缺少可消歧个人资料 | 低 | 需要补充 GitHub、LinkedIn、个人主页、公司或地点线索 | - |",
			"",
			"待核验线索",
			"",
			"| 线索 | 为什么相关 | 还差什么 | 下一步怎么确认 |",
			"| --- | --- | --- | --- |",
			"| 用户输入 | 深挖任务需要个人资料入口 | 缺少 GitHub login 或 URL | 请补一个可消歧 profile |",
			"",
			"适配证明包",
			"",
			"| 人选 / 线索 | 为什么符合需求 | 公开证据 | 把握 | 还要确认 | 下一步 |",
			"| --- | --- | --- | --- | --- | --- |",
			"| - | 无法建档 | 未执行 | 低 | 可消歧个人资料 | 补 profile 后重试 |",
			"",
			"覆盖风险",
			"",
			"- 没有可消歧个人资料时不能继续深挖，也不能用搜索猜测同名候选人。",
			"",
			"停止条件",
			"",
			"- 缺少可消歧 GitHub login，本轮停止。",
			"",
			"执行合同",
			"",
			"- 本轮不搜索同名候选人，不查询私人联系方式，不自动触达。",
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
const lines = [
	"# 已知 GitHub 候选人档案",
	"",
	"项目简报",
	"",
	`- 输入：${mdEscape(args.github)}`,
	`- 深挖目标：${mdEscape(args.query || "已知 GitHub 候选人档案")}`,
	`- 可选仓库焦点：${mdEscape(args.repo || "无")}`,
	"",
	"来源地图",
	"",
	"| 来源 | 看什么 | 本轮怎么用 |",
	"| --- | --- | --- |",
	"| GitHub 个人资料 | login、公开简介、公司、地点、公开邮箱字段 | 身份核验和公开职业信号入口 |",
	"| GitHub 仓库 / PR | 公开 repo、stars、更新、可选仓库 PR | 只作为工程证据样本，不能证明可用性或完整贡献深度 |",
	"",
	"候选人分桶",
	"",
	"| 分桶 | 人选 | 现在做什么 | 为什么值得聊 | 把握 | 还要确认 | 链接 |",
	"| --- | --- | --- | --- | --- | --- | --- |",
];

if (user.error) {
	lines.push(
		`| 暂无推荐 | ${mdEscape(login)} | GitHub 资料读取失败 | ${mdEscape(user.error)} | 低 | 需要确认 login 或认证状态 | [GitHub](https://github.com/${mdEscape(login)}) |`,
	);
} else {
	lines.push(
		`| 建议先核实 | ${mdEscape(user.name || user.login)} (${mdEscape(user.login)}) | 已知 GitHub 个人资料 | 有可访问 GitHub 公开资料，需继续核验职业资料和项目归属 | 中 | 是否为用户目标中的同一人、职业阶段和相关贡献深度 | [GitHub](${mdEscape(user.html_url)}) |`,
	);
}

lines.push("", "身份核验", "", "| 字段 | 值 | 证据 | 置信度 |", "| --- | --- | --- | --- |");

if (user.error) {
	lines.push(`| GitHub 个人资料 | ${mdEscape(login)} | ${mdEscape(user.error)} | 低 |`);
} else {
	lines.push(
		`| GitHub 个人资料 | ${mdEscape(user.name || user.login)} (${mdEscape(user.login)}) | ${mdEscape(user.html_url)} | GitHub 身份高置信度 |`,
		`| 公开简介/公司/地点 | ${truncate([user.bio, user.company, user.location].filter(Boolean).join(" / ") || "未公开")} | GitHub 公开个人资料 | 中 |`,
		`| 公开职业联系方式 | ${mdEscape(user.email || "未找到公开职业联系方式")} | 仅限 GitHub 公开邮箱字段 | ${user.email ? "中" : "不适用"} |`,
	);
}

lines.push("", "待核验线索", "", "| 证据 | 来源 | 置信度 | 弱点 |", "| --- | --- | --- | --- |");

for (const repo of publicRepos.slice(0, args.maxRepos)) {
	lines.push(
		`| Repo: ${mdEscape(repo.full_name)}；stars=${repo.stargazers_count}；updated=${repo.updated_at} | ${mdEscape(repo.html_url)} | 中 | 仓库归属/贡献信号，不能证明角色或可用性 |`,
	);
}

for (const pr of prs.slice(0, args.maxPrs)) {
	lines.push(
		`| PR: ${truncate(pr.title, 120)} | ${mdEscape(pr.html_url)} | 中 | PR 标题只能证明公开活动，不能证明完整贡献深度 |`,
	);
}

if (!publicRepos.length && !prs.length) {
	lines.push(
		"| 预算内没有公开 GitHub 证据 | GitHub API | 低 | 需要另一个公开个人资料或仓库焦点 |",
	);
}

lines.push(
	"",
	"适配证明包",
	"",
	"| 要求 | 证据 | 来源 | 置信度 | 弱点 | 下一步 |",
	"| --- | --- | --- | --- | --- | --- |",
	`| ${mdEscape(args.query || "已知候选人公开个人资料审查")} | GitHub 公开个人资料和有限仓库/PR 样本 | ${mdEscape(user.html_url || `https://github.com/${login}`)} | 中 | 本轮没有 LinkedIn/个人主页/跨来源同人核验 | 用户后续批准后：必要时核验职业资料或项目归属 |`,
	"",
	"覆盖风险",
	"",
	"- 本轮只基于有限 GitHub 公开证据，不代表完整候选人质量证明。",
	"- 不推断私人邮箱、电话、可用性、薪资、签证、搬迁或沟通意愿。",
	"- 公开职业联系方式只限 GitHub 公开邮箱字段；不要猜邮箱格式。",
	"- 候选人相关性仍需人工审查；这是证据脚手架，不是批准。",
	"",
	"停止条件",
	"",
	"- 已知 GitHub 档案脚手架到这里停止；进入触达前必须补职业资料、同人身份和项目归属核验。",
	"",
	"执行合同",
	"",
	"- 本轮只读取公开 GitHub 信息，不查询私人联系方式，不自动发送消息，不继续搜索同名候选人。",
	"",
	"下一步",
	"",
	"- 用户确认后，必要时核验 LinkedIn、个人主页或项目归属；不要自动触达或发送消息。",
);

process.stdout.write(`${lines.join("\n")}\n`);
