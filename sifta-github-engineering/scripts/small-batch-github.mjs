#!/usr/bin/env node

function parseArgs(argv) {
	const args = {
		profile: "agent-runtime",
		query: "",
		targetCount: 2,
		poolSize: null,
		userSearchPerQuery: null,
		maxUserProfiles: null,
		repoSearchCount: null,
		maxRepos: null,
		seedRepoCount: 0,
		contributorsPerRepo: 4,
		prsPerRepo: 2,
		maxPerRepoCandidates: 1,
		potentialCount: null,
		includePotential: true,
		seeds: [],
	};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const next = argv[index + 1];
		if (arg === "--profile" && next) args.profile = next;
		if (arg === "--query" && next) args.query = next;
		if (arg === "--target-count" && next) args.targetCount = Number(next);
		if (arg === "--pool-size" && next) args.poolSize = Number(next);
		if (arg === "--user-search-per-query" && next) args.userSearchPerQuery = Number(next);
		if (arg === "--max-user-profiles" && next) args.maxUserProfiles = Number(next);
		if (arg === "--repo-search-count" && next) args.repoSearchCount = Number(next);
		if (arg === "--max-repos" && next) args.maxRepos = Number(next);
		if (arg === "--seed-repo-count" && next) args.seedRepoCount = Number(next);
		if (arg === "--contributors-per-repo" && next) args.contributorsPerRepo = Number(next);
		if (arg === "--prs-per-repo" && next) args.prsPerRepo = Number(next);
		if (arg === "--max-per-repo-candidates" && next) args.maxPerRepoCandidates = Number(next);
		if (arg === "--potential-count" && next) args.potentialCount = Number(next);
		if (arg === "--include-potential" && next) args.includePotential = next !== "false";
		if (arg === "--seed" && next) args.seeds.push(next);
		if (arg.startsWith("--")) index += 1;
	}
	return args;
}

/**
 * 种子仓库召回：补充纯关键词搜不到的开发者
 * 注意：纯补充性质，不替代任何关键词搜索，不过滤任何结果
 * 设计原则：每个画像 5-8 个核心 repo，分两层：
 * 1. cn-layer：中国开发者活跃的项目，优先抓中文生态贡献者
 * 2. global-layer：全球标杆项目，补充强技术信号
 * 默认 mode=minimal：每个画像只取 2-3 个最核心 repo，不喧宾夺主
 */
const profileSeeds = {
	"mcp-runtime-cn": ["QwenLM/Qwen-Agent", "modelscope/modelscope-agent", "eosphoros-ai/DB-GPT"],
	"mcp-runtime": [
		"QwenLM/Qwen-Agent",
		"modelscope/modelscope-agent",
		"anthropic-quickstart-tools",
	],
	"agent-runtime-cn": [
		"QwenLM/Qwen-Agent",
		"modelscope/modelscope-agent",
		"eosphoros-ai/DB-GPT",
		"infiniflow/ragflow",
		"OpenManus/OpenManus",
	],
	"agent-runtime": [
		"QwenLM/Qwen-Agent",
		"modelscope/modelscope-agent",
		"eosphoros-ai/DB-GPT",
		"langchain-ai/langgraph",
		"openai/openai-agents-python",
	],
	"llm-infra-training": [
		"vllm-project/vllm",
		"InternLM/InternEvo",
		"OpenBMB/BMTrain",
		"NVIDIA/TensorRT-LLM",
		"deepseek-ai/DeepSeek-Coder",
	],
	"llm-app-indie": [
		"lobehub/lobe-chat",
		"ChatGPTNextWeb/ChatGPT-Next-Web",
		"chathub-dev/chathub",
		"mckaywrigley/chatbot-ui",
		"DomaGit/FastGPT",
	],
	"vla-wam-robotics": [
		"opendilab/DI-engine",
		"THU-MIG/yolov10",
		"google-deepmind/robotics_transformer",
		"haosulab/ManiSkill",
		"facebookresearch/pytorch3d",
	],
	"llm-foundation": [
		"QwenLM/Qwen",
		"InternLM/InternLM",
		"deepseek-ai/deepseek-ai.github.io",
		"mistralai/mistral-src",
		"google/gemma",
	],
	"agent-evaluation": [
		"confident-ai/deepeval",
		"langchain-ai/agentevals",
		"braintrustdata/braintrust-sdk",
	],
	// 全局 fallback：取交集，覆盖通用 AI 场景
	default: ["QwenLM/Qwen-Agent", "vllm-project/vllm", "langchain-ai/langgraph"],
};

const githubToken = (process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "").trim();
const githubApiBaseUrl = (process.env.GITHUB_API_BASE_URL || "https://api.github.com").replace(
	/\/+$/u,
	"",
);

async function githubJson(endpoint) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 20_000);
	const headers = {
		accept: "application/vnd.github+json",
		connection: "close",
		"user-agent": "sifta-github-small-batch",
		"x-github-api-version": "2022-11-28",
	};
	if (githubToken) headers.authorization = `Bearer ${githubToken}`;

	try {
		const response = await fetch(`${githubApiBaseUrl}/${endpoint.replace(/^\/+/u, "")}`, {
			headers,
			signal: controller.signal,
		});
		const body = await response.text();
		if (!response.ok) {
			const error = new Error(
				`GitHub API ${response.status} ${response.statusText}: ${body.slice(0, 300)}`,
			);
			error.status = response.status;
			error.statusText = response.statusText;
			error.body = body;
			error.rateLimitRemaining = response.headers.get("x-ratelimit-remaining") ?? "";
			error.rateLimitReset = response.headers.get("x-ratelimit-reset") ?? "";
			throw error;
		}
		return body ? JSON.parse(body) : null;
	} finally {
		clearTimeout(timeout);
	}
}

