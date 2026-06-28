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

function truncate(value, maxLength = 220) {
	const text = mdEscape(value);
	return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function evidenceText(person) {
	const packet = person.projectFit?.evidencePacket ?? person.raw?.evidencePacket ?? {};
	const career = Array.isArray(packet.career) ? packet.career : [];
	const rawEvidence = Array.isArray(person.raw?.evidence) ? person.raw.evidence : [];
	return truncate([...career, ...rawEvidence].filter(Boolean).slice(0, 2).join(" / "));
}

function confidenceLabel(priority) {
	const value = String(priority ?? "").toUpperCase();
	if (value === "A") return "高";
	if (value === "B") return "中";
	return "低";
}

function outputBlocked(reason, nextAction) {
	process.stdout.write(
		[
			"# Product/GTM 小批量寻访",
			"",
			"本轮目标",
			"",
			"- 本轮没有形成可交付候选人。",
			"",
			"找人来源",
			"",
			"| 来源 | 看什么 | 本轮怎么用 |",
			"| --- | --- | --- |",
			"| LinkedIn / 职业资料 | Product、GTM、DevRel、增长和商业化经历 | 连接器未认证或 API 不可达，本轮未执行实时召回 |",
			"",
			"推荐名单",
			"",
			"| 推荐级别 | 人选 | 招聘判断 | 为什么值得聊 | 把握 | 还要确认 | 链接 |",
			"| --- | --- | --- | --- | --- | --- | --- |",
			"| 暂无推荐 | - | - | 本轮连接器未形成候选人 | 低 | 需要先恢复连接器或改走计划输出 | - |",
			"",
			"待确认线索",
			"",
			"| 线索 | 为什么相关 | 还差什么 | 下一步怎么确认 |",
			"| --- | --- | --- | --- |",
			"| LinkedIn 连接器 | Product/GTM 方向需要公开职业资料 | 连接器不可用 | 检查认证或让用户批准只输出找人来源 |",
			"",
			"匹配依据",
			"",
			"| 人选 / 线索 | 为什么符合需求 | 公开证据 | 把握 | 还要确认 | 下一步 |",
			"| --- | --- | --- | --- | --- | --- |",
			"| LinkedIn 连接器 | Product/GTM 候选需要职业资料证据 | 本轮未形成公开候选证据 | 低 | 连接器认证或 API 可用性 | 恢复后重试，或只给寻访计划 |",
			"",
			"本轮覆盖缺口",
			"",
			`- ${reason}`,
			"",
			"为什么先停在这里",
			"",
			"- 连接器不可用时不能用网页、Exa、浏览器或手写 LinkedIn 查询替换候选人。",
			"",
			"本轮边界",
			"",
			"- 本轮不查询私人联系方式，不自动发送消息，不编造候选人；恢复连接器或用户改授权后再继续。",
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
	"默认地域/市场：中国/中文生态相关人才池优先（不做族裔推断；缺公开相关职业信号不进推荐名单）。";
const query = `${rawQuery}；${geoBias}；候选人摘要、证据、风险和下一步必须使用中文输出。`;
const checkpoint = args.checkpoint ? `${args.checkpoint}；${geoBias}` : query;

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

	const people = Array.isArray(result.people) ? result.people.slice(0, args.targetCount) : [];
	const warnings = Array.isArray(result.warnings) ? result.warnings : [];
	const sourceMap = Array.isArray(result.sourceMap) ? result.sourceMap : [];

	const lines = [
		"# Product/GTM 小批量寻访",
		"",
		"本轮目标",
		"",
		people.length > 0
			? `- 本轮形成 ${people.length} 个 Product/GTM 建议先核实的人选。`
			: "- 本轮没有形成可交付候选人。",
		`- 能力画像：${mdEscape(query)}`,
		`- 默认地域/市场：${geoBias}`,
		"",
		"找人来源",
		"",
		"| 来源 | 看什么 | 本轮怎么用 |",
		"| --- | --- | --- |",
		"| LinkedIn / 职业资料 | Product、GTM、DevRel、增长、商业化和开发者社区经历 | 主召回来源；缺少公开职业信号时不进推荐名单 |",
		"",
		"推荐名单",
		"",
		"| 推荐级别 | 人选 | 招聘判断 | 为什么值得聊 | 把握 | 还要确认 | 链接 |",
		"| --- | --- | --- | --- | --- | --- | --- |",
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
		lines.push(
			`| 建议先核实 | ${mdEscape(person.displayName)} | ${recruitingJudgment} | ${truncate(roleFit || evidenceText(person) || person.headline || "与 Product/GTM 画像有公开职业资料匹配", 140)} | ${confidenceLabel(priority)} | ${truncate(weakness, 140)} | [资料](${mdEscape(person.profileUrl)}) |`,
		);
	}

	if (people.length === 0) {
		lines.push(
			"| 暂无推荐 | - | - | 本轮连接器在单次预算内没有返回可用候选人 | 低 | 召回失败；需要调整画像或授权下一轮 | - |",
		);
	}

	lines.push(
		"",
		"待确认线索",
		"",
		"| 线索 | 为什么相关 | 还差什么 | 下一步怎么确认 |",
		"| --- | --- | --- | --- |",
	);

	if (sourceMap.length) {
		for (const lead of sourceMap.slice(0, 5)) {
			lines.push(
				`| ${mdEscape(lead.lead ?? lead.name ?? lead.title ?? "待确认线索")} | ${mdEscape(lead.whyRelevant ?? lead.reason ?? "匹配 Product/GTM 能力画像")} | ${mdEscape(lead.conversionBlocker ?? "需要职业资料和证据审查")} | 用户后续批准后：${mdEscape(lead.nextVerification ?? "打开公开职业资料并核验角色证据")} |`,
			);
		}
	} else {
		lines.push(
			"| LinkedIn 单次连接器 | Product/GTM 候选人需要公开职业资料证据 | 缺第二来源证据 | 核验个人资料、公司角色和公开产品/GTM 负责人证据 |",
		);
	}

	lines.push(
		"",
		"匹配依据",
		"",
		"| 人选 / 线索 | 为什么符合需求 | 公开证据 | 把握 | 还要确认 | 下一步 |",
		"| --- | --- | --- | --- | --- | --- |",
	);

	for (const person of people) {
		const fit = person.projectFit ?? {};
		lines.push(
			`| ${mdEscape(person.displayName)} | AI 或前沿科技业务的 Product/GTM 负责人证据 | ${evidenceText(person) || truncate(person.headline, 160)} | ${confidenceLabel(fit.priority ?? "B")} | ${truncate(fit.whyNot ?? fit.evidenceStatus ?? "需要业务相关性审查", 160)} | 用户后续批准后：${truncate(fit.nextAction ?? "人工复核公开职业证据", 120)} |`,
		);
	}

	lines.push("", "本轮覆盖缺口", "");
	if (warnings.length) {
		for (const warning of warnings) lines.push(`- ${mdEscape(warning)}`);
	}
	lines.push(
		"- 不推断可用性、薪资、签证、搬迁、私人联系方式或沟通意愿。",
		"- 默认地域/市场对找人来源是排序和核验偏置，对推荐名单是升级门槛；缺公开中国/中文生态相关职业信号的线索必须进入本轮覆盖缺口，不要包装成已满足。",
		"- 本轮是单次小批量召回；弱证据或单来源人选仍需要先核实。",
		"- 结构化匹配依据不等于已经确认业务负责人认可。",
		"",
		"为什么先停在这里",
		"",
		people.length > 0
			? "- 小批量报告到这里停止；进入触达前必须先核验公开职业资料、公司角色和第二来源证据。"
			: "- 本轮没有形成可交付候选人；不要换源凑数或编造候选人。",
		"",
		"本轮边界",
		"",
		"- 本轮只使用授权连接器返回的公开职业资料，不查询私人联系方式，不自动发送消息，不把商务合作对象包装成推荐人选。",
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
