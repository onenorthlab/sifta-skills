#!/usr/bin/env node

import {
	cleanSearchQuery,
	coreQueryTerms,
	DEFAULT_CONFIG as RECALL_CONFIG,
	queryConceptPairs,
	scoreCandidateTwoAxis,
} from "./recall-lib.mjs";

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
		maxElapsedMs: 55_000,
		includePotential: true,
		seeds: [],
		json: true,
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
		if (arg === "--max-elapsed-ms" && next) args.maxElapsedMs = Number(next);
		if (arg === "--include-potential" && next) args.includePotential = next !== "false";
		if (arg === "--seed" && next) args.seeds.push(next);
		// 默认输出 proposal JSON，由 skill/template 渲染最终招聘报告；--markdown 仅作人工调试 fallback。
		if (arg === "--json") {
			args.json = next !== "false";
			continue;
		}
		if (arg === "--markdown") {
			args.json = false;
			continue;
		}
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

for (const [profile, repos] of Object.entries(RECALL_CONFIG.profileSourceRepos ?? {})) {
	if (!Array.isArray(repos)) continue;
	profileSeeds[profile] = mergeUnique([...repos, ...(profileSeeds[profile] ?? [])]);
	profileSeeds[`${profile}-global`] = profileSeeds[profile];
}

for (const profile of [
	"mcp-runtime",
	"agent-runtime",
	"llm-infra-training",
	"llm-app-indie",
	"vla-wam-robotics",
	"llm-foundation",
	"agent-evaluation",
]) {
	profileSeeds[`${profile}-global`] = profileSeeds[profile];
}

const githubToken = (process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "").trim();
const githubApiBaseUrl = (process.env.GITHUB_API_BASE_URL || "https://api.github.com").replace(
	/\/+$/u,
	"",
);
const GITHUB_REQUEST_TIMEOUT_MS = 12_000;

