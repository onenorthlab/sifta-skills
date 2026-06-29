// 确定性单测：召回方向词驱动 + 两轴可解释重排硬约束。
// 不依赖 GitHub（live 结果高度非确定），这是"可证明不靠手感"的核心保证。
// 运行：node --test scripts/recall-lib.test.mjs

import assert from "node:assert/strict";
import { test } from "node:test";

import {
	coreQueryTerms,
	DEFAULT_CONFIG,
	mergeLegResults,
	queryConceptPairs,
	scoreCandidateTwoAxis,
} from "./recall-lib.mjs";

const RESEARCH_QUERY =
	"VLA vision-language-action world model embodied robotics foundation model researcher";
const ENG_QUERY = "AI Agent MCP runtime LLM infra engineer open source";

test("coreQueryTerms 用画像真实方向词驱动，不被 agent 白名单绑架", () => {
	const terms = coreQueryTerms(RESEARCH_QUERY);
	// research 的真实方向词必须出现（旧代码会因不在 engineering 白名单而全丢）
	for (const want of ["vla", "world", "model", "embodied", "robotics"]) {
		assert.ok(
			terms.includes(want),
			`core terms 应包含方向词 "${want}"，实际：${terms.join(",")}`,
		);
	}
	// 停用词/填充词必须被剔除
	for (const stop of ["open", "source", "the", "with"]) {
		assert.ok(!terms.includes(stop), `core terms 不应包含停用词 "${stop}"`);
	}
});

test("queryConceptPairs 覆盖 query 多个概念，而不是只 AND 前两个词", () => {
	const pairs = queryConceptPairs(RESEARCH_QUERY);
	assert.ok(pairs.length >= 2, `应产出多个概念词对覆盖不同方向，实际：${JSON.stringify(pairs)}`);
	// 必须有一个词对落在 embodied/world/robotics 这些 agent 白名单覆盖不到的方向
	const joined = pairs.join(" | ").toLowerCase();
	assert.ok(
		/world|embodied|robotics|model/.test(joined),
		`概念词对应覆盖 research 方向，实际：${joined}`,
	);
	// 不能退化成写死的 "agent runtime"
	assert.notDeepEqual(pairs, ["agent runtime"]);
});

test("空 query 安全回退到默认 agent 方向，不抛错", () => {
	const pairs = queryConceptPairs("");
	assert.ok(pairs.length >= 1);
	assert.equal(pairs[0], "agent runtime");
});

test("两轴硬约束：China-only 弱证据不得反超非中国强证据", () => {
	const coreTerms = coreQueryTerms(ENG_QUERY);
	const strongNonChina = scoreCandidateTwoAxis(
		{
			contributions: 120,
			prCount: 2,
			personalRepoEvidence: ["a/agent-runtime；stars=900", "b/mcp-server"],
			bio: "building agent runtime and mcp tooling",
			company: "",
			location: "Berlin, Germany",
			profileGeoEvidence: { matched: false },
			ecosystemGeoEvidence: { matched: false },
			repos: [{ fullName: "a/agent-runtime", description: "mcp agent runtime" }],
		},
		coreTerms,
	);
	const weakChina = scoreCandidateTwoAxis(
		{
			contributions: 0,
			prCount: 0,
			personalRepoEvidence: [],
			bio: "学生，喜欢 AI",
			company: "",
			location: "Beijing, China",
			profileGeoEvidence: { matched: true, evidence: "location: Beijing, China" },
			ecosystemGeoEvidence: { matched: false },
			repos: [],
		},
		coreTerms,
	);

	assert.equal(strongNonChina.evidenceTier, "strong");
	assert.equal(weakChina.evidenceTier, "weak");
	// 核心断言：跨证据档，China-only 弱证据排名分必须低于非中国强证据
	assert.ok(
		strongNonChina.score > weakChina.score,
		`强证据(${strongNonChina.score}) 必须 > 弱证据中国(${weakChina.score})`,
	);
	assert.ok(strongNonChina.evidenceRank > weakChina.evidenceRank);

	// 排序后强证据必须在前
	const ranked = [weakChina, strongNonChina].sort((a, b) => b.score - a.score);
	assert.equal(ranked[0], strongNonChina, "排序后非中国强证据应排在 China-only 弱证据之前");
});