function isBot(login) {
	return /\[bot\]$|bot$|dependabot|pre-commit-ci/i.test(login);
}

function endpointWithParams(path, params) {
	const searchParams = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined && value !== null && value !== "")
			searchParams.set(key, String(value));
	}
	const query = searchParams.toString();
	return query ? `${path}?${query}` : path;
}

// GitHub search 接口约 30 次/分钟，远低于 core 5000/小时。脚本 + 宿主 agent 同时搜索时
// 很容易瞬时打爆 search 配额，导致召回中途失败、最终 0 人选。下面把限流识别成独立失败类型，
// 做一次有界退避重试，并设置全局标记，让最终归因写“限流”而不是误判成“地域过滤不足”。
let rateLimitHit = false;
let rateLimitBackoffsUsed = 0;
const MAX_RATE_LIMIT_BACKOFFS = 1;

function isRateLimitError(error) {
	const status = error?.status;
	const remaining = String(error?.rateLimitRemaining ?? "");
	const text = `${error?.message ?? error?.error ?? ""}\n${error?.body ?? ""}`;
	return (
		status === 429 ||
		(status === 403 && (remaining === "0" || /rate limit|secondary rate|abuse/iu.test(text)))
	);
}

async function sleep(ms) {
	await new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeGitHubJson(endpoint) {
	for (let attempt = 0; ; attempt += 1) {
		try {
			return await githubJson(endpoint);
		} catch (error) {
			const rateLimited = isRateLimitError(error);
			if (rateLimited) {
				rateLimitHit = true;
				// 仅在整轮第一次限流时退避一次，避免多次 60s 等待拖垮宿主 agent 的执行预算。
				if (attempt === 0 && rateLimitBackoffsUsed < MAX_RATE_LIMIT_BACKOFFS) {
					rateLimitBackoffsUsed += 1;
					const resetMs = Number(error?.rateLimitReset) * 1000;
					const waitMs =
						Number.isFinite(resetMs) && resetMs > Date.now()
							? Math.min(resetMs - Date.now() + 1500, 65_000)
							: 12_000;
					await sleep(waitMs);
					continue;
				}
			}
			return {
				error: String(error.message ?? error),
				status: error?.status,
				body: error?.body ? String(error.body) : "",
				rateLimitRemaining: error?.rateLimitRemaining ?? "",
				rateLimited,
			};
		}
	}
}

function githubRecoveryHint(error) {
	// 限流和认证是两类失败：限流要等窗口重置后重跑，不是去配 token。先单独识别限流。
	if (error?.rateLimited || isRateLimitError(error)) {
		return "GitHub search 限流（约 30 次/分钟）；等待约 1 分钟窗口重置后重跑，或降低本轮搜索次数，不要据此判断没有合适的人";
	}
	const text = `${error?.error ?? ""}\n${error?.body ?? ""}\n${error?.rateLimitRemaining ?? ""}`;
	if (/auth|credential|login|authentication|401|403/i.test(text)) {
		return "在宿主环境设置 `GH_TOKEN` / `GITHUB_TOKEN`，或使用宿主 GitHub MCP / `gh auth login` 后重跑；不要改走 Sifta CLI";
	}
	if (/not found|404/i.test(text))
		return "确认仓库或用户是否存在；必要时换用动态 repo search 结果继续";
	return "重试 GitHub API，或降低本轮搜索次数后重跑；不要仅为 GitHub token 改走 Sifta CLI";
}

const publicGeoPatterns = [
	/china|china-based|china market|greater china|mainland china|chinese-language|中文|beijing|shanghai|shenzhen|hangzhou|guangzhou|hong kong|taiwan|taipei|tsinghua|peking university|zhejiang university|fudan|sjtu|ustc|hkust|cuhk|chinese academy|cas/i,
	/tencent|alibaba|bytedance|baidu|meituan|xiaohongshu|pinduoduo|huawei|ant group|alipay|deepseek|qwen|zhipu|moonshot|minimax|sensetime|megvii/i,
	/\.cn\b|\.com\.cn\b/i,
];

const chinaEcosystemRepoPatterns = [
	/^QwenLM\//i,
	/^modelscope\//i,
	/^alibaba\//i,
	/^infiniflow\//i,
	/^eosphoros-ai\//i,
	/^OpenBMB\//i,
	/^THUDM\//i,
	/^PaddlePaddle\//i,
	/^Datawhalechina\//i,
	/^InternLM\//i,
	/^deepseek-ai\//i,
	/^bytedance\//i,
	/^lobehub\//i,
	/^OpenManus\//i,
];

const engineeringKeywordPatterns = [
	/agent/i,
	/runtime/i,
	/tool calling/i,
	/\bMCP\b/i,
	/function calling/i,
	/RAG/i,
	/evaluation/i,
	/observability/i,
	/LLM/i,
	/inference/i,
	/workflow/i,
];

const weakDirectoryRepoPatterns = [
	/awesome/i,
	/curated/i,
	/directory/i,
	/collection/i,
	/list/i,
	/integration/i,
	/independent[-_ ]?developer/i,
	/resources?/i,
	/roadmap/i,
	/guide/i,
	/tutorial/i,
	/interview/i,
	/learning/i,
	/学习/u,
	/面试/u,
	/指南/u,
	/links?/i,
	/examples?$/i,
];

function publicGeoEvidence(user) {
	const fields = [
		["location", user.location],
		["company", user.company],
		["blog", user.blog],
		["bio", user.bio],
	];
	const matches = [];
	for (const [field, rawValue] of fields) {
		const value = String(rawValue ?? "").trim();
		if (!value) continue;
		if (
			/\p{Script=Han}/u.test(value) ||
			publicGeoPatterns.some((pattern) => pattern.test(value))
		) {
			matches.push(`${field}: ${value}`);
		}
	}
	return {
		matched: matches.length > 0,
		evidence: matches.slice(0, 2).join("；") || "未看到公开中国/中文生态相关职业信号",
	};
}

function repoEcosystemEvidence(repo) {
	const text = [
		repo.full_name,
		repo.name,
		repo.description,
		Array.isArray(repo.topics) ? repo.topics.join(" ") : "",
		repo.owner?.login,
	]
		.filter(Boolean)
		.join(" ");
	if (chinaEcosystemRepoPatterns.some((pattern) => pattern.test(String(repo.full_name ?? "")))) {
		return {
			matched: true,
			evidence: `贡献到中国/中文生态 repo：${repo.full_name}`,
		};
	}
	if (/\p{Script=Han}/u.test(text) || publicGeoPatterns.some((pattern) => pattern.test(text))) {
		return {
			matched: true,
			evidence: `repo 公开信息匹配中国/中文生态：${repo.full_name}`,
		};
	}
	return { matched: false, evidence: "repo 未体现中国/中文生态信号" };
}

function isWeakDirectoryRepo(repo) {
	const text = [repo.full_name, repo.name, repo.description].filter(Boolean).join(" ");
	return weakDirectoryRepoPatterns.some((pattern) => pattern.test(text));
}

function repoCandidateEcosystemEvidence(repo, contributionCount, isPrAuthor) {
	const evidence = repoEcosystemEvidence(repo);
	if (!evidence.matched) return evidence;
	if (isWeakDirectoryRepo(repo)) {
		return {
			matched: false,
			evidence: `${evidence.evidence}，但这是目录/集成列表类 repo，不能单独作为候选人升级信号`,
		};
	}
	if (contributionCount >= 3 || !isPrAuthor) return evidence;
	return {
		matched: false,
		evidence: `${evidence.evidence}，但单个 PR/低频贡献不足以升级为候选人`,
	};
}

function repoEngineeringEvidence(repo) {
	const text = [
		repo.full_name,
		repo.description,
		Array.isArray(repo.topics) ? repo.topics.join(" ") : "",
	]
		.filter(Boolean)
		.join(" ");
	return engineeringKeywordPatterns.some((pattern) => pattern.test(text));
}

function userRepoEngineeringEvidence(repositories) {
	return repositories
		.filter((repo) => repoEngineeringEvidence(repo))
		.slice(0, 3)
		.map((repo) => {
			const stars = Number.isFinite(repo.stargazers_count)
				? `；stars=${repo.stargazers_count}`
				: "";
			return `${repo.full_name}${stars}${repo.description ? `；${repo.description}` : ""}`;
		});
}

function mergeUnique(items) {
	return [...new Set(items.filter(Boolean))];
}

function candidateScore(candidate) {
	let score = 0;
	if (candidate.geoEvidence?.matched) score += 2;
	if (candidate.contributions >= 50) score += 3;
	else if (candidate.contributions >= 10) score += 2;
	else if (candidate.contributions >= 3) score += 1;
	score += Math.min(candidate.prCount, 2);
	score += Math.min(candidate.personalRepoEvidence.length, 2);
	if (candidate.company || candidate.bio || candidate.location) score += 1;
	return score;
}

function positiveNumber(value, fallback) {
	return Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegativeNumber(value, fallback) {
	return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const args = parseArgs(process.argv.slice(2));
args.targetCount = positiveNumber(args.targetCount, 2);
args.poolSize = positiveNumber(args.poolSize, Math.max(args.targetCount * 8, 24));
args.userSearchPerQuery = Math.min(
	30,
	positiveNumber(args.userSearchPerQuery, Math.max(args.targetCount * 4, 12)),
);
args.maxUserProfiles = positiveNumber(
	args.maxUserProfiles,
	Math.max(args.poolSize, args.userSearchPerQuery * 3),
);
args.repoSearchCount = positiveNumber(
	args.repoSearchCount,
	positiveNumber(args.maxRepos, Math.max(args.targetCount * 2, 4)),
);
args.seedRepoCount = nonNegativeNumber(args.seedRepoCount, 0);
args.contributorsPerRepo = positiveNumber(args.contributorsPerRepo, 6);
args.prsPerRepo = positiveNumber(args.prsPerRepo, 4);
args.maxPerRepoCandidates = positiveNumber(args.maxPerRepoCandidates, 1);
args.potentialCount = positiveNumber(args.potentialCount, Math.max(args.targetCount * 4, 8));

const query = args.query || "AI agent runtime, tool calling, evaluation system";
const seedRepos = (
	args.seeds.length ? args.seeds : (profileSeeds[args.profile] ?? profileSeeds["agent-runtime"])
).slice(0, args.seedRepoCount);
const seedMode = args.seeds.length
	? "custom"
	: args.profile.includes("global")
		? "global-benchmark"
		: "cn-default";

const candidatesByLogin = new Map();
const leadRows = [];
const seen = new Set();
const recallPaths = [];

function cleanSearchQuery(value) {
	return String(value || "AI agent runtime MCP LLM infra")
		.replace(/\blocation:\S+/giu, "")
		.replace(/\bfollowers:\S+/giu, "")
		.replace(/\btype:\S+/giu, "")
		.replace(/\bsite:\S+/giu, "")
		.replace(/[，；。]/gu, " ")
		.replace(/\s+/gu, " ")
		.trim()
		.slice(0, 220);
}

function queryFocusTerms(value) {
	return cleanSearchQuery(value)
		.split(/\s+/u)
		.filter((term) => engineeringKeywordPatterns.some((pattern) => pattern.test(term)))
		.map((term) => term.toLowerCase());
}

function repositorySearchQueries(value) {
	const cleaned = cleanSearchQuery(value);
	const base = `${cleaned} in:name,description,readme`;
	if (seedMode === "global-benchmark") return [base];
	// 由用户 query 驱动召回，而不是写死某个生态：取画像里最强的能力词再发一条聚焦查询，
	// 让 MCP / runtime / eval 这类真实意图主导仓库搜索，而不是被固定关键词绑架。
	const focus = queryFocusTerms(value).slice(0, 4).join(" ");
	const variants = [base];
	if (focus && focus !== cleaned.toLowerCase()) {
		variants.push(`${focus} in:name,description,readme`);
	}
	for (const topic of ["mcp", "agent", "llm", "rag", "function-calling"]) {
		if (!focus && !cleaned.toLowerCase().includes(topic)) continue;
		variants.push(`${focus || cleaned} topic:${topic}`);
	}
	for (const ecosystemTerm of ["qwen", "modelscope", "alibaba", "chinese"]) {
		variants.push(`${focus || cleaned} ${ecosystemTerm} in:name,description,readme`);
	}
	return mergeUnique(variants).slice(0, 3);
}

const defaultUserSearchLocations = [
	"China",
	"Beijing",
	"Shanghai",
	"Hangzhou",
	"Shenzhen",
	"Guangzhou",
	"Chengdu",
	"Hong Kong",
];

function quoteQualifierValue(value) {
	return /\s/u.test(value) ? `"${value}"` : value;
}

function userSearchBaseTerms(value) {
	const terms = cleanSearchQuery(value)
		.split(/\s+/u)
		.filter((term) => /agent|runtime|MCP|LLM|infra|tool|calling|RAG|eval/i.test(term))
		.slice(0, 5)
		.join(" ");
	return terms || "agent runtime MCP";
}

function userSearchQueries(value) {
	const base = userSearchBaseTerms(value);
	const broadQuery = `${base} type:user repos:>2`;
	if (seedMode === "global-benchmark") return [broadQuery];
	const locationQueries = defaultUserSearchLocations
		.slice(0, 5)
		.map((location) => `${base} location:${quoteQualifierValue(location)} type:user repos:>2`);
	return mergeUnique([...locationQueries, broadQuery]);
}

async function addCandidateSignal({ contributor, repo, reason, pr = false }) {
	if (!contributor?.login || isBot(contributor.login)) return;
	const login = contributor.login;
	const user = await safeGitHubJson(`users/${encodeURIComponent(login)}`);
	if (user.error) {
		leadRows.push({
			lead: login,
			sourceFamily: "GitHub 贡献者线索",
			whyRelevant: reason,
			blocker: "个人资料读取失败",
			next: githubRecoveryHint(user),
		});
		return;
	}
	const profileGeo = publicGeoEvidence(user);
	const ecosystemGeo = repoCandidateEcosystemEvidence(repo, contributor.contributions ?? 0, pr);
	const geoEvidence = profileGeo.matched ? profileGeo : ecosystemGeo;
	let personalRepoEvidence = [];
	if (profileGeo.matched || ecosystemGeo.matched) {
		const repos = await safeGitHubJson(
			endpointWithParams(`users/${encodeURIComponent(login)}/repos`, {
				per_page: 6,
				sort: "pushed",
			}),
		);
		personalRepoEvidence = Array.isArray(repos) ? userRepoEngineeringEvidence(repos) : [];
	}
	const existing = candidatesByLogin.get(login);
	const nextCandidate = existing ?? {
		login,
		name: user.name ?? "",
		company: user.company ?? "",
		blog: user.blog ?? "",
		location: user.location ?? "",
		bio: user.bio ?? "",
		profileUrl: user.html_url ?? contributor.html_url ?? `https://github.com/${login}`,
		contributions: 0,
		prCount: 0,
		repos: [],
		evidence: [],
		personalRepoEvidence: [],
		profileGeoEvidence: profileGeo,
		ecosystemGeoEvidence: ecosystemGeo,
		geoEvidence,
		profileRaw: user,
	};
	nextCandidate.profile = user.html_url ?? contributor.html_url ?? nextCandidate.profile;
	nextCandidate.profileUrl = nextCandidate.profile;
	nextCandidate.name = user.name ?? nextCandidate.name;
	nextCandidate.company = user.company ?? nextCandidate.company;
	nextCandidate.blog = user.blog ?? nextCandidate.blog;
	nextCandidate.location = user.location ?? nextCandidate.location;
	nextCandidate.bio = user.bio ?? nextCandidate.bio;
	nextCandidate.profileRaw = user;
	nextCandidate.profileGeoEvidence = profileGeo;
	nextCandidate.ecosystemGeoEvidence = ecosystemGeo;
	nextCandidate.contributions += contributor.contributions ?? 0;
	nextCandidate.prCount += pr ? 1 : 0;
	nextCandidate.repos.push({
		fullName: repo.full_name,
		url: repo.html_url,
		description: repo.description ?? "",
		stars: repo.stargazers_count ?? 0,
		contributions: contributor.contributions ?? 0,
	});
	nextCandidate.evidence = mergeUnique([
		...nextCandidate.evidence,
		`${repo.full_name}：${reason}`,
		repoEcosystemEvidence(repo).matched ? repoEcosystemEvidence(repo).evidence : "",
		profileGeo.matched ? `公开 profile 信号：${profileGeo.evidence}` : "",
	]);
	nextCandidate.personalRepoEvidence = mergeUnique([
		...nextCandidate.personalRepoEvidence,
		...personalRepoEvidence,
	]);
	nextCandidate.geoEvidence = nextCandidate.geoEvidence?.matched
		? nextCandidate.geoEvidence
		: geoEvidence;
	nextCandidate.score = candidateScore(nextCandidate);
	candidatesByLogin.set(login, nextCandidate);
}

async function addProfileSignal({ login, reason, repo }) {
	if (!login || isBot(login)) return;
	await addCandidateSignal({
		contributor: { login, html_url: `https://github.com/${login}`, contributions: 0 },
		repo: repo ?? {
			full_name: "GitHub user search",
			html_url: `https://github.com/${login}`,
			description: "GitHub user search matched the technical query",
			stargazers_count: 0,
		},
		reason,
	});
}

async function processRepository(repo, whyRelevant) {
	if (!repo?.full_name || !repo?.html_url) return;
	const ownerLogin = repo.owner?.login;
	const ownerType = repo.owner?.type;
	if (ownerLogin && ownerType === "User") {
		await addProfileSignal({
			login: ownerLogin,
			repo,
			reason: `repo owner；${whyRelevant}`,
		});
	}

	const contributors = await safeGitHubJson(
		endpointWithParams(`repos/${repo.full_name}/contributors`, {
			per_page: args.contributorsPerRepo,
		}),
	);
	if (Array.isArray(contributors)) {
		for (const contributor of contributors) {
			const key = `${repo.full_name}:contributor:${contributor.login}`;
			if (!contributor?.login || isBot(contributor.login) || seen.has(key)) continue;
			seen.add(key);
			await addCandidateSignal({
				contributor,
				repo,
				reason: `贡献者；${whyRelevant}；公开贡献数 ${contributor.contributions ?? 0}`,
			});
		}
	} else if (contributors?.error) {
		leadRows.push({
			lead: repo.full_name,
			sourceFamily: "GitHub 仓库线索",
			whyRelevant,
			blocker: "贡献者列表读取失败",
			next: githubRecoveryHint(contributors),
		});
	}

	// PR search 是补充性 search 调用；一旦已经限流，跳过它把剩余 search 配额留给主召回，
	// 避免补充查询雪上加霜地耗尽配额。
	const pullRequests = rateLimitHit
		? {}
		: await safeGitHubJson(
				endpointWithParams("search/issues", {
					q: `repo:${repo.full_name} is:pr is:merged`,
					sort: "updated",
					order: "desc",
					per_page: Math.min(3, args.contributorsPerRepo),
				}),
			);
	if (Array.isArray(pullRequests.items)) {
		for (const item of pullRequests.items) {
			const user = item.user;
			const key = `${repo.full_name}:pr:${user?.login}`;
			if (!user?.login || isBot(user.login) || seen.has(key)) continue;
			seen.add(key);
			await addCandidateSignal({
				contributor: { login: user.login, html_url: user.html_url, contributions: 1 },
				repo,
				reason: `merged PR 作者；${item.title ?? whyRelevant}`,
				pr: true,
			});
		}
	}

	leadRows.push({
		lead: repo.full_name,
		sourceFamily: repo.owner?.type === "User" ? "GitHub 个人仓库线索" : "GitHub 仓库线索",
		whyRelevant,
		blocker: "身份、贡献深度和职业资料未核验前仍是找人来源线索",
		next: "核验个人资料、核心 PR / commit 和公开职业信号",
	});
}

async function runUserSearch() {
	const perPage = Math.min(Math.max(args.userSearchPerQuery, 1), 30);
	const searchedLogins = new Set();
	let hydratedProfiles = 0;
	for (const searchQuery of userSearchQueries(query)) {
		const request = endpointWithParams("search/users", {
			q: searchQuery,
			sort: "repositories",
			order: "desc",
			per_page: perPage,
		});
		const result = await safeGitHubJson(request);
		recallPaths.push(`GitHub user search：${searchQuery}`);
		if (!Array.isArray(result.items)) {
			if (result?.error) {
				leadRows.push({
					lead: "GitHub user search",
					sourceFamily: "GitHub 用户搜索",
					whyRelevant: searchQuery,
					blocker: "用户搜索失败",
					next: githubRecoveryHint(result),
				});
			}
			continue;
		}
		for (const item of result.items.slice(0, perPage)) {
			if (!item.login || searchedLogins.has(item.login)) continue;
			if (
				currentReadyCandidates() >= args.targetCount &&
				candidatesByLogin.size >= args.poolSize
			) {
				return;
			}
			if (hydratedProfiles >= args.maxUserProfiles) return;
			searchedLogins.add(item.login);
			hydratedProfiles += 1;
			await addProfileSignal({
				login: item.login,
				reason: searchQuery.includes("location:")
					? "个人公开 profile 的 location + repo 命中能力画像（GitHub 用户搜索）"
					: "个人公开 repo 命中能力画像（GitHub 用户搜索）",
			});
		}
	}
}

async function runRepositorySearch() {
	const seenRepos = new Set();
	for (const searchQuery of repositorySearchQueries(query)) {
		for (const sort of [searchQuery.includes("topic:") ? "updated" : "stars"]) {
			if (seenRepos.size >= args.repoSearchCount) return;
			const result = await safeGitHubJson(
				endpointWithParams("search/repositories", {
					q: searchQuery,
					sort,
					order: "desc",
					per_page: Math.min(Math.max(args.repoSearchCount * 2, 12), 30),
				}),
			);
			recallPaths.push(`GitHub repository search(${sort})：${searchQuery}`);
			if (!Array.isArray(result.items)) {
				if (result?.error) {
					leadRows.push({
						lead: "GitHub repository search",
						sourceFamily: "GitHub 仓库搜索",
						whyRelevant: searchQuery,
						blocker: "仓库搜索失败",
						next: githubRecoveryHint(result),
					});
				}
				continue;
			}
			const sorted = result.items
				.filter((repo) => repo?.full_name && !seenRepos.has(repo.full_name))
				.filter((repo) => seedMode === "global-benchmark" || repoEngineeringEvidence(repo))
				.filter(
					(repo) =>
						seedMode === "global-benchmark" || repoEcosystemEvidence(repo).matched,
				)
				.filter((repo) => seedMode === "global-benchmark" || !isWeakDirectoryRepo(repo))
				.sort((left, right) => {
					const leftEco = repoEcosystemEvidence(left).matched ? 1 : 0;
					const rightEco = repoEcosystemEvidence(right).matched ? 1 : 0;
					const leftRecent = Date.parse(left.pushed_at ?? left.updated_at ?? "") || 0;
					const rightRecent = Date.parse(right.pushed_at ?? right.updated_at ?? "") || 0;
					return (
						rightEco - leftEco ||
						(sort === "updated"
							? rightRecent - leftRecent
							: (right.stargazers_count ?? 0) - (left.stargazers_count ?? 0))
					);
				})
				.slice(0, Math.max(1, args.repoSearchCount - seenRepos.size));
			for (const repo of sorted) {
				seenRepos.add(repo.full_name);
				await processRepository(repo, `命中能力画像的工程 repo（${sort}）`);
				if (seenRepos.size >= args.repoSearchCount) break;
			}
		}
	}
}

function currentReadyCandidates() {
	return [...candidatesByLogin.values()].filter(
		(candidate) => candidate.profileGeoEvidence?.matched && candidate.evidence.length > 0,
	).length;
}

async function runSeedFallback() {
	recallPaths.push("China/Chinese ecosystem seed fallback");
	for (const repoName of seedRepos) {
		if (currentReadyCandidates() >= args.targetCount) break;
		const repo = await safeGitHubJson(`repos/${repoName}`);
		if (repo.error) {
			leadRows.push({
				lead: repoName,
				sourceFamily: "GitHub 仓库线索",
				whyRelevant: "agent runtime / tool calling / evaluation seed",
				blocker: "仓库元数据读取失败",
				next: githubRecoveryHint(repo),
			});
			continue;
		}
		await processRepository(repo, "China/Chinese ecosystem seed fallback");
	}
}

await runUserSearch();
await runRepositorySearch();
if (
	args.seedRepoCount > 0 &&
	currentReadyCandidates() < args.targetCount &&
	candidatesByLogin.size < Math.min(args.poolSize, args.targetCount * 6)
) {
	await runSeedFallback();
}

function primaryRepo(candidate) {
	return candidate.repos[0]?.fullName ?? `profile:${candidate.login}`;
}

function pickDiversified(pool, limit, maxPerRepo) {
	const picked = [];
	const perRepo = new Map();
	for (const candidate of pool) {
		const repo = primaryRepo(candidate);
		const count = perRepo.get(repo) ?? 0;
		if (count >= maxPerRepo) continue;
		picked.push(candidate);
		perRepo.set(repo, count + 1);
		if (picked.length >= limit) break;
	}
	return picked;
}

const candidatePool = [...candidatesByLogin.values()]
	.filter((candidate) => candidate.profileGeoEvidence?.matched && candidate.evidence.length > 0)
	.sort(
		(left, right) =>
			(right.score ?? 0) - (left.score ?? 0) || right.contributions - left.contributions,
	);
const candidates = pickDiversified(candidatePool, args.targetCount, args.maxPerRepoCandidates);
const candidateLogins = new Set(candidates.map((candidate) => candidate.login));
const potentialCandidates = args.includePotential
	? [...candidatesByLogin.values()]
			.filter((candidate) => !candidateLogins.has(candidate.login))
			.filter((candidate) => candidate.evidence.length > 0)
			.sort(
				(left, right) =>
					(right.score ?? 0) - (left.score ?? 0) ||
					right.contributions - left.contributions,
			)
			.slice(0, args.potentialCount)
	: [];
const potentialLogins = new Set(potentialCandidates.map((candidate) => candidate.login));

for (const candidate of candidatesByLogin.values()) {
	if (!candidate.profileGeoEvidence?.matched) {
		if (potentialLogins.has(candidate.login)) continue;
		leadRows.push({
			lead: `${candidate.name || candidate.login} (${candidate.login})`,
			sourceFamily: "GitHub 贡献者线索",
			whyRelevant: candidate.evidence[0] ?? "GitHub 工程线索",
			blocker: candidate.ecosystemGeoEvidence?.matched
				? `${candidate.ecosystemGeoEvidence.evidence}，但个人资料、公司、简介或地点未体现中国/中文生态职业信号，不能进入推荐名单`
				: "默认地域/市场未确认；缺公开中国/中文生态相关职业信号，不能进入推荐名单或强推荐",
			next: "核验公开职业资料、个人主页、LinkedIn、中文社区、中国市场或中国相关机构/公司信号",
		});
	}
}

function mdEscape(value) {
	return String(value ?? "")
		.replace(/\|/g, "\\|")
		.replace(/\n/g, " ");
}

const visibleRecallPaths = mergeUnique(recallPaths).slice(0, 4).join("；");
const lines = [
	"# GitHub 小批量寻访",
	"",
	"本轮目标",
	"",
	candidates.length > 0
		? `- 本轮按中国/中文生态优先召回，找到 ${candidates.length} 个建议先核实的人选，并保留 ${potentialCandidates.length} 个潜在人选/来源线索。`
		: rateLimitHit
			? "- 本轮 GitHub search 触发限流（搜索接口约 30 次/分钟），召回未完成；**0 人选是限流导致，不代表没有合适的人，也不是地域过滤过严**。等约 1 分钟窗口重置后重跑，或减少同时进行的搜索。"
			: "- 本轮按中国/中文生态优先召回，但没有形成可推进人选。",
	`- 能力画像：${query}`,
	"- 默认地域/市场不是姓名、照片、外貌、口音、族裔或国籍推断；只看公开职业信号。",
	"",
	"找人来源",
	"",
	"| 来源 | 看什么 | 本轮怎么用 |",
	"| --- | --- | --- |",
	`| GitHub / 开源项目 | repo owner、contributors、merged PR、个人 repo 和公开简介 | ${seedMode === "global-benchmark" ? "全球标杆/来源兜底" : seedMode === "custom" ? "用户指定种子兜底" : "按画像先找人、再用仓库证据补强，seed 仅兜底"}；召回路径：${visibleRecallPaths || "GitHub user/repo search"} |`,
	"",
	"推荐名单",
	"",
	"| 推荐级别 | 人选 | 招聘判断 | 为什么值得聊 | 把握 | 招聘风险 | 下一步 | 链接 |",
	"| --- | --- | --- | --- | --- | --- | --- | --- |",
];

for (const candidate of candidates) {
	const primaryRepo = candidate.repos[0] ?? {};
	const proofItems = mergeUnique([
		...candidate.evidence,
		...candidate.personalRepoEvidence.map((entry) => `个人 repo 证据：${entry}`),
	]);
	const whyWorthTalking =
		proofItems.length > 0
			? "公开资料显示他做过和岗位相关的开源实现，值得先核验 ownership 和转化可能"
			: "公开资料和项目方向相关，值得先确认真实贡献范围";
	lines.push(
		`| 建议先核实 | ${mdEscape(candidate.name || candidate.login)} (${mdEscape(candidate.login)}) | 先按中国/中文生态工程人选聊，确认是否适合全职、顾问或推荐人推进 | ${mdEscape(whyWorthTalking)} | 中 | 当前角色、可招性和核心贡献范围还没闭合 | 先补职业资料和 2-3 个核心贡献，再决定是否低压触达 | [GitHub](${mdEscape(candidate.profileUrl)})${primaryRepo.url ? ` / [相关项目](${mdEscape(primaryRepo.url)})` : ""} |`,
	);
}

if (candidates.length === 0) {
	lines.push(
		rateLimitHit
			? "| 暂无推荐 | - | 本轮不建议推进人选 | GitHub search 限流导致本轮未形成可推荐人选 | 低 | 0 人选是限流，不是没有合适的人，也不是地域过滤过严 | 等待窗口重置后重跑 | - |"
			: "| 暂无推荐 | - | 默认中国人才池下暂不建议推进人选 | 预算内没有找到同时具备公开工程证据和个人中国/中文生态职业信号的人选 | 低 | 不能为凑数把全球贡献者包装成推荐人选 | 扩大动态召回，或由用户明确放宽为全球人才池 | - |",
	);
}

if (potentialCandidates.length > 0) {
	lines.push(
		"",
		"待确认线索（含全球备选）",
		"",
		"| 线索 | 为什么相关 | 不能直接推荐的原因 | 下一步怎么确认 |",
		"| --- | --- | --- | --- |",
	);
	for (const candidate of potentialCandidates) {
		const proof = mergeUnique([
			...candidate.evidence,
			...candidate.personalRepoEvidence.map((entry) => `个人 repo 证据：${entry}`),
		])
			.slice(0, 2)
			.join("；");
		lines.push(
			`| ${mdEscape(candidate.name || candidate.login)} (${mdEscape(candidate.login)}) | ${mdEscape(proof)} | ${mdEscape(candidate.profileGeoEvidence?.matched ? "同仓库推荐名额已达上限，或仍需确认贡献深度" : "默认地域/市场未确认，缺个人资料、公司、简介或地点中的中国/中文生态职业信号")} | 核验个人资料、核心 PR / commit 和公开职业信号；若要推进全球人才池，需用户明确放宽地域 |`,
		);
	}
}

const visibleLeadRows = leadRows.slice(0, 12);
if (visibleLeadRows.length > 0) {
	lines.push(
		"",
		"待确认线索",
		"",
		"| 线索 | 为什么相关 | 还差什么 | 下一步怎么确认 |",
		"| --- | --- | --- | --- |",
	);
	for (const row of visibleLeadRows) {
		lines.push(
			`| ${mdEscape(row.lead)} | ${mdEscape(row.whyRelevant ?? "与目标工程方向相关")} | ${mdEscape(row.blocker)} | ${mdEscape(row.next)} |`,
		);
	}
	if (leadRows.length > visibleLeadRows.length) {
		lines.push(
			`| 其余找人来源线索 | 还有 ${leadRows.length - visibleLeadRows.length} 条弱线索/失败线索未展开 | 小批量报告不展开全部调试细节 | 用户批准后再做第二轮核验 |`,
		);
	}
}

lines.push(
	"",
	"匹配依据",
	"",
	"| 人选 / 线索 | 招聘判断 | 公开证据 | 把握 | 主要风险 | 下一步 |",
	"| --- | --- | --- | --- | --- | --- |",
);

for (const candidate of candidates) {
	const engineeringEvidence = mergeUnique([
		...candidate.evidence,
		...candidate.personalRepoEvidence.map((entry) => `个人 repo：${entry}`),
	])
		.slice(0, 4)
		.join("；");
	lines.push(
		`| ${mdEscape(candidate.name || candidate.login)} (${mdEscape(candidate.login)}) | 建议先核实是否适合工程人选推进 | ${mdEscape(engineeringEvidence)} | 中 | 需要核验身份、当前角色、贡献深度和可招性 | 用户确认后补职业资料、已合并 PR 和项目 ownership |`,
	);
}

if (candidates.length === 0) {
	lines.push(
		rateLimitHit
			? "| GitHub search 召回 | 本轮不建议推进人选 | 动态召回触发 GitHub search 限流，未完成 | 低 | 不能用限流后的 0 人选判断方向质量 | 等待窗口重置后重跑，或降低 search 次数 / 配置 GH_TOKEN |"
			: "| 默认地域/市场升级门槛 | 默认中国人才池下暂不建议推进人选 | 动态召回内没有贡献者同时具备公开工程证据和个人中国/中文生态职业信号 | 中 | 只能证明这些是找人来源线索，不能证明符合默认人才池 | 用户批准后扩大动态召回、补充项目来源，或明确放宽为全球人才池 |",
	);
}

lines.push(
	"",
	"本轮覆盖缺口",
	"",
	...(rateLimitHit
		? [
				"- **GitHub search 本轮触发限流（约 30 次/分钟）**：部分召回未完成。若候选偏少或为 0，主因是限流，不是地域过滤或没有合适的人；等约 1 分钟窗口重置后重跑，或减少同时进行的搜索次数。",
			]
		: []),
	"- 本轮是小批量召回，不是最终找人质量证明；人选仍需要人工相关性复核。",
	"- 不推断可用性、职级、薪酬、搬迁、私人联系方式或沟通意愿。",
	"- 默认地域/市场是进入推荐名单的门槛：找人来源可以保留全球线索；缺公开中国/中文生态相关职业信号时不能进入推荐名单或强推荐。",
	"- GitHub 额度或认证不足时，下一步是在宿主环境配置 `GH_TOKEN` / `GITHUB_TOKEN`、GitHub MCP 或 `gh auth`；不要因为 GitHub token 改走 Sifta CLI。",
	"- 固定 seed 只作为动态召回不足时的找人来源兜底，不是主路径；单个大仓库不会默认占满推荐名单。",
	"- 仓库/项目线索在身份核验和证据评级前仍是找人来源线索。",
	"",
	"为什么先停在这里",
	"",
	candidates.length > 0
		? "- 小批量报告到这里停止；进入触达前必须先核验职业资料、核心贡献深度和同人身份。"
		: "- 本轮没有形成可推进人选；不要换源凑数或把仓库/项目线索包装成推荐人选。",
	"",
	"本轮边界",
	"",
	"- 本轮只读取公开 GitHub 信息，不查询私人联系方式，不自动发送消息，不把 token/额度问题改写成 Sifta CLI 必经路径。",
	"",
	"下一步",
	"",
	candidates.length > 0
		? "- 用户确认后，核验候选人的公开职业资料、核心 PR / commit 深度和同人身份，再决定是否写触达草稿。"
		: rateLimitHit
			? "- 等待 GitHub search 窗口重置后重跑，或降低 search 次数 / 配置 GH_TOKEN；不要用本轮 0 人选判断方向质量。"
			: "- 用户确认后，扩大动态召回、补充项目来源，或明确放宽为全球人才池。",
);

process.stdout.write(`${lines.join("\n")}\n`);
