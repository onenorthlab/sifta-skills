// 纯函数召回/重排核心（无 I/O、无 GitHub、无副作用）。
// 机制在这里，调参在 recall-config.json（Owner 改 config 即可，不动这里）。
// 这两条质量约束——"方向词驱动召回"和"两轴可解释重排"——靠 recall-lib.test.mjs
// 确定性单测证明，不靠高度非确定的 live GitHub。

import { readFileSync } from "node:fs";

/** 默认调参：从同目录 recall-config.json 读取；测试可传入覆盖 config。 */
export const DEFAULT_CONFIG = JSON.parse(
	readFileSync(new URL("./recall-config.json", import.meta.url), "utf8"),
);

export function cleanSearchQuery(value) {
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

// 泛化核心词提取：取 query 里 ≥3 字母、非停用词的实词，去重保序。
// 这是召回的方向锚点，替代写死的 engineering 关键词白名单（停用词表见 config）。
export function coreQueryTerms(value, config = DEFAULT_CONFIG) {
	const stop = new Set(config.queryStopWords ?? []);
	return [
		...new Set(
			cleanSearchQuery(value)
				.toLowerCase()
				.split(/[^a-z0-9+#]+/u)
				.filter((term) => term.length >= 3 && !stop.has(term)),
		),
	];
}

// query 的概念词对：(0,1)(2,3)(4,5)，让多条 search 覆盖 query 的不同方向，
// 而不是只 AND 前两个词导致 research / 多概念画像漏召回。
export function queryConceptPairs(value, config = DEFAULT_CONFIG) {
	const terms = coreQueryTerms(value, config);
	const maxTerms = config.conceptPairMaxTerms ?? 6;
	const pairs = [];
	for (let i = 0; i < Math.min(terms.length, maxTerms); i += 2) {
		const pair = terms.slice(i, i + 2).join(" ");
		if (pair) pairs.push(pair);
	}
	return pairs.length ? pairs : ["agent runtime"];
}

/**
 * 多腿召回合并去重（people-first / repo-contributor-first / profile-first 三腿）。
 * 按 login（小写）去重，保留先出现的腿，并记录命中的 legType 集合。
 * small-batch-github.mjs 的 candidatesByLogin Map 用同一 by-login 去重契约；
 * 这里抽成纯函数，便于确定性断言"合并后 raw pool 比单腿大、且无重复 login"。
 * @param {Array<{legType:string, items:Array<{login:string}>}>} legs
 */
export function mergeLegResults(legs) {
	const byLogin = new Map();
	for (const leg of legs) {
		for (const item of leg.items ?? []) {
			if (!item?.login) continue;
			const key = String(item.login).toLowerCase();
			const existing = byLogin.get(key);
			if (existing) {
				if (!existing.legTypes.includes(leg.legType)) existing.legTypes.push(leg.legType);
			} else {
				byLogin.set(key, { ...item, legTypes: [leg.legType] });
			}
		}
	}
	return [...byLogin.values()];
}

/**
 * 两轴可解释重排（落 sifta-recall-quality-plan.md §4）。
 * 主轴 = 证据强度（贡献深度 / merged PR / 个人实现型 repo / 画像方向词命中）。
 * 次轴 = 地域/角色偏好（中国/中文生态公开职业信号、当前角色精确命中）。
 * 结构性硬约束：evidenceRank × rankMultiplier 主导排序，次轴封顶 secondaryCapPts，
 * 只要 rankMultiplier > 每档最大 (evidence*evidenceMultiplier + secondaryCap)，
 * China-only weak 就永远不可能反超 evidence-strong，也不靠次轴升档抬 MRR。
 * @returns {{score:number,evidenceTier:'strong'|'adjacent'|'weak',evidenceRank:number,priority:'A'|'B'|'C',signals:string[]}}
 */
export function scoreCandidateTwoAxis(candidate, coreTerms = [], config = DEFAULT_CONFIG) {
	const s = config.scoring ?? {};
	const signals = [];
	const contributions = candidate.contributions ?? 0;
	const prCount = candidate.prCount ?? 0;
	const personalImpl = candidate.personalRepoEvidence?.length ?? 0;

	// ---- 主轴：证据强度 ----
	let evidence = 0;
	if (contributions >= (s.contribStrongAt ?? 50)) {
		evidence += s.contribStrongPts ?? 3;
		signals.push("contrib:50+");
	} else if (contributions >= (s.contribMidAt ?? 10)) {
		evidence += s.contribMidPts ?? 2;
		signals.push("contrib:10+");
	} else if (contributions >= (s.contribLowAt ?? 3)) {
		evidence += s.contribLowPts ?? 1;
		signals.push("contrib:3+");
	}
	if (personalImpl >= 1) {
		evidence += Math.min(personalImpl, s.personalImplCapPts ?? 2);
		signals.push(`personal-impl-repo:${personalImpl}`);
	}
	const text = [
		candidate.bio,
		candidate.company,
		...(candidate.repos ?? []).map(
			(repo) => `${repo.fullName ?? ""} ${repo.description ?? ""}`,
		),
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
	const coreMatches = coreTerms.filter((term) => text.includes(term)).length;
	if (coreMatches >= 1) {
		evidence += s.coreTermMatchPts ?? 1;
		signals.push(`core-term-match:${coreMatches}`);
	}
	if (prCount >= 1) {
		evidence += Math.min(prCount, s.mergedPrCapPts ?? 1);
		signals.push(`merged-pr:${prCount}`);
	}

	// ---- 方向+地域契合度（Owner 决策：放宽 W3，让"地域/方向匹配"压过"纯贡献量"）----
	// 仅当"强地域信号(location/company 真写中国) ∧ 方向命中(core-term)"时才升主轴档 + 拿大次轴分。
	// 用 strong 而非 matched：否则 bio 含一个汉字的全球高贡献者(湾区 diaspora)也被判中国，
	// geo 加分人人都有、零区分度，真·在中国但贡献量一般的人反而排不上来。
	const geoStrong = !!candidate.profileGeoEvidence?.strong;
	const geoMatched =
		!!candidate.profileGeoEvidence?.matched || !!candidate.ecosystemGeoEvidence?.matched;
	if (geoStrong && coreMatches >= 1) {
		evidence += s.geoDirectionFitPts ?? 2;
		signals.push("geo-direction-fit");
	}

	const evidenceTier =
		evidence >= (s.strongTierAt ?? 4)
			? "strong"
			: evidence >= (s.adjacentTierAt ?? 2)
				? "adjacent"
				: "weak";
	const evidenceRank = evidenceTier === "strong" ? 3 : evidenceTier === "adjacent" ? 2 : 1;
	signals.push(`evidence:${evidenceTier}`);

	// ---- 次轴：地域 / 角色偏好（仅档内加分，封顶；secondaryCap < rankMultiplier 保证不跨档反超）----
	// Owner 决策(放宽 W3)：档内排序让"地域+方向契合"压过"纯贡献量"——给 geo+direction 命中者
	// 一个足够大的 secondary 分(geoDirectionSecondaryPts)，使其在同档内能盖过高贡献者的 evidence 差，
	// 从而"领域对+地域对、贡献量不及全球主力的人"也能排在前面；但封顶仍 < rankMultiplier，弱档(无方向)永不跨档。
	let secondary = 0;
	if (geoStrong) {
		secondary += s.geoProfilePts ?? 2;
		signals.push("china-location"); // location/company 真写中国
	} else if (candidate.profileGeoEvidence?.matched || candidate.ecosystemGeoEvidence?.matched) {
		secondary += s.geoEcosystemPts ?? 1;
		signals.push("china-ecosystem"); // 仅泛中文生态/汉字信号
	}
	if (geoStrong && coreMatches >= 1) secondary += s.geoDirectionSecondaryPts ?? 12;
	if ((candidate.legTypes ?? []).includes("source-catalog") && evidenceTier !== "weak") {
		secondary += s.sourceCatalogPts ?? 45;
		signals.push("source-catalog");
	}
	if (candidate.company || candidate.bio || candidate.location)
		secondary += s.hasProfileFieldPts ?? 1;
	secondary = Math.min(secondary, s.secondaryCapPts ?? 25);

	return {
		score:
			evidenceRank * (s.rankMultiplier ?? 100) +
			evidence * (s.evidenceMultiplier ?? 10) +
			secondary,
		evidenceTier,
		evidenceRank,
		priority: evidenceTier === "strong" ? "A" : evidenceTier === "adjacent" ? "B" : "C",
		signals,
	};
}
