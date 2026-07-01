// 学术召回/重排纯函数核（无 I/O、无 OpenAlex、无副作用）。
// 机制在这里，small-batch-academic.mjs 只做 OpenAlex 拉取 + 调用本核 + 输出 proposal。
// 与 sifta-github-engineering/scripts/recall-lib.mjs 同构：两轴可解释重排 + 确定性单测。
// 同目录 import：sync-local 用 `rsync -a` 整目录搬运，平级文件路径在两种布局下都稳定。
//
// 学术域与 GitHub 域的关键差异（为什么不能复用 github recall-lib）：
//  1. 主轴信号不同：GitHub 用 contributions/PR，学术用 cited_by/works_count/近年发文。
//  2. survey/综述高引是"综述效应"，不证明研究能力 → 必须降权（isSurveyWork）。
//  3. OpenAlex author 消歧不完全：常见名 + 跨无关学科的合并实体会被抬成高引强候选
//     → 必须有消歧质量门（detectDisambiguationRisk），把噪声实体封顶在 adjacent，永不进 strong。
//  4. 学术来源不证明可招聘性 → 调用方所有候选最高 soft bucket（本核只定 evidenceTier，不定 bucket）。

/** 清理 query 字符串（对齐 github recall-lib cleanSearchQuery）。 */
export function cleanSearchQuery(value) {
  return String(value || "multimodal large language model alignment")
    .replace(/[，；。]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 220);
}

const QUERY_STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "are", "has", "have",
  "was", "been", "can", "will", "not", "but", "its", "our", "via", "using",
  "based", "large", "model", "models", "system", "systems", "learning",
  "deep", "neural", "network", "networks", "approach", "method", "methods",
]);