test("次轴加分不能把弱证据顶进更高档（不靠地域升 tier 抬 MRR）", () => {
	const coreTerms = coreQueryTerms(ENG_QUERY);
	// 满地域 + 满 profile 字段的弱证据：次轴拉满，仍必须是 weak
	const weakButMaxSecondary = scoreCandidateTwoAxis(
		{
			contributions: 0,
			prCount: 0,
			personalRepoEvidence: [],
			bio: "x",
			company: "y",
			location: "Shanghai, China",
			profileGeoEvidence: { matched: true },
			ecosystemGeoEvidence: { matched: false },
			repos: [],
		},
		coreTerms,
	);
	assert.equal(weakButMaxSecondary.evidenceTier, "weak");
	// 即使次轴拉满，分数也必须低于任意 adjacent 档下限（rank2 * rankMultiplier）
	const adjacentFloor = 2 * (DEFAULT_CONFIG.scoring.rankMultiplier ?? 100);
	assert.ok(
		weakButMaxSecondary.score < adjacentFloor,
		`弱档(${weakButMaxSecondary.score}) 不得靠次轴够到 adjacent 档下限(${adjacentFloor})`,
	);
});

test("放宽 W3(Owner 决策)：地域+方向匹配的低贡献者，压过非地域的高贡献无方向者", () => {
	const coreTerms = coreQueryTerms(ENG_QUERY);
	// 地域(中国) + 方向命中(bio/repo 含 agent/runtime/mcp) + 个人实现 repo，但 contributions=0
	const geoDirectionLowVolume = scoreCandidateTwoAxis(
		{
			contributions: 0,
			prCount: 0,
			personalRepoEvidence: ["me/agent-runtime"],
			bio: "agent runtime mcp infra builder",
			location: "Shenzhen, China",
			profileGeoEvidence: {
				matched: true,
				strong: true,
				evidence: "location: Shenzhen, China",
			},
			ecosystemGeoEvidence: { matched: false },
			repos: [{ fullName: "me/agent-runtime", description: "mcp agent runtime" }],
		},
		coreTerms,
	);
	// 同档对照：非地域 + 高贡献 + 同样方向命中（全球主力，如 vLLM 核心）——证据档也是 strong
	const nonGeoHighVolumeSameDirection = scoreCandidateTwoAxis(
		{
			contributions: 300,
			prCount: 3,
			personalRepoEvidence: ["x/agent-runtime", "x/mcp-core"],
			bio: "agent runtime mcp infra maintainer",
			location: "Berlin, Germany",
			profileGeoEvidence: { matched: false },
			ecosystemGeoEvidence: { matched: false },
			repos: [{ fullName: "x/agent-runtime", description: "mcp agent runtime" }],
		},
		coreTerms,
	);
	// 两人都到 strong 档；Owner 选的策略：同档内，方向+地域契合 > 纯贡献量
	assert.equal(geoDirectionLowVolume.evidenceTier, "strong");
	assert.equal(nonGeoHighVolumeSameDirection.evidenceTier, "strong");
	assert.ok(
		geoDirectionLowVolume.score > nonGeoHighVolumeSameDirection.score,
		`同档内 方向+地域契合(${geoDirectionLowVolume.score}) 应压过纯高贡献(${nonGeoHighVolumeSameDirection.score})`,
	);
	assert.ok(geoDirectionLowVolume.signals.includes("geo-direction-fit"));
});

test("放宽 W3 不破红线：纯地域、无方向命中，仍是 weak、不冒充候选", () => {
	const coreTerms = coreQueryTerms(ENG_QUERY);
	// 满地域 + 满 profile 字段，但 bio/repo 完全无方向命中
	const geoOnlyNoDirection = scoreCandidateTwoAxis(
		{
			contributions: 0,
			prCount: 0,
			personalRepoEvidence: [],
			bio: "学生，喜欢 AI",
			company: "某公司",
			location: "Beijing, China",
			profileGeoEvidence: { matched: true, strong: true },
			ecosystemGeoEvidence: { matched: false },
			repos: [],
		},
		coreTerms,
	);
	// 即使是"真在中国"(strong geo)，没有方向命中 → 仍 weak、无 fit、不冒充候选
	assert.equal(geoOnlyNoDirection.evidenceTier, "weak");
	assert.ok(!geoOnlyNoDirection.signals.includes("geo-direction-fit"));
});

