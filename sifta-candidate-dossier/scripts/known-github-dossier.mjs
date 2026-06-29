#!/usr/bin/env node

import { execFileSync } from "node:child_process";

function parseArgs(argv) {
	const args = {
		github: "",
		repo: "",
		query: "",
		maxRepos: 5,
		maxPrs: 3,
		json: true,
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
		if (arg === "--json") {
			args.json = next !== "false";
			continue;
		}
		if (arg === "--markdown") {
			args.json = false;
			continue;
		}
		if (arg.startsWith("--") && arg !== "--json" && arg !== "--markdown") index += 1;
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

const projectRepoHints = new Map([
	["langgraph", ["langchain-ai/langgraph", "langchain-ai/langgraphjs"]],
	["langchain", ["langchain-ai/langchain"]],
	["mcp", ["modelcontextprotocol/servers", "modelcontextprotocol/typescript-sdk"]],
]);

function queryRepoHints(query) {
	const text = String(query ?? "").toLowerCase();
	const repos = [];
	for (const [keyword, values] of projectRepoHints) {
		if (text.includes(keyword)) repos.push(...values);
	}
	return [...new Set(repos)];
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
	if (args.json) {
		process.stdout.write(
			`${JSON.stringify(
				{
					status: "blocked",
					reason: "missing_github_login",
					recommendedCount: 0,
					people: [],
					warnings: ["缺少可消歧的 GitHub login 或 profile URL，不能猜同名候选人。"],
					nextAction: "请补 GitHub、LinkedIn、个人主页、公司或地点线索后重试。",
				},
				null,
				2,
			)}\n`,
		);
		process.exit(0);
	}
	process.stdout.write(
		`${JSON.stringify(
			{
				status: "blocked",
				reason: "missing_github_login",
				recommendedCount: 0,
				people: [],
				warnings: ["缺少可消歧的 GitHub login 或 profile URL，不能猜同名候选人。"],
				nextAction: "请补 GitHub、LinkedIn、个人主页、公司或地点线索后重试。",
			},
			null,
			2,
		)}\n`,
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
} else {
	const hintedRepos = queryRepoHints(args.query).slice(0, 2);
	const related = hintedRepos.flatMap((repo) => {
		const result = safeGhJson(
			`search/issues?q=author:${encodeURIComponent(login)}+repo:${repo}+is:pr&per_page=${args.maxPrs}`,
		);
		return Array.isArray(result.items) ? result.items.map((item) => ({ ...item, _repo: repo })) : [];
	});
	prs = related.slice(0, args.maxPrs);
}

const publicRepos = Array.isArray(repos) ? repos : [];
const publicContactSignal = user?.email
	? "GitHub profile 公开 contact 字段存在"
	: "未找到公开职业联系方式";

if (args.json) {
	process.stdout.write(
		`${JSON.stringify(
			{
				query: args.query || "已知 GitHub 候选人档案",
				executedSources: ["github"],
				scope: {
					mode: "known_candidate_dossier",
					noNewPeople: true,
					statement:
						"本轮没有继续找新人；只围绕已知 GitHub profile 和公开 GitHub 证据做候选人档案初筛。",
				},
				status: user.error ? "blocked" : "profile_lead",
				recommendedCount: 0,
				subject: user.error
					? null
					: {
							displayName: user.name || user.login || login,
							login: user.login || login,
							profileUrl: user.html_url || `https://github.com/${login}`,
						},
				profileLead: user.error
					? null
					: {
							source: "github",
							displayName: user.name || user.login || login,
							login: user.login || login,
							profileUrl: user.html_url || `https://github.com/${login}`,
							recruitingJudgment:
								"先确认是否是目标人选，再判断适合全职、顾问还是推荐人推进",
							whyWorthTalking:
								"有可访问 GitHub 公开资料，需继续核验职业资料和项目归属",
							evidence: [
								"GitHub profile",
								scrubContactValues([user.bio, user.company, user.location].filter(Boolean).join(" / ")),
							].filter(Boolean),
							missingEvidence: "职业资料、项目归属、当前角色和公开职业渠道",
							nextAction: "核验 LinkedIn、个人主页或项目归属；不要自动触达或发送消息",
							publicContactSignal,
							canEnterCandidateTable: false,
						},
				people: [],
				relatedWork: publicRepos.slice(0, args.maxRepos).map((repo) => ({
					type: "repo",
					name: repo.full_name,
					url: repo.html_url,
					stars: repo.stargazers_count,
					updatedAt: repo.updated_at,
				})),
				relatedPrs: prs.slice(0, args.maxPrs).map((pr) => ({
					type: "pr",
					repo: pr._repo || args.repo || null,
					title: pr.title,
					url: pr.html_url,
					state: pr.state,
				})),
				warnings: [
					...(user.error ? [`GitHub profile 读取失败：${user.error}`] : []),
					...(!publicRepos.length && !prs.length ? ["预算内没有公开 GitHub 项目证据。"] : []),
				],
			},
			null,
			2,
		)}\n`,
	);
	process.exit(0);
}

process.stdout.write(
	`${JSON.stringify(
			{
				status: "debug-summary",
				executedSources: ["github"],
				scope: {
					mode: "known_candidate_dossier",
					noNewPeople: true,
					statement:
						"本轮没有继续找新人；只围绕已知 GitHub profile 和公开 GitHub 证据做候选人档案初筛。",
				},
				recommendedCount: 0,
				subject: user.error
					? null
					: {
							displayName: user.name || user.login || login,
							login: user.login || login,
							profileUrl: user.html_url || `https://github.com/${login}`,
						},
				profileLead: user.error
					? null
					: {
							displayName: user.name || user.login || login,
							login: user.login || login,
							profileUrl: user.html_url || `https://github.com/${login}`,
							evidence: [
								"GitHub profile",
								scrubContactValues([user.bio, user.company, user.location].filter(Boolean).join(" / ")),
							].filter(Boolean),
							canEnterCandidateTable: false,
						},
				people: [],
			relatedWork: publicRepos.slice(0, args.maxRepos).map((repo) => ({
				type: "repo",
				name: repo.full_name,
				url: repo.html_url,
				stars: repo.stargazers_count,
				updatedAt: repo.updated_at,
			})),
			relatedPrs: prs.slice(0, args.maxPrs).map((pr) => ({
				type: "pr",
				repo: pr._repo || args.repo || null,
				title: pr.title,
				url: pr.html_url,
				state: pr.state,
			})),
			warnings: [
				...(user.error ? [`GitHub profile 读取失败：${user.error}`] : []),
				...(!publicRepos.length && !prs.length ? ["预算内没有公开 GitHub 项目证据。"] : []),
			],
			nextAction: "核验职业资料、项目归属和公开职业渠道；repo/PR 只能作为相关作品或证据。",
		},
		null,
		2,
	)}\n`,
);