async function githubJson(endpoint) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), GITHUB_REQUEST_TIMEOUT_MS);
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
let timeBudgetHit = false;

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
			if (timeBudgetExceeded()) {
				return {
					error: "GitHub time budget exceeded",
					status: "time_budget_exceeded",
					budgetTimedOut: true,
				};
			}
			return await githubJson(endpoint);
		} catch (error) {
			const rateLimited = isRateLimitError(error);
			if (rateLimited) {
				rateLimitHit = true;
				// 仅在整轮第一次限流时退避一次，避免多次 60s 等待拖垮宿主 agent 的执行预算。
				if (attempt === 0 && rateLimitBackoffsUsed < MAX_RATE_LIMIT_BACKOFFS) {
					rateLimitBackoffsUsed += 1;
					const resetMs = Number(error?.rateLimitReset) * 1000;
					const waitMs = Math.max(
						0,
						Number.isFinite(resetMs) && resetMs > Date.now()
							? Math.min(
									resetMs - Date.now() + 1500,
									8_000,
									timeRemainingMs() - 2_000,
								)
							: Math.min(8_000, timeRemainingMs() - 2_000),
					);
					if (waitMs <= 0) {
						timeBudgetHit = true;
						return {
							error: "GitHub rate limit backoff skipped because time budget is exhausted",
							status: "time_budget_exceeded",
							budgetTimedOut: true,
							rateLimited: true,
						};
					}
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
	if (error?.budgetTimedOut) {
		return "本轮 GitHub 小批量时间预算已用完；先使用已返回的部分线索，下一轮降低搜索次数或扩大预算后重跑";
	}
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

// 从 recall-config.json 编译；非穷尽的地域/公司信号正则种子，最终生态归属由宿主 Agent 依 rubric 判断。
// Owner 可在 config 的 geoSignalPatterns 数组里增删条目，脚本无需改动。
const publicGeoPatterns = (RECALL_CONFIG.geoSignalPatterns ?? []).map(
	(pattern) => new RegExp(pattern, "iu"),
);

// 从 recall-config.json 编译；非穷尽的召回种子（性质等同论文 seed），最终生态归属由宿主 Agent 依 rubric 判断。
// Owner 可在 config 的 ecosystemRepoPatterns 数组里增删条目，脚本无需改动。
const chinaEcosystemRepoPatterns = (RECALL_CONFIG.ecosystemRepoPatterns ?? []).map(
	(pattern) => new RegExp(pattern, "iu"),
);

// 注：原 engineeringKeywordPatterns（agent/runtime/MCP/RAG… 硬编码方向白名单）已删除。
// "这个 repo 是不是目标工程方向"由 query 驱动的 repoMatchesDirection(coreTerms) 判断，
// 方向白名单枚举不尽（robotics/VLA/新框架层出不穷），会误过滤也会漏，不该写死在脚本里。

// 弱目录正则来自 recall-config.json（Owner 可调），从字符串编译。
const weakDirectoryRepoPatterns = (RECALL_CONFIG.weakDirectoryPatterns ?? []).map(
	(pattern) => new RegExp(pattern, "iu"),
);

function publicGeoEvidence(user) {
	const fields = [
		["location", user.location],
		["company", user.company],
		["blog", user.blog],
		["bio", user.bio],
	];
	const matches = [];
	// 强信号 = location/company 字段明确写了中国地点/中国公司/.cn → 判定"真在中国/中国职业身份"。
	// 弱信号 = 仅 bio/blog 出现中文字符或中文生态词 → 泛中文生态(常见于湾区华裔 diaspora)，
	// 不足以判"在中国"。区分二者是为了让 geo 信号有区分度：否则 bio 含一个汉字的全球高贡献者
	// 也被当"中国优先"，geo 加分人人都有、形同虚设，档内排序退回纯贡献量，真·在中国的人反而排不上来。
	let strong = false;
	const strongFields = new Set(["location", "company"]);
	for (const [field, rawValue] of fields) {
		const value = String(rawValue ?? "").trim();
		if (!value) continue;
		const patternHit = publicGeoPatterns.some((pattern) => pattern.test(value));
		const hanHit = /\p{Script=Han}/u.test(value);
		if (patternHit || hanHit) matches.push(`${field}: ${value}`);
		// 只有 location/company 命中中国"地点/机构"模式才算强信号；纯汉字不算强。
		if (strongFields.has(field) && patternHit) strong = true;
	}
	return {
		matched: matches.length > 0,
		strong,
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


function userRepoEngineeringEvidence(repositories, coreTermsList = []) {
	return repositories
		.filter((repo) => !isWeakDirectoryRepo(repo))
		.filter((repo) => repoMatchesDirection(repo, coreTermsList))
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

// 重排打分委托给纯函数 scoreCandidateTwoAxis（机制在 recall-lib、调参在 recall-config）。
// 这里只把结果写回 candidate 供报告 / JSON 输出复核，并返回排序用 score。
// 两轴 + 硬约束（弱证据档不反超强档）由 recall-lib.test.mjs 确定性单测保证。
function candidateScore(candidate) {
	const scored = scoreCandidateTwoAxis(candidate, coreTerms, RECALL_CONFIG);
	candidate.evidenceTier = scored.evidenceTier;
	candidate.evidenceRank = scored.evidenceRank;
	candidate.priority = scored.priority;
	candidate.signals = scored.signals;
	candidate.reachability = scored.reachability;
	return scored.score;
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
args.maxElapsedMs = positiveNumber(args.maxElapsedMs, 55_000);

const startedAt = Date.now();

function timeRemainingMs() {
	return Math.max(0, args.maxElapsedMs - (Date.now() - startedAt));
}

function timeBudgetExceeded() {
	if (Date.now() - startedAt >= args.maxElapsedMs) {
		timeBudgetHit = true;
		return true;
	}
	return false;
}

const query = args.query || "AI agent runtime, tool calling, evaluation system";
const seedRepos = (
	args.seeds.length ? args.seeds : (profileSeeds[args.profile] ?? profileSeeds["agent-runtime"])
).slice(0, args.seedRepoCount);
const seedMode = args.seeds.length
	? "custom"
	: args.profile.includes("global")
		? "global-benchmark"
		: "cn-default";
const requiresGeoFit = seedMode === "cn-default";

const candidatesByLogin = new Map();
const leadRows = [];
const seen = new Set();
const recallPaths = [];

function queryFocusTerms(value) {
	// 纯 query 驱动：取用户 query 的核心词；query 退化到没有实词时退回清洗后的原始分词，
	// 而不是套一张 engineering 关键词白名单（那会把方向绑死在 agent/MCP 等固定词上）。
	const core = coreQueryTerms(value);
	if (core.length) return core;
	return cleanSearchQuery(value)
		.split(/\s+/u)
		.filter((term) => term.length >= 3)
		.map((term) => term.toLowerCase());
}

// repo 是否与 query 方向相关：命中用户 query 的任一核心词即算相关。
// 纯 query 驱动，不套 engineering 白名单——方向由用户 query 定义，脚本不预设是 agent 还是 robotics。
// coreTermsList 为空（query 退化）时不过滤，避免误杀（宁可多召回、由 Agent 判方向）。
function repoMatchesDirection(repo, coreTermsList) {
	if (!coreTermsList.length) return true;
	const text = [
		repo.full_name,
		repo.name,
		repo.description,
		Array.isArray(repo.topics) ? repo.topics.join(" ") : "",
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
	return coreTermsList.some((term) => text.includes(term));
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

// location 变体来自 recall-config.json（Owner 可调，默认中国/中文生态优先）。
const defaultUserSearchLocations = RECALL_CONFIG.locationVariants ?? ["China"];

function quoteQualifierValue(value) {
	return /\s/u.test(value) ? `"${value}"` : value;
}

// 腿 1 people-first：主概念词 × location 变体 + 一条不带 location 的 broad。
// 召回高、快，证据通常弱（只证明"可能相关的人"）。
// repos:>N 门槛 config 化：阈值过高会把"公开 repo 少但很强"的人(如只发 1 个核心 infra repo
// 的作者)直接挡在召回外——这是诊断出的真实 recall-miss 来源之一，故下调并外置到 config。
const userReposQualifier = `repos:>${Math.max(0, (RECALL_CONFIG.userSearchMinRepos ?? 1) - 1)}`;

function peopleFirstQueries(value) {
	const primary = queryConceptPairs(value)[0];
	const broadQuery = `${primary} type:user ${userReposQualifier}`;
	if (seedMode === "global-benchmark") return [broadQuery];
	const locationQueries = defaultUserSearchLocations
		.slice(0, 5)
		.map(
			(location) =>
				`${primary} location:${quoteQualifierValue(location)} type:user ${userReposQualifier}`,
		);
	return mergeUnique([...locationQueries, broadQuery]);
}

// 腿 3 profile-first：query 的其余概念词对 × location 变体（通用方向词召回）。
// 覆盖 research / 多概念画像被主概念 AND 漏掉的方向（embodied / world-model / robotics 等）。
function profileFirstQueries(value) {
	if (seedMode === "global-benchmark") return [];
	const pairs = queryConceptPairs(value).slice(1, 4);
	const locations = defaultUserSearchLocations.slice(0, 3);
	const queries = [];
	for (const pair of pairs) {
		for (const location of locations) {
			queries.push(
				`${pair} location:${quoteQualifierValue(location)} type:user ${userReposQualifier}`,
			);
		}
	}
	return mergeUnique(queries);
}

async function addCandidateSignal({
	contributor,
	repo,
	reason,
	pr = false,
	legType = "people",
	ownedRepo = false,
}) {
	if (timeBudgetExceeded()) return;
	if (!contributor?.login || isBot(contributor.login)) return;
	const login = contributor.login;
	const user = await safeGitHubJson(`users/${encodeURIComponent(login)}`);
	if (user.error) {
		leadRows.push({
			lead: login,
			profileUrl: contributor.html_url ?? `https://github.com/${login}`,
			url: contributor.html_url ?? `https://github.com/${login}`,
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
	let lastActiveAt = null; // 个人仓库最近 pushed_at，用于档内活跃度排序信号
	if (!requiresGeoFit || profileGeo.matched || ecosystemGeo.matched) {
		if (timeBudgetExceeded()) return;
		const repos = await safeGitHubJson(
			endpointWithParams(`users/${encodeURIComponent(login)}/repos`, {
				per_page: 6,
				sort: "pushed",
			}),
		);
		if (Array.isArray(repos)) {
			personalRepoEvidence = userRepoEngineeringEvidence(repos, coreTerms);
			// 取个人 repo 最新 pushed_at（sort=pushed 已降序，直接取第一个非空值）
			for (const r of repos) {
				if (r.pushed_at) {
					lastActiveAt = r.pushed_at;
					break;
				}
			}
		}
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
		legTypes: [],
		profileGeoEvidence: profileGeo,
		ecosystemGeoEvidence: ecosystemGeo,
		geoEvidence,
		profileRaw: user,
		// lastActiveAt：个人 repo 最近 pushed_at，档内活跃度排序信号的数据来源
		lastActiveAt: null,
	};
	if (!nextCandidate.legTypes.includes(legType)) nextCandidate.legTypes.push(legType);
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
		// pushedAt 来自 repo.pushed_at（贡献仓库最近 push 时间），用于档内活跃度排序信号
		pushedAt: repo.pushed_at ?? null,
	});
	nextCandidate.evidence = mergeUnique([
		...nextCandidate.evidence,
		`${repo.full_name}：${reason}`,
		repoEcosystemEvidence(repo).matched ? repoEcosystemEvidence(repo).evidence : "",
		profileGeo.matched ? `公开 profile 信号：${profileGeo.evidence}` : "",
	]);
	nextCandidate.personalRepoEvidence = mergeUnique([
		...nextCandidate.personalRepoEvidence,
		ownedRepo && !isWeakDirectoryRepo(repo)
			? `${repo.full_name}${Number.isFinite(repo.stargazers_count) ? `；stars=${repo.stargazers_count}` : ""}${repo.description ? `；${repo.description}` : ""}`
			: "",
		...personalRepoEvidence,
	]);
	nextCandidate.geoEvidence = nextCandidate.geoEvidence?.matched
		? nextCandidate.geoEvidence
		: geoEvidence;
	// lastActiveAt 取历次信号中最新的（越新越好，不会因后来腿覆盖掉更新的时间）
	if (lastActiveAt) {
		const prev = nextCandidate.lastActiveAt;
		if (!prev || lastActiveAt > prev) nextCandidate.lastActiveAt = lastActiveAt;
	}
	nextCandidate.score = candidateScore(nextCandidate);
	candidatesByLogin.set(login, nextCandidate);
}

async function addProfileSignal({ login, reason, repo, legType = "people", ownedRepo = false }) {
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
		legType,
		ownedRepo,
	});
}

async function processRepository(repo, whyRelevant, legType = "repo-contributor") {
	if (timeBudgetExceeded()) return;
	if (!repo?.full_name || !repo?.html_url) return;
	if (isWeakDirectoryRepo(repo)) {
		leadRows.push({
			lead: repo.full_name,
			url: repo.html_url,
			sourceFamily: "GitHub 目录/列表线索",
			whyRelevant,
			blocker: "目录/awesome/list/integration 类 repo 只能作为找人来源，不能单独升级为候选人",
			next: "从该目录继续追具体实现型 repo、作者主页或核心 PR 后再评估候选人",
		});
		return;
	}
	const ownerLogin = repo.owner?.login;
	const ownerType = repo.owner?.type;
	if (ownerLogin && ownerType === "User") {
		await addProfileSignal({
			login: ownerLogin,
			repo,
			legType,
			reason: `repo owner；${whyRelevant}`,
			ownedRepo: true,
		});
	}

	if (timeBudgetExceeded()) return;
	const contributors = await safeGitHubJson(
		endpointWithParams(`repos/${repo.full_name}/contributors`, {
			per_page: args.contributorsPerRepo,
		}),
	);
	if (Array.isArray(contributors)) {
		for (const contributor of contributors) {
			if (timeBudgetExceeded()) break;
			const key = `${repo.full_name}:contributor:${contributor.login}`;
			if (!contributor?.login || isBot(contributor.login) || seen.has(key)) continue;
			seen.add(key);
			await addCandidateSignal({
				contributor,
				repo,
				legType,
				reason: `贡献者；${whyRelevant}；公开贡献数 ${contributor.contributions ?? 0}`,
			});
		}
	} else if (contributors?.error) {
		leadRows.push({
			lead: repo.full_name,
			url: repo.html_url,
			sourceFamily: "GitHub 仓库线索",
			whyRelevant,
			blocker: "贡献者列表读取失败",
			next: githubRecoveryHint(contributors),
		});
	}

	// PR search 是补充性 search 调用；一旦已经限流，跳过它把剩余 search 配额留给主召回，
	// 避免补充查询雪上加霜地耗尽配额。
	const pullRequests =
		rateLimitHit || timeBudgetExceeded()
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
			if (timeBudgetExceeded()) break;
			const user = item.user;
			const key = `${repo.full_name}:pr:${user?.login}`;
			if (!user?.login || isBot(user.login) || seen.has(key)) continue;
			seen.add(key);
			await addCandidateSignal({
				contributor: { login: user.login, html_url: user.html_url, contributions: 1 },
				repo,
				legType,
				reason: `merged PR 作者；${item.title ?? whyRelevant}`,
				pr: true,
			});
		}
	}

	leadRows.push({
		lead: repo.full_name,
		url: repo.html_url,
		sourceFamily: repo.owner?.type === "User" ? "GitHub 个人仓库线索" : "GitHub 仓库线索",
		whyRelevant,
		blocker: "身份、贡献深度和职业资料未核验前仍是找人来源线索",
		next: "核验个人资料、核心 PR / commit 和公开职业信号",
	});
}

// 通用 user-search 腿执行器；people-first 和 profile-first 共用，只是 legType / 查询集不同。
// 共享 searchedLogins / hydratedProfiles 预算，按 login 去重进 candidatesByLogin（即多腿合并）。
const userSearchState = { searchedLogins: new Set(), hydratedProfiles: 0 };

async function runUserSearchLeg(legType, queries) {
	const perPage = Math.min(Math.max(args.userSearchPerQuery, 1), 30);
	// 排序 config 化：默认空 = GitHub best-match 相关度排序（方向高度匹配的人优先）。
	// 旧的 sort=repositories 会按 repo 数排，把方向完美但 repo 数一般的人埋在高 repo 数账号后、
	// 挤出 per_page 窗口——这是诊断出的另一个真实 recall-miss 来源。
	const userSearchSort = RECALL_CONFIG.userSearchSort ?? "";
	for (const searchQuery of queries) {
		if (timeBudgetExceeded()) return;
		if (userSearchState.hydratedProfiles >= args.maxUserProfiles) return;
		const request = endpointWithParams("search/users", {
			q: searchQuery,
			...(userSearchSort ? { sort: userSearchSort, order: "desc" } : {}),
			per_page: perPage,
		});
		const result = await safeGitHubJson(request);
		recallPaths.push(`GitHub user search[${legType}]：${searchQuery}`);
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
			if (timeBudgetExceeded()) return;
			if (!item.login || userSearchState.searchedLogins.has(item.login)) continue;
			if (userSearchState.hydratedProfiles >= args.maxUserProfiles) return;
			userSearchState.searchedLogins.add(item.login);
			userSearchState.hydratedProfiles += 1;
			await addProfileSignal({
				login: item.login,
				legType,
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
		if (timeBudgetExceeded()) return;
		for (const sort of [searchQuery.includes("topic:") ? "updated" : "stars"]) {
			if (timeBudgetExceeded()) return;
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
				.filter(
					(repo) =>
						seedMode === "global-benchmark" || repoMatchesDirection(repo, coreTerms),
				)
				.filter(
					(repo) =>
						seedMode === "global-benchmark" || repoEcosystemEvidence(repo).matched,
				)
				.filter((repo) => !isWeakDirectoryRepo(repo))
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
				if (timeBudgetExceeded()) return;
				seenRepos.add(repo.full_name);
				await processRepository(repo, `命中能力画像的工程 repo（${sort}）`);
				if (seenRepos.size >= args.repoSearchCount) break;
			}
		}
	}
}

async function runSeedFallback() {
	const sourceReason =
		seedMode === "global-benchmark"
			? "profile implementation source catalog"
			: "China/Chinese ecosystem seed fallback";
	recallPaths.push(sourceReason);
	for (const repoName of seedRepos) {
		if (timeBudgetExceeded()) return;
		const repo = await safeGitHubJson(`repos/${repoName}`);
		if (repo.error) {
			leadRows.push({
				lead: repoName,
				url: `https://github.com/${repoName}`,
				sourceFamily: "GitHub 仓库线索",
				whyRelevant: "agent runtime / tool calling / evaluation seed",
				blocker: "仓库元数据读取失败",
				next: githubRecoveryHint(repo),
			});
			continue;
		}
		await processRepository(repo, sourceReason, "source-catalog");
	}
}

const coreTerms = coreQueryTerms(query);
// 三腿并行召回（Promise.all），合并去重进 candidatesByLogin（按 login）：
// 腿 1 people-first：主概念 × location + broad。
// 腿 3 profile-first：其余概念方向词 × location（通用方向词召回，补 research/多概念画像）。
// 腿 2 repo/contributor-first：runRepositorySearch（repo → contributors / merged PR 作者）。
// 并发安全：JS 单线程，候选去重的 has+add 同步相邻为原子；按 login 在写入处去重。
// 并发度=3 腿（最多 3 个 search 在飞），比一次性发全部查询温和；瞬时打爆 search 配额时由
// safeGitHubJson 的限流识别 + 有界退避兜底，并如实记 providerFailure，不当 recall=0。
if (RECALL_CONFIG.parallelLegs === true) {
	await Promise.all([
		runUserSearchLeg("people", peopleFirstQueries(query)),
		runUserSearchLeg("profile", profileFirstQueries(query)),
		runRepositorySearch(),
	]);
} else {
	await runUserSearchLeg("people", peopleFirstQueries(query));
	await runUserSearchLeg("profile", profileFirstQueries(query));
	await runRepositorySearch();
}
if (args.seedRepoCount > 0) await runSeedFallback();

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

function hasImplementationEvidence(candidate) {
	return (
		(candidate.personalRepoEvidence?.length ?? 0) > 0 ||
		(candidate.prCount ?? 0) > 0 ||
		(candidate.contributions ?? 0) >= (RECALL_CONFIG.scoring?.contribLowAt ?? 3)
	);
}

const candidatePool = [...candidatesByLogin.values()]
	.filter(
		(candidate) =>
			(!requiresGeoFit || candidate.profileGeoEvidence?.matched) &&
			candidate.evidence.length > 0 &&
			hasImplementationEvidence(candidate) &&
			// 弱证据档不进推荐人选，只能降为待核验线索（弱线索不冒充候选）
			candidate.evidenceTier !== "weak",
	)
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
	if (candidateLogins.has(candidate.login) || potentialLogins.has(candidate.login)) continue;
	// 既非推荐也未进 potential slice 的候选不能静默丢失（否则方向+地域都对、但 GitHub 证据量
	// 不及全球主力的人会凭空消失——这是实测召回不到 Owner golden 的真因之一）。
	// 地域命中的降为 profile-signal 线索；地域未确认的降为待核验线索，都进来源地图而非候选名单。
	const geoMatched = candidate.profileGeoEvidence?.matched;
	leadRows.push({
		lead: `${candidate.name || candidate.login} (${candidate.login})`,
		profileUrl: candidate.profileUrl,
		url: candidate.profileUrl,
		sourceFamily: geoMatched ? "GitHub profile 线索" : "GitHub 贡献者线索",
		whyRelevant: candidate.evidence[0] ?? "GitHub 工程线索",
		blocker: geoMatched
			? "方向/地域命中但 GitHub 公开证据量不足以进推荐人选，保留为待核验 profile 线索"
			: !requiresGeoFit
				? "证据分、贡献深度或多样性预算不足以进推荐人选，保留为待核验开源线索"
				: candidate.ecosystemGeoEvidence?.matched
					? `${candidate.ecosystemGeoEvidence.evidence}，但个人资料、公司、简介或地点未体现中国/中文生态职业信号，不能进入推荐人选`
					: "默认地域/市场未确认；缺公开中国/中文生态相关职业信号，不能进入推荐人选或强推荐",
		next: requiresGeoFit
			? "核验公开职业资料、个人主页、LinkedIn、中文社区、中国市场或中国相关机构/公司信号"
			: "核验公开职业资料、个人主页、LinkedIn、核心 PR / commit 和项目 ownership",
	});
}

// --json：输出 proposal 形状给 recall-outcome harness 判分（不改 markdown 主路径）。
// recommended → bucket soft（脚本只敢说"建议先核实"，从不自报 strong）；
// potential → bucket lead（待核验线索，弱来源不冒充候选）；
// 仓库/来源线索（leadRows）单独放 sourceLeads，不进 people，不污染 negativeHits。
if (args.json) {
	const toPerson = (candidate, bucket) => ({
		source: "github",
		displayName: candidate.name || candidate.login,
		name: candidate.name || candidate.login,
		login: candidate.login,
		profileUrl: candidate.profileUrl,
		url: candidate.profileUrl,
		location: candidate.location || "",
		company: candidate.company || "",
		bio: candidate.bio || "",
		followers: candidate.profileRaw?.followers ?? null,
		priority: candidate.priority ?? (bucket === "soft" ? "B" : "C"),
		bucket,
		talentPool: bucket,
		legTypes: candidate.legTypes ?? [],
		evidenceTier: candidate.evidenceTier ?? null,
		evidenceStatus:
			candidate.evidenceStatus ??
			(bucket === "soft"
				? "implementation-evidence"
				: candidate.profileGeoEvidence?.matched
					? "profile-signal-lead"
					: "source-map-lead"),
		score: candidate.score ?? 0,
		contributions: candidate.contributions ?? 0,
		signals: candidate.signals ?? [],
		// 可达性：仅公开通道是否存在 + hireable 待确认提示；不含联系方式值、不作可招聘性/意愿结论。
		reachability: candidate.reachability ?? {
			channels: [],
			hireableFlag: false,
			note: "未见公开可达通道；需先找到本人公开职业联系方式后再评估触达",
		},
		evidence: mergeUnique([
			...candidate.evidence,
			...candidate.personalRepoEvidence.map((entry) => `个人 repo：${entry}`),
		]).slice(0, 5),
		risk:
			bucket === "soft"
				? "需要核验当前角色、核心贡献 ownership、同人身份和可招性；不能仅凭 repo 信号直接触达"
				: "当前只作为待核验线索；证据深度、候选意愿或角色匹配尚不足，不能包装成候选人",
		nextAction:
			bucket === "soft"
				? "补 2-3 个核心 PR / commit、个人主页或 LinkedIn，再决定是否写低压触达草稿"
				: "先核验个人资料、核心 PR / commit 和公开职业信号；达到候选门槛后再升级",
		topRepos: (candidate.repos ?? []).slice(0, 3).map((r) => r.fullName),
		// 原始地域字段：供宿主 Agent 依 rubric 判断清单外的新中国机构/公司，不依赖脚本正则结论。
		// 只含公开 profile 字段（GitHub 公开数据），守隐私红线：不含私人邮箱/手机，不推断求职意愿。
		rawGeoFields: {
			location: candidate.location || null,
			company: candidate.company || null,
			bio: candidate.bio || null,
			blog: candidate.blog || null,
			// 候选人贡献过的 repo 的 org/user owner（去重），供 Agent 核查清单外的新中国生态机构。
			contributedRepoOwners: [
				...new Set(
					(candidate.repos ?? [])
						.map((r) => r.fullName?.split("/")[0])
						.filter(Boolean),
				),
			].slice(0, 8),
		},
	});
	const proposal = {
		query,
		executedSources: ["github"],
		coverage: timeBudgetHit ? "partial" : rateLimitHit ? "provider_failure" : "pilot",
		providerFailed: rateLimitHit,
		timeBudgetHit,
		maxElapsedMs: args.maxElapsedMs,
		rawPoolSize: candidatesByLogin.size,
		recommendedCount: candidates.length,
		potentialCount: potentialCandidates.length,
		recallPaths: mergeUnique(recallPaths),
			people: [
				...candidates.map((c) => toPerson(c, "soft")),
			],
			leadPeople: potentialCandidates.map((c) => ({
				...toPerson(c, "lead"),
				canEnterCandidateTable: false,
			})),
			sourceLeads: leadRows.slice(0, 20),
		};
	process.stdout.write(`${JSON.stringify(proposal, null, 2)}\n`);
	process.exit(0);
}

process.stdout.write(
	`${JSON.stringify(
		{
			status: "debug-summary",
			executedSources: ["github"],
			recommendedCount: candidates.length,
			potentialCount: potentialCandidates.length,
			providerFailed: rateLimitHit,
			timeBudgetHit,
			people: candidates.map((candidate) => ({
				displayName: candidate.name || candidate.login,
				login: candidate.login,
				profileUrl: candidate.profileUrl,
				evidence: mergeUnique([...candidate.evidence, ...candidate.personalRepoEvidence]).slice(0, 5),
				topRepos: (candidate.repos ?? []).slice(0, 3).map((repo) => ({
					name: repo.fullName || repo.name,
					url: repo.url,
				})),
			})),
			otherLeads: potentialCandidates.slice(0, 10).map((candidate) => ({
				displayName: candidate.name || candidate.login,
				login: candidate.login,
				profileUrl: candidate.profileUrl,
				reasonNotRecommended:
					candidate.profileGeoEvidence?.matched
						? "仍需确认贡献深度和当前角色"
						: "缺公开中国/中文生态职业信号或个人资料交叉验证",
			})),
			nextAction:
				candidates.length > 0
					? "核职业资料、核心贡献和同人身份后再触达。"
					: "扩大同来源召回或补充项目入口，不换源凑数。",
		},
		null,
		2,
	)}\n`,
);