test("source catalog 只在同证据档内提权，不把 weak 线索抬成候选", () => {
	const coreTerms = coreQueryTerms(ENG_QUERY);
	const catalogStrong = scoreCandidateTwoAxis(
		{
			contributions: 60,
			prCount: 0,
			personalRepoEvidence: [],
			bio: "mcp runtime maintainer",
			location: "Berlin",
			profileGeoEvidence: { matched: false },
			ecosystemGeoEvidence: { matched: false },
			legTypes: ["source-catalog"],
			repos: [{ fullName: "x/mcp-runtime", description: "mcp runtime" }],
		},
		coreTerms,
	);
	const broadStrong = scoreCandidateTwoAxis(
		{
			contributions: 60,
			prCount: 0,
			personalRepoEvidence: [],
			bio: "mcp runtime maintainer",
			location: "Berlin",
			profileGeoEvidence: { matched: false },
			ecosystemGeoEvidence: { matched: false },
			legTypes: ["repo-contributor"],
			repos: [{ fullName: "x/mcp-runtime", description: "mcp runtime" }],
		},
		coreTerms,
	);
	const catalogWeak = scoreCandidateTwoAxis(
		{
			contributions: 0,
			prCount: 0,
			personalRepoEvidence: [],
			bio: "unrelated",
			location: "",
			profileGeoEvidence: { matched: false },
			ecosystemGeoEvidence: { matched: false },
			legTypes: ["source-catalog"],
			repos: [],
		},
		coreTerms,
	);

	assert.equal(catalogStrong.evidenceTier, "strong");
	assert.equal(broadStrong.evidenceTier, "strong");
	assert.ok(catalogStrong.score > broadStrong.score);
	assert.ok(catalogStrong.signals.includes("source-catalog"));
	assert.equal(catalogWeak.evidenceTier, "weak");
	assert.ok(!catalogWeak.signals.includes("source-catalog"));
});

test("signals 可解释：命中信号可被 Owner 复核", () => {
	const coreTerms = coreQueryTerms(ENG_QUERY);
	const scored = scoreCandidateTwoAxis(
		{
			contributions: 60,
			prCount: 1,
			personalRepoEvidence: ["a/agent"],
			bio: "agent dev",
			location: "Hangzhou, China",
			profileGeoEvidence: { matched: true, strong: true },
			ecosystemGeoEvidence: { matched: false },
			repos: [{ fullName: "a/agent", description: "agent runtime" }],
		},
		coreTerms,
	);
	assert.ok(scored.signals.includes("contrib:50+"));
	assert.ok(scored.signals.includes("china-location"));
	assert.ok(scored.signals.some((s) => s.startsWith("evidence:")));
	assert.ok(scored.signals.some((s) => s.startsWith("core-term-match:")));
});

test("多腿合并：按 login 去重、raw pool 比单腿大、记录命中腿", () => {
	const peopleLeg = {
		legType: "people",
		items: [{ login: "alice" }, { login: "bob" }],
	};
	const repoLeg = {
		legType: "repo-contributor",
		items: [{ login: "Bob" }, { login: "carol" }], // Bob 与 bob 同人（大小写）
	};
	const profileLeg = {
		legType: "profile",
		items: [{ login: "dave" }, { login: "alice" }],
	};

	const single = mergeLegResults([peopleLeg]);
	const merged = mergeLegResults([peopleLeg, repoLeg, profileLeg]);

	// raw pool 随腿数增大
	assert.ok(
		merged.length > single.length,
		`三腿(${merged.length}) 应比单腿(${single.length}) 大`,
	);
	// 按 login 去重（含大小写）：alice/bob/carol/dave = 4
	const logins = merged.map((m) => m.login.toLowerCase()).sort();
	assert.deepEqual([...new Set(logins)], logins, "不应有重复 login");
	assert.equal(merged.length, 4);
	// 跨腿命中的人记录多个 legType
	const bob = merged.find((m) => m.login.toLowerCase() === "bob");
	assert.deepEqual(bob.legTypes.sort(), ["people", "repo-contributor"]);
});

test("config 注入生效：改阈值即改行为（Owner 调 config 不动代码）", () => {
	const candidate = {
		contributions: 5,
		prCount: 0,
		personalRepoEvidence: [],
		repos: [],
		profileGeoEvidence: { matched: false },
		ecosystemGeoEvidence: { matched: false },
	};
	// 默认 contribLowAt=3 → 5 命中 → evidence=1 → weak
	assert.equal(scoreCandidateTwoAxis(candidate, [], DEFAULT_CONFIG).evidenceTier, "weak");
	// 覆盖 config：把 adjacent 阈值降到 1 → 同一候选升 adjacent
	const tuned = {
		...DEFAULT_CONFIG,
		scoring: { ...DEFAULT_CONFIG.scoring, adjacentTierAt: 1 },
	};
	assert.equal(scoreCandidateTwoAxis(candidate, [], tuned).evidenceTier, "adjacent");
});
