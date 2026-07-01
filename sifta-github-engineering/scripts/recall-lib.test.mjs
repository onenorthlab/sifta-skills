// 确定性单测：召回方向词驱动 + 两轴可解释重排硬约束。
// 不依赖 GitHub（live 结果高度非确定），这是"可证明不靠手感"的核心保证。
// 运行：node --test scripts/recall-lib.test.mjs

import assert from "node:assert/strict";
import { test } from "node:test";

import {
	computeReachability,
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

test("profile-only 地域+方向命中不能靠 bio 升成候选", () => {
	const coreTerms = coreQueryTerms(ENG_QUERY);
	const profileOnly = scoreCandidateTwoAxis(
		{
			contributions: 0,
			prCount: 0,
			personalRepoEvidence: [],
			bio: "agent runtime mcp infra builder",
			company: "",
			location: "Shanghai, China",
			profileGeoEvidence: {
				matched: true,
				strong: true,
				evidence: "location: Shanghai, China",
			},
			ecosystemGeoEvidence: { matched: false },
			repos: [],
		},
		coreTerms,
	);

	assert.equal(profileOnly.evidenceTier, "weak");
	assert.equal(profileOnly.priority, "C");
	assert.ok(!profileOnly.signals.includes("geo-direction-fit"));
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

test("多路合并：按 login 去重、raw pool 比单路大、记录命中路", () => {
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

	// raw pool 随路数增大
	assert.ok(
		merged.length > single.length,
		`三路(${merged.length}) 应比单路(${single.length}) 大`,
	);
	// 按 login 去重（含大小写）：alice/bob/carol/dave = 4
	const logins = merged.map((m) => m.login.toLowerCase()).sort();
	assert.deepEqual([...new Set(logins)], logins, "不应有重复 login");
	assert.equal(merged.length, 4);
	// 跨路命中的人记录多个 legType
	const bob = merged.find((m) => m.login.toLowerCase() === "bob");
	assert.deepEqual(bob.legTypes.sort(), ["people", "repo-contributor"]);
});

// ---- 新增：方向密度 + 近期活跃度档内排序断言 ----

test("档内排序：近期活跃+方向密度高，排在不活跃+单词命中前", () => {
	const coreTerms = coreQueryTerms(ENG_QUERY);

	// 近期活跃（2 个月前）+ 方向密度高（4 个核心词命中）——证据档 adjacent
	const freshHighDensity = scoreCandidateTwoAxis(
		{
			contributions: 5,
			prCount: 0,
			personalRepoEvidence: ["me/agent-mcp"],
			bio: "agent mcp runtime infra builder",
			location: "Berlin",
			profileGeoEvidence: { matched: false },
			ecosystemGeoEvidence: { matched: false },
			repos: [{ fullName: "me/agent-mcp", description: "llm agent runtime mcp" }],
			// 2 个月前活跃
			lastActiveAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
		},
		coreTerms,
	);

	// 多年不活跃（36 个月前）+ 单词命中——同样证据档 adjacent
	const staleOneTerm = scoreCandidateTwoAxis(
		{
			contributions: 5,
			prCount: 0,
			personalRepoEvidence: ["me/agent-mcp"],
			bio: "agent dev",
			location: "Berlin",
			profileGeoEvidence: { matched: false },
			ecosystemGeoEvidence: { matched: false },
			repos: [{ fullName: "me/agent-mcp", description: "agent" }],
			// 36 个月前活跃（超过 staleMonths=18 不加分）
			lastActiveAt: new Date(Date.now() - 36 * 30 * 24 * 60 * 60 * 1000).toISOString(),
		},
		coreTerms,
	);

	// 两人都在同一档（都是 adjacent 或都是 weak——主要验证档内排序，不验证具体档位）
	assert.equal(
		freshHighDensity.evidenceTier,
		staleOneTerm.evidenceTier,
		`两人应在同一证据档，实际：fresh=${freshHighDensity.evidenceTier} stale=${staleOneTerm.evidenceTier}`,
	);
	// 核心断言：近期活跃+密度高应得分更高（档内领先）
	assert.ok(
		freshHighDensity.score > staleOneTerm.score,
		`近期活跃+高密度(${freshHighDensity.score}) 应 > 不活跃+单词(${staleOneTerm.score})`,
	);
	// 信号可解释
	assert.ok(
		freshHighDensity.signals.some((s) => s.startsWith("recent-active:fresh")),
		`应有 recent-active:fresh 信号，实际：${freshHighDensity.signals.join(",")}`,
	);
	assert.ok(
		freshHighDensity.signals.some((s) => s.startsWith("core-density-bonus")),
		`应有 core-density-bonus 信号，实际：${freshHighDensity.signals.join(",")}`,
	);
});

test("近期活跃度：字段缺失时安全降级为 0，不影响现有候选", () => {
	const coreTerms = coreQueryTerms(ENG_QUERY);
	// lastActiveAt 字段完全不传——不应报错，得分与旧行为一致（无活跃加分）
	const noLastActiveAt = scoreCandidateTwoAxis(
		{
			contributions: 10,
			prCount: 0,
			personalRepoEvidence: ["me/agent"],
			bio: "agent runtime",
			location: "",
			profileGeoEvidence: { matched: false },
			ecosystemGeoEvidence: { matched: false },
			repos: [{ fullName: "me/agent", description: "agent runtime" }],
			// 不传 lastActiveAt
		},
		coreTerms,
	);
	// 不应抛错、且无 recent-active 信号
	assert.ok(!noLastActiveAt.signals.some((s) => s.startsWith("recent-active:")));
	assert.ok(typeof noLastActiveAt.score === "number");
});

test("方向密度：命中 1 个词 vs 5 个词，高密度档内得分更高", () => {
	const coreTerms = coreQueryTerms(ENG_QUERY);

	// 命中 1 个核心词（旧行为上限）
	const oneTermMatch = scoreCandidateTwoAxis(
		{
			contributions: 10,
			prCount: 0,
			personalRepoEvidence: ["me/agent"],
			bio: "agent dev",
			location: "",
			profileGeoEvidence: { matched: false },
			ecosystemGeoEvidence: { matched: false },
			repos: [{ fullName: "me/agent", description: "agent" }],
		},
		coreTerms,
	);

	// 命中 5 个核心词
	const fiveTermMatch = scoreCandidateTwoAxis(
		{
			contributions: 10,
			prCount: 0,
			personalRepoEvidence: ["me/agent-mcp"],
			bio: "agent mcp runtime infra builder",
			location: "",
			profileGeoEvidence: { matched: false },
			ecosystemGeoEvidence: { matched: false },
			repos: [{ fullName: "me/agent-mcp", description: "llm agent runtime mcp evaluation" }],
		},
		coreTerms,
	);

	assert.equal(oneTermMatch.evidenceTier, fiveTermMatch.evidenceTier, "同档才能比较密度效果");
	assert.ok(
		fiveTermMatch.score > oneTermMatch.score,
		`5词命中(${fiveTermMatch.score}) 应 > 1词命中(${oneTermMatch.score})`,
	);
	assert.ok(fiveTermMatch.signals.some((s) => s.startsWith("core-density-bonus")));
	assert.ok(!oneTermMatch.signals.some((s) => s.startsWith("core-density-bonus")));
});

test("新信号仍受 secondaryCapPts 硬约束：次轴拉满的弱档不跨 adjacent", () => {
	const coreTerms = coreQueryTerms(ENG_QUERY);
	// 弱档候选 + 近期活跃 + 高方向密度：次轴信号叠满，但不能跨档
	const weakMaxBonus = scoreCandidateTwoAxis(
		{
			contributions: 0,
			prCount: 0,
			personalRepoEvidence: [],
			bio: "agent mcp runtime infra llm evaluation builder",
			company: "y",
			location: "Beijing, China",
			profileGeoEvidence: { matched: true },
			ecosystemGeoEvidence: { matched: false },
			repos: [],
			lastActiveAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10天前
		},
		coreTerms,
	);
	assert.equal(weakMaxBonus.evidenceTier, "weak", "次轴再大也不能改变 evidenceTier");
	const adjacentFloor = 2 * (DEFAULT_CONFIG.scoring.rankMultiplier ?? 100);
	assert.ok(
		weakMaxBonus.score < adjacentFloor,
		`弱档+满次轴(${weakMaxBonus.score}) 仍不得到达 adjacent 档下限(${adjacentFloor})`,
	);
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

test("reachability：统计公开通道、封顶、hireable 单列", () => {
	const r = computeReachability({
		profileRaw: {
			email: "a@b.com",
			blog: "https://me.dev",
			twitter_username: "handle",
			hireable: true,
		},
	});
	assert.deepEqual(
		[...r.channels].sort(),
		["blog/homepage", "public-email", "x/twitter"],
	);
	assert.equal(r.hireableFlag, true);
	assert.ok(r.points > 0);
	assert.ok(r.signals.includes("hireable-flag-unverified"));
});

test("reachability：无公开通道 → note 提示先找公开联系方式", () => {
	const r = computeReachability({ profileRaw: {} });
	assert.equal(r.channels.length, 0);
	assert.equal(r.points, 0);
	assert.match(r.note, /未见公开可达通道/u);
});

test("reachability 隐私红线：hireable 只进输出，不影响分数", () => {
	const base = {
		contributions: 60,
		prCount: 0,
		personalRepoEvidence: [],
		repos: [],
		profileGeoEvidence: { matched: false },
		ecosystemGeoEvidence: { matched: false },
		profileRaw: {},
	};
	const noHireable = scoreCandidateTwoAxis(base, [], DEFAULT_CONFIG);
	const withHireable = scoreCandidateTwoAxis(
		{ ...base, profileRaw: { hireable: true } },
		[],
		DEFAULT_CONFIG,
	);
	// hireable 是公开自标记，绝不作可招聘性结论 → 不加分；两者分数必须相等
	assert.equal(withHireable.score, noHireable.score);
	assert.equal(withHireable.reachability.hireableFlag, true);
});

test("reachability 不破两轴硬约束：弱档+满通道仍弱、不反超强档", () => {
	const weakManyChannels = scoreCandidateTwoAxis(
		{
			contributions: 0,
			prCount: 0,
			personalRepoEvidence: [],
			repos: [],
			profileGeoEvidence: { matched: false },
			ecosystemGeoEvidence: { matched: false },
			profileRaw: {
				email: "a@b.com",
				blog: "b",
				twitter_username: "t",
				hireable: true,
			},
		},
		[],
		DEFAULT_CONFIG,
	);
	const strongNoChannels = scoreCandidateTwoAxis(
		{
			contributions: 80,
			prCount: 2,
			personalRepoEvidence: ["core/impl"],
			repos: [],
			profileGeoEvidence: { matched: false },
			ecosystemGeoEvidence: { matched: false },
			profileRaw: {},
		},
		[],
		DEFAULT_CONFIG,
	);
	assert.equal(weakManyChannels.evidenceTier, "weak");
	assert.equal(strongNoChannels.evidenceTier, "strong");
	assert.ok(
		strongNoChannels.score > weakManyChannels.score,
		"满可达通道的弱档不得反超无通道的强档",
	);
});
