#!/usr/bin/env node

import { execFileSync } from "node:child_process";

function parseArgs(argv) {
	const args = {
		query: "",
		checkpoint: "",
		targetCount: 3,
		skipStatus: false,
		json: true,
	};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const next = argv[index + 1];
		if (arg === "--query" && next) args.query = next;
		if (arg === "--checkpoint" && next) args.checkpoint = next;
		if (arg === "--target-count" && next) args.targetCount = Number(next);
		if (arg === "--skip-status") args.skipStatus = true;
		if (arg === "--json") {
			args.json = next !== "false";
			continue;
		}
		if (arg === "--markdown") {
			args.json = false;
			continue;
		}
		if (arg.startsWith("--") && arg !== "--skip-status" && arg !== "--json" && arg !== "--markdown")
			index += 1;
	}
	return args;
}

function runJson(args, timeout = 60_000) {
	const stdout = execFileSync("sifta-cli", args, {
		encoding: "utf8",
		maxBuffer: 16 * 1024 * 1024,
		timeout,
	});
	return JSON.parse(stdout);
}

function mdEscape(value) {
	return String(value ?? "")
		.replace(/\|/g, "\\|")
		.replace(/\n/g, " ")
		.trim();
}

function stripMarkdown(value) {
	return mdEscape(value)
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/^#+\s*/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function truncate(value, maxLength = 220) {
	const text = mdEscape(value);
	return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function evidenceText(person) {
	const packet = person.projectFit?.evidencePacket ?? person.raw?.evidencePacket ?? {};
	const career = Array.isArray(packet.career) ? packet.career : [];
	const rawEvidence = Array.isArray(person.raw?.evidence) ? person.raw.evidence : [];
	const context = [...career, ...rawEvidence]
		.map(stripMarkdown)
		.find((item) => item && !item.startsWith("#") && !/connections|followers/iu.test(item));
	const pieces = [stripMarkdown(person.headline), context].filter(Boolean);
	return truncate([...new Set(pieces)].slice(0, 2).join(" / "));
}

function personSearchText(person) {
	const fit = person.projectFit ?? {};
	const raw = person.raw ?? {};
	const packet = fit.evidencePacket ?? raw.evidencePacket ?? {};
	return [
		person.displayName,
		person.headline,
		person.functionCategory,
		raw.functionCategory,
		fit.functionCategory,
		fit.evidenceStatus,
		Array.isArray(fit.roleFit) ? fit.roleFit.join(" ") : fit.roleFit,
		fit.whyNot,
		fit.nextAction,
		Array.isArray(packet.career) ? packet.career.join(" ") : "",
		Array.isArray(raw.evidence) ? raw.evidence.join(" ") : "",
	]
		.filter(Boolean)
		.join(" ");
}

function sourceRoleText(person) {
	const fit = person.projectFit ?? {};
	const raw = person.raw ?? {};
	const packet = fit.evidencePacket ?? raw.evidencePacket ?? {};
	return [
		person.headline,
		Array.isArray(packet.career) ? packet.career.join(" ") : "",
		Array.isArray(raw.evidence) ? raw.evidence.join(" ") : "",
	]
		.filter(Boolean)
		.join(" ");
}

const productGtmPatterns = [
	/AI产品\/平台|产品经理|产品负责人|产品总监|平台产品|产品运营|product\s+(manager|lead|leader|owner|marketing|growth)|head\s+of\s+product|pm\b|roadmap|portfolio/iu,
	/gtm|go-to-market|增长|growth|商业化|commercial|monetization|marketing|市场/iu,
	/devrel|developer relations|开发者关系|开发者生态|开发者社区|developer community/iu,
	/partnership|partner|生态合作|合作伙伴|渠道|出海|community|社区运营/iu,
	/founder|co-founder|创始人|联合创始人|业务负责人|商业负责人|生态负责人/iu,
];

const engineeringOnlyPatterns = [
	/agent\/llm工程|工程候选人|技术专家|llm engineer|full stack|software engineer|engineer|engineering|developer|backend|infra|runtime|sdk|mcp|repo|github|commit|pr|代码|模型|算法|研究工程/iu,
];

function hasProductGtmEvidence(person) {
	const text = sourceRoleText(person);
	return productGtmPatterns.some((pattern) => pattern.test(text));
}

function hasEngineeringPrimary(person) {
	const text = personSearchText(person);
	return engineeringOnlyPatterns.some((pattern) => pattern.test(text));
}

function requiresChinaChineseSignal(query, checkpoint) {
	const text = `${query} ${checkpoint}`;
	if (/中国\/中文生态相关人才池优先|优先中国|中文生态优先|中国市场优先/iu.test(text)) {
		return true;
	}
	if (/地域不限|全球也可以|全球范围|worldwide|global|海外也要|北美也要|中国市场和北美市场|中国市场或北美市场/iu.test(text)) {
		return false;
	}
	return true;
}

function hasChinaChineseSignal(person) {
	const text = [
		person.displayName,
		person.headline,
		person.raw?.location,
		person.raw?.company,
		person.raw?.currentCompany,
		person.projectFit?.whyFit,
		person.projectFit?.whyNot,
		Array.isArray(person.projectFit?.roleFit) ? person.projectFit.roleFit.join(" ") : person.projectFit?.roleFit,
		evidenceText(person),
		personSearchText(person),
	]
		.filter(Boolean)
		.join(" ");
	return /中国|中文|华语|中国市场|中国大陆|大陆|香港|港澳|台湾|台北|上海|北京|深圳|广州|杭州|成都|苏州|南京|Minhang|Shanghai|Beijing|Shenzhen|Guangzhou|Hangzhou|Chengdu|Suzhou|Nanjing|Hong Kong|Taiwan|Chinese market|China market|ByteDance|Tencent|Alibaba|Baidu|Kuaishou|Bilibili|字节|腾讯|阿里|百度|快手|哔哩/iu.test(
		text,
	);
}

function isProductGtmCandidate(person) {
	const functionCategory = [
		person.functionCategory,
		person.raw?.functionCategory,
		person.projectFit?.functionCategory,
	]
		.filter(Boolean)
		.join(" ");
	const sourceProductGtmEvidence = hasProductGtmEvidence(person);
	const engineeringPrimary = hasEngineeringPrimary(person);
	if (engineeringPrimary && !sourceProductGtmEvidence) return false;
	if (sourceProductGtmEvidence) return true;
	if (/GTM\/增长\/DevRel/iu.test(functionCategory)) return true;
	if (/AI产品\/平台/iu.test(functionCategory) && !engineeringPrimary) return true;
	return false;
}

function demotionReason(person, requiresDefaultGeo) {
	if (requiresDefaultGeo && !hasChinaChineseSignal(person)) {
		return "缺公开中国/中文生态相关职业信号，默认人才池下先作为待核验/全球备选";
	}
	if (hasProductGtmEvidence(person)) return "还缺第二来源证据，先作为待核验线索";
	return "当前公开证据更像工程/技术专家，缺 Product/GTM/DevRel 职责证据";
}

function markdownLink(label, url) {
	const href = mdEscape(url);
	return href ? `[${label}](${href})` : "-";
}

function confidenceLabel(priority) {
	const value = String(priority ?? "").toUpperCase();
	if (value === "A") return "高";
	if (value === "B") return "中";
	return "低";
}

function whyWorthText(person, roleFit) {
	const fitText = mdEscape(roleFit);
	const evidence = stripMarkdown(person.headline) || evidenceText(person);
	if (!fitText) return evidence || "与 Product/GTM 画像有公开职业资料匹配";
	if (/候选人$|^GTM\/增长负责人$|^AI 产品\/平台候选人$/iu.test(fitText)) {
		return evidence || fitText;
	}
	return fitText;
}

function contactPath(person) {
	if (person.profileUrl) return "公开职业资料";
	return "暂无公开职业渠道";
}

function mobilitySignal(person) {
	const text = personSearchText(person);
	if (/founder|co-founder|创始人|联合创始人|ceo|首席执行官|自营|owner/iu.test(text)) {
		return "自营创业或负责人，默认先按顾问/引荐/标杆确认";
	}
	if (/director|head|负责人|总监|商务|bd|marketing|growth|gtm|commercial|商业化|增长|市场/iu.test(text)) {
		return "在职业务负责人，需先确认当前方向和是否开放外部机会";
	}
	if (/在读|student|university|college|本科|硕士|博士|phd|master/iu.test(text)) {
		return "在读或早期阶段，触达前确认毕业时间和全职可能性";
	}
	return "公开可动性未知，触达前只问开放性问题";
}

function cleanOutputText(value) {
	return mdEscape(value)
		.replace(/候选人分桶/g, "推荐人选")
		.replace(/覆盖风险/g, "还要确认")
		.replace(/执行边界/g, "公开资料边界")
		.replace(/停止条件|停止原因/g, "本轮限制")
		.replace(/target-count/g, "展示上限")
		.replace(/sourceMap/giu, "其他线索")
		.replace(/helper|script/giu, "本轮结果");
}

function toSourceLead(lead) {
	return {
		sourceType: cleanOutputText(lead.sourceType ?? lead.type ?? "source"),
		sourceName: cleanOutputText(lead.sourceName ?? lead.name ?? lead.title ?? "LinkedIn"),
		direction: cleanOutputText(lead.direction ?? "从公开职业资料发现候选人"),
		whyRelevant: cleanOutputText(lead.whyRelevant ?? lead.reason ?? "匹配 Product/GTM 能力画像"),
		nextAction: cleanOutputText(
			lead.nextVerification ?? lead.nextAction ?? "打开公开职业资料并核验角色证据",
		),
	};
}

function outputBlocked(reason, nextAction) {
	if (args.json) {
		process.stdout.write(
			`${JSON.stringify(
				{
					status: "blocked",
					executedSources: ["linkedin"],
					providerFailed: true,
					recommendedCount: 0,
					people: [],
					otherLeads: [],
					warnings: [reason],
					nextAction,
				},
				null,
				2,
			)}\n`,
		);
		return;
	}
	process.stdout.write(
		`${JSON.stringify(
			{
				status: "blocked",
				executedSources: ["linkedin"],
				providerFailed: true,
				recommendedCount: 0,
				people: [],
				otherLeads: [],
				warnings: [reason],
				nextAction,
			},
			null,
			2,
		)}\n`,
	);
}

const args = parseArgs(process.argv.slice(2));
const rawQuery =
	args.query ||
	"AI product GTM growth commercialization DevRel product leader enterprise AI application";
const geoBias =
	"默认地域/市场：中国/中文生态相关人才池优先（不做族裔推断；缺公开相关职业信号不进推荐人选）。";
const query = rawQuery;
const checkpoint = args.checkpoint
	? `${args.checkpoint}；${geoBias}`
	: `${rawQuery}；${geoBias}`;

try {
	if (!args.skipStatus) {
		const status = runJson(["status"], 20_000);
		if (!status.authenticated || !status.api_reachable) {
			outputBlocked(
				"LinkedIn 连接器未认证或 API 不可达。",
				"配置 Sifta 连接器认证后重试，或让用户批准改走计划输出。",
			);
			process.exit(0);
		}
	}

	const result = runJson(
		[
			"find-people",
			"--query",
			query,
			"--checkpoint",
			checkpoint,
			"--sources",
			'["linkedin"]',
			"--target-count",
			String(args.targetCount),
		],
		70_000,
	);

	const rawPeople = Array.isArray(result.people) ? result.people : [];
	const requiresDefaultGeo = requiresChinaChineseSignal(rawQuery, checkpoint);
	const people = rawPeople
		.filter((person) => isProductGtmCandidate(person))
		.filter((person) => !requiresDefaultGeo || hasChinaChineseSignal(person))
		.slice(0, args.targetCount);
	const demotedPeople = rawPeople
		.filter(
			(person) =>
				!people.includes(person) &&
				(!isProductGtmCandidate(person) || (requiresDefaultGeo && !hasChinaChineseSignal(person))),
		)
		.slice(0, 5);
	const warnings = Array.isArray(result.warnings) ? result.warnings : [];
	const sourceMap = Array.isArray(result.sourceMap) ? result.sourceMap : [];

	if (args.json) {
		const toPerson = (person) => {
			const fit = person.projectFit ?? {};
			const priority = fit.priority ?? "B";
			const evidence = evidenceText(person) || person.headline || "LinkedIn / 职业资料";
			const weakness = fit.whyNot ?? fit.evidenceStatus ?? "需要跨来源审查";
			return {
				source: "linkedin",
				displayName: person.displayName,
				profileUrl: person.profileUrl,
				headline: person.headline ?? "",
				recruitingJudgment:
					priority === "A"
						? "可优先聊，先确认当前职责和推进意愿"
						: "建议先核实，确认是否适合全职、顾问或推荐人推进",
				whyWorthTalking: whyWorthText(person, Array.isArray(fit.roleFit) ? fit.roleFit.join(", ") : (fit.roleFit ?? "")),
				evidence,
				missingEvidence: weakness,
				nextAction: fit.nextAction ?? "核验公开职业资料、公司角色和第二来源证据",
				reachability: contactPath(person),
				mobilitySignal: mobilitySignal(person),
				confidence: confidenceLabel(priority),
			};
		};
		process.stdout.write(
			`${JSON.stringify(
				{
					query: rawQuery,
					executedSources: ["linkedin"],
					coverage: people.length > 0 ? "pilot" : warnings.length ? "provider_failure" : "partial",
					recommendedCount: people.length,
					people: people.map(toPerson),
					otherLeads: demotedPeople.map((person) => ({
						displayName: person.displayName || person.headline || "连接器返回资料",
						profileUrl: person.profileUrl,
						headline: person.headline ?? "",
						reasonNotRecommended: demotionReason(person, requiresDefaultGeo),
						nextAction:
							"先核公开职业资料里的产品、增长、商业化、DevRel、开发者生态或中国/中文生态相关信号；补到证据后再升级",
					})),
						sourceLeads: sourceMap.slice(0, 10).map(toSourceLead),
					warnings,
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
					executedSources: ["linkedin"],
					recommendedCount: people.length,
					people: people.map((person) => ({
						displayName: person.displayName,
						profileUrl: person.profileUrl,
						headline: person.headline ?? "",
						evidence: evidenceText(person) || person.headline || "LinkedIn / 职业资料",
					})),
					otherLeads: demotedPeople.map((person) => ({
						displayName: person.displayName || person.headline || "连接器返回资料",
						profileUrl: person.profileUrl,
						reasonNotRecommended: demotionReason(person, requiresDefaultGeo),
					})),
					sourceLeads: sourceMap.slice(0, 10).map(toSourceLead),
					warnings,
					nextAction:
						people.length > 0
							? "核公开职业资料、公司角色和第二来源证据后再触达。"
							: "收窄画像或扩大同来源召回，不换源凑数。",
				},
				null,
				2,
			)}\n`,
		);
} catch (error) {
	outputBlocked(
		`Product/GTM 小批量召回失败：${String(error.message ?? error)}`,
		"先输出计划，或检查连接器认证后重试；不要编造候选人。",
	);
}
