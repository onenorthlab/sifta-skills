#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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

export function extractPublicEmails(value) {
	const matches = String(value ?? "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/giu) ?? [];
	return [...new Set(matches.map((email) => email.toLowerCase()))];
}

function cleanUrlCandidate(value) {
	return String(value ?? "")
		.trim()
		.replace(/[),.;，。；）]+$/u, "");
}

export function normalizePublicUrl(value) {
	const text = cleanUrlCandidate(value);
	if (!text || /^(mailto|tel|javascript):/iu.test(text)) return "";

	const withScheme = /^https?:\/\//iu.test(text) ? text : `https://${text}`;
	try {
		const url = new URL(withScheme);
		if (!url.hostname.includes(".")) return "";
		return url.toString().replace(/\/$/u, "");
	} catch {
		return "";
	}
}

export function extractPublicUrls(value) {
	const text = String(value ?? "");
	const urls = [
		...text.matchAll(/https?:\/\/[^\s<>"'`]+/giu),
		...text.matchAll(/(?<!@)\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"'`]*)?/giu),
	]
		.map((match) => normalizePublicUrl(match[0]))
		.filter(Boolean);

	return [...new Set(urls)];
}

function isXUrl(url) {
	const hostname = new URL(url).hostname.replace(/^www\./u, "").toLowerCase();
	return ["x.com", "twitter.com", "fxtwitter.com", "fixupx.com", "vxtwitter.com"].includes(
		hostname,
	);
}

function isPackageRegistryUrl(url) {
	const hostname = new URL(url).hostname.replace(/^www\./u, "").toLowerCase();
	return [
		"npmjs.com",
		"pypi.org",
		"crates.io",
		"pkg.go.dev",
		"rubygems.org",
		"packagist.org",
	].includes(hostname);
}

function addBreadcrumb(breadcrumbs, seen, breadcrumb) {
	const url = breadcrumb.url ? normalizePublicUrl(breadcrumb.url) : "";
	const key = `${breadcrumb.category}:${url || breadcrumb.label}`;
	if (!breadcrumb.label && !url) return;
	if (seen.has(key)) return;
	seen.add(key);
	breadcrumbs.push({
		category: breadcrumb.category,
		label: breadcrumb.label || url,
		...(url ? { url } : {}),
		source: breadcrumb.source,
		why:
			breadcrumb.why ??
			"候选人公开 profile 暴露的同人线索，可用于补身份、职业资料、作品或公开职业渠道",
	});
}

function addContactMethod(contactMethods, seen, contactMethod) {
	const value = String(contactMethod.value ?? "").trim();
	if (!value) return;
	const key = `${contactMethod.type}:${value.toLowerCase()}`;
	if (seen.has(key)) return;
	seen.add(key);
	contactMethods.push({
		type: contactMethod.type,
		value,
		source: contactMethod.source,
		why:
			contactMethod.why ??
			"候选人本人公开资料暴露的职业联系渠道；可输出给招聘负责人，但不代表已确认求职意愿",
	});
}

function buildGithubAuthContext(user) {
	const tokenEnvNames = ["GH_TOKEN", "GITHUB_TOKEN"].filter((name) => Boolean(process.env[name]));
	const profileEmailVisibility = user?.error
		? "unknown_profile_read_failed"
		: user?.email
			? "returned"
			: "not_returned_or_not_public_in_current_context";

	return {
		client: "gh api",
		ghConfigDir: process.env.GH_CONFIG_DIR ? "custom" : "default",
		tokenEnvPresent: tokenEnvNames.length > 0,
		tokenEnvNames,
		profileEmailVisibility,
		note:
			profileEmailVisibility === "returned"
				? "GitHub API 当前认证上下文返回了 profile email，可作为候选人本人公开职业联系方式输出并标来源"
				: "GitHub API 当前认证上下文未返回 profile email；这可能表示未公开、权限/账号上下文不同，或本轮来源不可见，不能断言候选人没有公开邮箱",
	};
}

export function buildPublicBreadcrumbs({ user, repos = [], maxRepos = 5 }) {
	if (!user || user.error) return [];

	const breadcrumbs = [];
	const seen = new Set();
	const blogUrl = normalizePublicUrl(user.blog);
	if (blogUrl) {
		addBreadcrumb(breadcrumbs, seen, {
			category: isXUrl(blogUrl) ? "xProfile" : "website",
			label: isXUrl(blogUrl) ? "GitHub profile linked X/Twitter" : "GitHub profile website",
			url: blogUrl,
			source: "github.profile.blog",
		});
	}

	if (typeof user.twitter_username === "string" && user.twitter_username.trim()) {
		const handle = user.twitter_username.trim().replace(/^@/u, "");
		addBreadcrumb(breadcrumbs, seen, {
			category: "xProfile",
			label: `X/Twitter @${handle}`,
			url: `https://x.com/${handle}`,
			source: "github.profile.twitter_username",
			why: "GitHub profile 公开绑定的 X/Twitter；可读公开 profile、bio link 和具体 status，status URL 可尝试 FxTwitter/FixupX 类公开读取",
		});
	}

	for (const url of extractPublicUrls(user.bio)) {
		addBreadcrumb(breadcrumbs, seen, {
			category: "bioUrl",
			label: "GitHub bio URL",
			url,
			source: "github.profile.bio",
		});
	}

	const companyText = String(user.company ?? "").trim();
	if (companyText) {
		const companyUrls = extractPublicUrls(companyText);
		for (const url of companyUrls) {
			addBreadcrumb(breadcrumbs, seen, {
				category: "companyOrOrg",
				label: "GitHub profile company URL",
				url,
				source: "github.profile.company",
			});
		}
		const orgMatch = companyText.match(/@([A-Za-z0-9-]+)/u);
		if (orgMatch?.[1]) {
			addBreadcrumb(breadcrumbs, seen, {
				category: "companyOrOrg",
				label: `GitHub organization @${orgMatch[1]}`,
				url: `https://github.com/${orgMatch[1]}`,
				source: "github.profile.company",
			});
		} else if (companyUrls.length === 0) {
			addBreadcrumb(breadcrumbs, seen, {
				category: "companyOrOrg",
				label: scrubContactValues(companyText),
				source: "github.profile.company",
				why: "GitHub profile 公开 company 字段；没有可读 URL 时只能作为待核验职业/组织线索",
			});
		}
	}

	for (const repo of Array.isArray(repos) ? repos.slice(0, maxRepos) : []) {
		const homepage = normalizePublicUrl(repo.homepage);
		if (!homepage) continue;
		addBreadcrumb(breadcrumbs, seen, {
			category: isPackageRegistryUrl(homepage) ? "packageRegistry" : "repoHomepage",
			label: `${repo.full_name ?? repo.name ?? "repo"} homepage`,
			url: homepage,
			source: "github.repo.homepage",
			why: "候选人公开 repo 挂出的项目/包/文档主页，可用于确认作品归属、产品状态和技术证据",
		});
	}

	return breadcrumbs;
}

export function buildPublicContactMethods({ user, publicBreadcrumbs = [] }) {
	if (!user || user.error) return [];

	const contactMethods = [];
	const seen = new Set();
	for (const email of extractPublicEmails(user.email)) {
		addContactMethod(contactMethods, seen, {
			type: "email",
			value: email,
			source: "github.profile.email",
		});
	}
	for (const email of extractPublicEmails(user.bio)) {
		addContactMethod(contactMethods, seen, {
			type: "email",
			value: email,
			source: "github.profile.bio",
		});
	}

	for (const breadcrumb of publicBreadcrumbs) {
		if (!breadcrumb.url) continue;
		if (breadcrumb.category === "xProfile") {
			addContactMethod(contactMethods, seen, {
				type: "publicProfile",
				value: breadcrumb.url,
				source: breadcrumb.source,
				why: "候选人公开绑定的 X/Twitter profile，可作为公开职业渠道或继续查 bio link",
			});
		}
		if (breadcrumb.category === "website" || breadcrumb.category === "bioUrl") {
			addContactMethod(contactMethods, seen, {
				type: "website",
				value: breadcrumb.url,
				source: breadcrumb.source,
				why: "候选人公开挂出的个人主页或 bio 链接，需打开确认是否有公开职业联系方式",
			});
		}
	}

	return contactMethods;
}

export function buildKnownGitHubDossierPayload({ args = {}, login, user, repos = [], prs = [] }) {
	const publicRepos = Array.isArray(repos) ? repos : [];
	const relatedPrs = Array.isArray(prs) ? prs : [];
	const maxRepos = Number.isFinite(args.maxRepos) ? args.maxRepos : 8;
	const maxPrs = Number.isFinite(args.maxPrs) ? args.maxPrs : 5;
	const publicBreadcrumbs = buildPublicBreadcrumbs({
		user,
		repos: publicRepos,
		maxRepos,
	});
	const publicContactMethods = buildPublicContactMethods({ user, publicBreadcrumbs });
	const githubAuthContext = buildGithubAuthContext(user);
	const samePersonExpansionRecommended = publicBreadcrumbs.some((breadcrumb) => breadcrumb.url);
	const publicContactSignal = publicContactMethods.length
		? `找到 ${publicContactMethods.length} 个候选人公开职业联系渠道`
		: "未找到公开职业联系方式";
	const contactVisibility = {
		publicContactMethodCount: publicContactMethods.length,
		githubProfileEmail: githubAuthContext.profileEmailVisibility,
		statement:
			githubAuthContext.profileEmailVisibility === "returned"
				? "GitHub profile email 已由当前 gh api context 返回"
				: "当前 gh api context 未返回 profile email；最终报告应写本轮来源未找到公开 email，而不是断言没有公开邮箱",
	};

	return {
		query: args.query || "已知 GitHub 候选人档案",
		executedSources: ["github"],
		scope: {
			mode: "known_candidate_dossier",
			noNewPeople: true,
			statement:
				"本轮没有继续找新人；先围绕已知 GitHub profile 做候选人档案初筛，再沿候选人公开挂出的同人线索做 bounded public expansion。",
		},
		status: user.error ? "blocked" : "profile_lead",
		recommendedCount: 0,
		samePersonExpansionRecommended,
		publicBreadcrumbs,
		publicContactMethods,
		contactVisibility,
		githubAuthContext,
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
					recruitingJudgment: "先确认是否是目标人选，再判断适合全职、顾问还是推荐人推进",
					whyWorthTalking:
						"有可访问 GitHub 公开资料，需继续核验职业资料、项目归属和同人公开线索",
					evidence: [
						"GitHub profile",
						scrubContactValues(
							[user.bio, user.company, user.location].filter(Boolean).join(" / "),
						),
					].filter(Boolean),
					missingEvidence: "职业资料、项目归属、当前角色和公开职业渠道",
					nextAction:
						"读取 publicBreadcrumbs 中的个人主页、X/Twitter、repo homepage 或组织页；只围绕同一个人补证，不自动触达或发送消息",
					publicContactSignal,
					publicContactMethods,
					contactVisibility,
					canEnterCandidateTable: false,
				},
		people: [],
		relatedWork: publicRepos.slice(0, maxRepos).map((repo) => ({
			type: "repo",
			name: repo.full_name,
			url: repo.html_url,
			stars: repo.stargazers_count,
			updatedAt: repo.updated_at,
		})),
		relatedPrs: relatedPrs.slice(0, maxPrs).map((pr) => ({
			type: "pr",
			repo: pr._repo || args.repo || null,
			title: pr.title,
			url: pr.html_url,
			state: pr.state,
		})),
		warnings: [
			...(user.error ? [`GitHub profile 读取失败：${user.error}`] : []),
			...(!user.error && !user.email
				? [
						"GitHub API 当前认证上下文未返回 profile email；如需核公开 email，只能继续读取候选人公开主页、bio link、论文通讯邮箱或其他公开 profile，不能猜邮箱格式。",
					]
				: []),
			...(!publicRepos.length && !relatedPrs.length
				? ["预算内没有公开 GitHub 项目证据。"]
				: []),
		],
	};
}

function isMainModule() {
	return process.argv[1] === fileURLToPath(import.meta.url);
}

function writeMissingLogin(args) {
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

function main(argv = process.argv.slice(2)) {
	const args = parseArgs(argv);
	const login = loginFrom(args.github);
	if (!login) {
		writeMissingLogin(args);
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
			return Array.isArray(result.items)
				? result.items.map((item) => ({ ...item, _repo: repo }))
				: [];
		});
		prs = related.slice(0, args.maxPrs);
	}

	const payload = buildKnownGitHubDossierPayload({ args, login, user, repos, prs });

	if (args.json) {
		process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
		process.exit(0);
	}

	process.stdout.write(
		`${JSON.stringify(
			{
				status: "debug-summary",
				executedSources: payload.executedSources,
				scope: payload.scope,
				recommendedCount: payload.recommendedCount,
				samePersonExpansionRecommended: payload.samePersonExpansionRecommended,
				publicBreadcrumbs: payload.publicBreadcrumbs,
				publicContactMethods: payload.publicContactMethods,
				contactVisibility: payload.contactVisibility,
				githubAuthContext: payload.githubAuthContext,
				subject: payload.subject,
				profileLead: payload.profileLead
					? {
							displayName: payload.profileLead.displayName,
							login: payload.profileLead.login,
							profileUrl: payload.profileLead.profileUrl,
							evidence: payload.profileLead.evidence,
							canEnterCandidateTable: payload.profileLead.canEnterCandidateTable,
						}
					: null,
				people: [],
				relatedWork: payload.relatedWork,
				relatedPrs: payload.relatedPrs,
				warnings: payload.warnings,
				nextAction:
					"先读取 publicBreadcrumbs 中的公开同人链接，补职业资料、项目归属和公开职业渠道；repo/PR 只能作为相关作品或证据。",
			},
			null,
			2,
		)}\n`,
	);
}

if (isMainModule()) {
	main();
}