/** 提取核心方向词（去停用词、≥3 字母实词，去重保序）。 */
export function coreQueryTerms(value) {
  return [
    ...new Set(
      cleanSearchQuery(value)
        .toLowerCase()
        .split(/[^a-z0-9+#]+/u)
        .filter((term) => term.length >= 3 && !QUERY_STOP_WORDS.has(term)),
    ),
  ];
}

// survey / 综述 / 评述类标题：高引主要来自综述效应，不证明一手研究能力。
// 学术 SKILL 已规定 survey/list 是弱信号；这里在评分层面落地：survey 证据不进强档。
const SURVEY_TITLE_PATTERNS = [
  /\bsurvey\b/i,
  /\breview\b/i,
  /\boverview\b/i,
  /\ba comprehensive (study|review|survey|overview)\b/i,
  /\bsystematic (review|literature)\b/i,
  /\btutorial\b/i,
  /\bbenchmark(ing)? (study|survey)\b/i,
];

/** 标题是否为 survey/综述类（弱研究证据）。 */
export function isSurveyWork(title) {
  const text = String(title ?? "");
  return SURVEY_TITLE_PATTERNS.some((p) => p.test(text));
}

// OpenAlex author 消歧失败的典型形态：一个 author 实体把多个同名真人合并，
// 表现为概念标签横跨彼此无关的重学科（医学 + 材料 + AI 同时高权重）。
// 这些"硬科学非-CS"领域若同时出现 ≥2 个，强烈提示是被污染的合并实体。
// 注意：只用客观的 concept 跨度信号，不用姓名/族裔判断（守反歧视红线）。
const UNRELATED_HEAVY_FIELDS = [
  /^medicine$/i,
  /^materials science$/i,
  /^biology$/i,
  /^chemistry$/i,
  /^physics$/i,
  /^geology$/i,
  /^environmental science$/i,
  /^economics$/i,
  /^political science$/i,
  /^psychology$/i,
  /^agricultural/i,
];

/**
 * 消歧质量门：判断候选是否疑似 OpenAlex 合并的噪声实体。
 * 客观信号（都不含姓名）：
 *   a. concept 横跨 ≥2 个与 CS/AI 无关的重学科；
 *   b. 极高 worksCount（≥80）但缺 identity 交叉锚（无 ORCID 且无主页）——单实体难以核验；
 *   c. recentWorksCount 与 worksCount 严重背离的超高产（年均发文 > 25，疑似多人合并）。
 * @returns {{risky:boolean, reasons:string[]}}
 */
export function detectDisambiguationRisk(candidate) {
  const reasons = [];
  const concepts = (candidate.conceptTags ?? []).map((c) => String(c));
  const unrelatedHits = concepts.filter((c) =>
    UNRELATED_HEAVY_FIELDS.some((p) => p.test(c.trim())),
  );
  if (unrelatedHits.length >= 2) {
    reasons.push(`概念横跨无关重学科（${unrelatedHits.slice(0, 3).join("/")}），疑似同名合并实体`);
  }

  const works = candidate.worksCount ?? 0;
  const hasIdentityAnchor = !!(candidate.orcid || candidate.homepageUrl);
  if (works >= 80 && !hasIdentityAnchor) {
    reasons.push(`发文 ${works} 但无 ORCID/主页交叉锚，单实体身份不可核验`);
  }

  // 年均发文：worksCount / 活跃年数的粗估；超高产强烈提示多人合并。
  const activeYears = Math.max(1, candidate.activeYears ?? 0);
  if (activeYears >= 2 && works / activeYears > 25) {
    reasons.push(`年均发文 ${(works / activeYears).toFixed(0)} 篇异常高，疑似多人合并`);
  }

  return { risky: reasons.length > 0, reasons };
}

/**
 * 学术两轴可解释重排（与 github scoreCandidateTwoAxis 同构）。
 * 主轴 = 研究证据强度（非-survey 引用量 / 发文数 / 近年活跃 / 方向词命中 / 一作通讯）。
 * 次轴 = 地域偏好（机构 country_code CN/HK/TW 强信号；机构名匹配中文生态为弱信号），档内封顶。
 *
 * 硬约束：
 *  - evidenceRank × rankMultiplier 主导，secondaryCap < rankMultiplier → 弱档永不跨档反超。
 *  - 消歧 risky 的实体 evidenceTier 封顶 adjacent（永不 strong），不让噪声实体冒充强候选。
 *  - survey-only 证据不享受高引强档：引用主轴按 nonSurveyCited 计。
 *
 * @param {object} candidate
 * @param {string[]} coreTerms
 * @returns {{score:number,evidenceTier:'strong'|'adjacent'|'weak',evidenceRank:number,priority:'A'|'B'|'C',signals:string[],disambiguationRisk:string[]}}
 */
export function scoreAcademicTwoAxis(candidate, coreTerms = []) {
  const signals = [];

  // ── 主轴：研究证据强度 ───────────────────────────────────────────────
  let evidence = 0;

  // 引用量按"非 survey 引用"计：survey 高引是综述效应，不证明一手研究能力。
  // 调用方应提供 nonSurveyCitedByCount；缺省时退回总引用（向后兼容）。
  const cited =
    candidate.nonSurveyCitedByCount ?? candidate.citedByCount ?? 0;
  const surveyOnly =
    (candidate.nonSurveyWorksCount ?? null) === 0 &&
    (candidate.surveyWorksCount ?? 0) >= 1;

  if (cited >= 500) {
    evidence += 3;
    signals.push("cited:500+");
  } else if (cited >= 100) {
    evidence += 2;
    signals.push("cited:100+");
  } else if (cited >= 10) {
    evidence += 1;
    signals.push("cited:10+");
  }
  if (surveyOnly) {
    // 证据全是综述：扣回一档，并标记，避免"高引 survey 作者"被抬成 strong。
    evidence = Math.max(0, evidence - 1);
    signals.push("survey-only-penalty");
  }

  const worksCount = candidate.worksCount ?? 0;
  if (worksCount >= 30) {
    evidence += 2;
    signals.push("works:30+");
  } else if (worksCount >= 5) {
    evidence += 1;
    signals.push("works:5+");
  }

  const recentWorks = candidate.recentWorksCount ?? 0;
  if (recentWorks >= 3) {
    evidence += 1;
    signals.push("recent-active:3+");
  } else if (recentWorks >= 1) {
    signals.push("recent-active:1+");
  }

  const conceptText = (candidate.conceptTags ?? []).join(" ").toLowerCase();
  const evidenceText = (candidate.evidence ?? []).join(" ").toLowerCase();
  const fullText = `${conceptText} ${evidenceText}`;
  const coreMatches = coreTerms.filter((term) => fullText.includes(term)).length;
  if (coreMatches >= 2) {
    evidence += 2;
    signals.push(`core-term-match:${coreMatches}`);
  } else if (coreMatches >= 1) {
    evidence += 1;
    signals.push(`core-term-match:${coreMatches}`);
  }

  if ((candidate.firstOrCorrespondingAuthorCount ?? 0) >= 1) {
    evidence += 1;
    signals.push("first-or-corr-author");
  }

  // ── 消歧质量门：噪声合并实体封顶 adjacent，永不进 strong ──────────────
  const disamb = detectDisambiguationRisk(candidate);

  let evidenceTier =
    evidence >= 6 ? "strong" : evidence >= 3 ? "adjacent" : "weak";
  if (disamb.risky && evidenceTier === "strong") {
    evidenceTier = "adjacent";
    signals.push("disambiguation-risk-capped");
  }
  if (disamb.risky) signals.push("disambiguation-risk");
  // survey-only：没有任何一手研究证据，封顶 adjacent，不让"高引综述作者"冒充强候选。
  if (surveyOnly && evidenceTier === "strong") {
    evidenceTier = "adjacent";
    signals.push("survey-only-capped");
  }
  // 方向门：完全不命中方向词的作者，无论多高产都不给 strong。
  // 根因（实测）：strong 阈值被 cited/works/一作数主导，方向命中只 +1~2，
  // 导致"self-adaptive 软件系统"等靠通用词误召的高产者也能进 strong。
  // 研究人才召回里"方向对不对"是硬前提，产出量高但方向不命中只能是相邻线索。
  if (coreMatches === 0 && evidenceTier === "strong") {
    evidenceTier = "adjacent";
    signals.push("no-direction-capped");
  }

  const evidenceRank =
    evidenceTier === "strong" ? 3 : evidenceTier === "adjacent" ? 2 : 1;
  signals.push(`evidence:${evidenceTier}`);

  // ── 次轴：地域偏好（档内加分，封顶 < rankMultiplier）─────────────────
  const rankMultiplier = 100;
  const secondaryCapPts = 25;

  let secondary = 0;
  const geoStrong = !!candidate.geoStrong;
  const geoMatched = !!candidate.geoMatched;
  if (geoStrong) {
    secondary += 8;
    signals.push("geo:CN/HK/TW");
  } else if (geoMatched) {
    secondary += 3;
    signals.push("geo:cn-ecosystem");
  }
  if (geoStrong && coreMatches >= 1) {
    secondary += 12;
    signals.push("geo-direction-fit");
  }
  if (candidate.homepageUrl || candidate.orcid) {
    secondary += 2;
    signals.push("identity-verifiable");
  }
  secondary = Math.min(secondary, secondaryCapPts);

  return {
    score: evidenceRank * rankMultiplier + evidence * 10 + secondary,
    evidenceTier,
    evidenceRank,
    priority:
      evidenceTier === "strong" ? "A" : evidenceTier === "adjacent" ? "B" : "C",
    signals,
    disambiguationRisk: disamb.reasons,
  };
}
