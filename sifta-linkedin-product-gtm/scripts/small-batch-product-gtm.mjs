#!/usr/bin/env node

import { execFileSync } from "node:child_process";

function parseArgs(argv) {
	const args = {
		query: "",
		checkpoint: "",
		targetCount: 3,
		skipStatus: false,
	};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		const next = argv[index + 1];
		if (arg === "--query" && next) args.query = next;
		if (arg === "--checkpoint" && next) args.checkpoint = next;
		if (arg === "--target-count" && next) args.targetCount = Number(next);
		if (arg === "--skip-status") args.skipStatus = true;
		if (arg.startsWith("--") && arg !== "--skip-status") index += 1;
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

function outputBlocked(reason, nextAction) {
	process.stdout.write(
		[
			"# Product/GTM 小批量寻访",
			"",
			"结论",
			"",
			"- 本轮没有形成可交付候选人；GTM/LinkedIn 主路径不可用时只输出标杆、线索和阻塞项。",
			"",
			"人选和证据",
			"",
			"| 分桶 | 人选 / 线索 | 招聘判断 | 为什么值得聊 | 把握 | 证据来源 | 下一步 | 链接 |",
			"| --- | --- | --- | --- | --- | --- | --- | --- |",
			"| 暂无推荐 | LinkedIn / 职业资料 | 不产全职候选 | 本轮连接器未形成候选人 | 低 | 连接器未认证或 API 不可达，本轮未执行实时召回 | 恢复连接器后重试 | - |",
			"",
			"风险和待核验",
			"",
			"| 类型 | 内容 | 为什么重要 | 怎么确认 |",
			"| --- | --- | --- | --- |",
			"| 待核验线索 | LinkedIn 连接器 | Product/GTM 方向需要公开职业资料 | 检查认证；未恢复前只做标杆/来源线索，不包装全职候选 |",
			`| 覆盖风险 | ${reason} | 连接器不可用时不能用网页、Exa、浏览器或手写 LinkedIn 查询替换候选人 | 恢复连接器后重试，或只给寻访计划 |`,
			"| 停止原因 | 主路径不可用，本轮停止 | 不能把 fallback 摘要包装成全职、strong 或 soft 候选 | 用户改授权后再继续 |",
			"| 执行边界 | 不查询私人联系方式，不自动发送消息，不提交表单，不编造候选人 | 防止越界和误导 | 恢复连接器或用户改授权后再继续 |",
			"",
			"下一步",
			"",
			`- ${nextAction}`,
			"",
		].join("\n"),
	);
}

const args = parseArgs(process.argv.slice(2));
const rawQuery =
	args.query ||
	"AI product GTM growth commercialization DevRel product leader enterprise AI application";
const geoBias =
	"默认地域/市场：中国/中文生态相关人才池优先（不做族裔推断；缺公开相关职业信号不进候选人分桶）。";
const query = `${rawQuery}；${geoBias}；候选人摘要、证据、风险和下一步必须使用中文输出。`;
const checkpoint = args.checkpoint ? `${args.checkpoint}；${geoBias}` : `${rawQuery}；${geoBias}`;

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

	const lines = [
		"# Product/GTM 小批量寻访",
		"",
		"结论",
		"",
		people.length > 0
			? `- 本轮形成 ${people.length} 个 Product/GTM 建议先核实的人选。`
			: "- 本轮没有形成可交付候选人。",
		demotedPeople.length > 0
			? `- 另有 ${demotedPeople.length} 条返回结果因缺 Product/GTM/DevRel 职责证据，已降为待核验线索。`
			: "",
		`- 能力画像：${mdEscape(rawQuery)}`,
		`- ${geoBias}`,
		"",
		"人选和证据",
		"",
		"| 分桶 | 人选 / 线索 | 招聘判断 | 为什么值得聊 | 把握 | 证据来源 | 下一步 | 链接 |",
		"| --- | --- | --- | --- | --- | --- | --- | --- |",
	];

	for (const person of people) {
		const fit = person.projectFit ?? {};
		const priority = fit.priority ?? "B";
		const evidenceStatus = fit.evidenceStatus ?? "待补证据";
		const roleFit = Array.isArray(fit.roleFit) ? fit.roleFit.join(", ") : (fit.roleFit ?? "");
		const weakness = fit.whyNot ?? evidenceStatus ?? "需要跨来源审查";
		const recruitingJudgment =
			priority === "A"
				? "可优先聊，先确认当前职责和推进意愿"
				: "建议先核实，确认是否适合全职、顾问或推荐人推进";
		const whyWorth = whyWorthText(person, roleFit);
		lines.push(
			`| 建议先核实 | ${mdEscape(person.displayName)} | ${recruitingJudgment} | ${truncate(whyWorth, 140)} | ${confidenceLabel(priority)} | ${truncate(evidenceText(person) || person.headline || "LinkedIn / 职业资料", 140)} | 公开联系路径：${contactPath(person)}；结构信号：${mobilitySignal(person)}；主要风险：${truncate(weakness, 70)} | ${markdownLink("资料", person.profileUrl)} |`,
		);
	}

	if (people.length === 0) {
		lines.push(
			"| 暂无推荐 | - | - | 本轮连接器在单次预算内没有返回可用候选人 | 低 | 召回失败；需要调整画像或授权下一轮 | 收窄画像或扩大同来源召回 | - |",
		);
	}

	lines.push(
		"",
		"风险和待核验",
		"",
		"| 类型 | 内容 | 为什么重要 | 怎么确认 |",
		"| --- | --- | --- | --- |",
	);

	if (demotedPeople.length) {
		for (const person of demotedPeople) {
			lines.push(
				`| 待核验线索 | ${mdEscape(person.displayName || person.headline || "连接器返回资料")} | ${demotionReason(person, requiresDefaultGeo)} | 先核公开职业资料里的产品、增长、商业化、DevRel、开发者生态或中国/中文生态相关信号；补到证据后再升级 |`,
			);
		}
	}

	if (sourceMap.length) {
		for (const lead of sourceMap.slice(0, 5)) {
			lines.push(
				`| 来源线索 | ${mdEscape(lead.lead ?? lead.name ?? lead.title ?? "待核验线索")} | ${mdEscape(lead.whyRelevant ?? lead.reason ?? "匹配 Product/GTM 能力画像")}；缺口：${mdEscape(lead.conversionBlocker ?? "需要职业资料和证据审查")} | 用户后续批准后：${mdEscape(lead.nextVerification ?? "打开公开职业资料并核验角色证据")} |`,
			);
		}
	} else {
		lines.push(
			"| 来源线索 | LinkedIn 单次连接器 | Product/GTM 候选人需要公开职业资料证据；当前缺第二来源证据 | 核验个人资料、公司角色和公开产品/GTM 负责人证据 |",
		);
	}

	for (const person of people) {
		const fit = person.projectFit ?? {};
		lines.push(
			`| 适配证明 | ${mdEscape(person.displayName)} | AI 或前沿科技业务的 Product/GTM 负责人证据：${evidenceText(person) || truncate(person.headline, 160)}；把握：${confidenceLabel(fit.priority ?? "B")}；主要风险：${truncate(fit.whyNot ?? fit.evidenceStatus ?? "需要业务相关性审查", 120)} | 用户后续批准后：${truncate(fit.nextAction ?? "人工复核公开职业证据", 120)} |`,
		);
	}
	if (people.length === 0) {
		lines.push(
			"| 适配缺口 | Product/GTM 职能证据 | 连接器没有返回同时具备职业资料和 Product/GTM/DevRel 职责证据的人选；不能把工程/技术专家包装成 Product/GTM 候选 | 收窄 Product/GTM 画像或扩大同来源召回 |",
		);
	}

	if (warnings.length) {
		for (const warning of warnings)
			lines.push(
				`| 覆盖风险 | ${mdEscape(warning)} | 影响本轮候选覆盖和置信度 | 按 warning 修复后重试 |`,
			);
	}
	lines.push(
		"| 执行边界 | 不推断可用性、薪资、签证、搬迁、私人联系方式或沟通意愿 | 防止把公开职业资料写成私人判断 | 触达前只问开放性问题，不下结论 |",
		"| 覆盖风险 | 默认地域/市场对来源排序和候选升级生效；缺公开中国/中文生态相关职业信号不能包装成已满足 | 影响是否进入可推进候选 | 下一轮按公开职业信号补证 |",
		"| 覆盖风险 | Product/GTM/DevRel 候选必须有对应职能证据；只有工程、代码、模型或开源证据的人只能做待核验线索 | 防止工程线索误入 Product/GTM 分桶 | 补产品、增长、商业化或开发者生态职责证据 |",
		"| 覆盖风险 | 本轮是单次小批量召回；弱证据或单来源人选仍需要先核实 | 结构化适配证明不等于业务负责人认可 | 人工复核后再触达 |",
		people.length > 0
			? "| 停止原因 | 小批量报告到这里停止 | 进入触达前必须先核验公开职业资料、公司角色和第二来源证据 | 用户确认后再写触达草稿 |"
			: "| 停止原因 | 本轮没有形成可交付候选人 | 不要换源凑数或编造候选人 | 用户确认后收窄画像或扩大同来源召回 |",
		"| 执行边界 | 本轮只使用授权连接器返回的公开职业资料，不查询私人联系方式，不自动发送消息，不提交表单，不把商务合作对象包装成候选人 | 防止越界 | 用户授权后再继续 |",
		"",
		"下一步",
		"",
		people.length > 0
			? "- 用户确认后，核验公开职业资料、公司角色和第二来源证据，再决定是否写触达草稿。"
			: "- 用户确认后，收窄公司/产品方向或扩大同来源召回。",
	);

	process.stdout.write(`${lines.join("\n")}\n`);
} catch (error) {
	outputBlocked(
		`Product/GTM 小批量召回失败：${String(error.message ?? error)}`,
		"先输出计划，或检查连接器认证后重试；不要编造候选人。",
	);
}
