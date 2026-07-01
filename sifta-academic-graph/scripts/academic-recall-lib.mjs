// 学术召回的纯函数核（无 I/O、无 OpenAlex、无副作用）。
// small-batch-academic.mjs 做 OpenAlex 拉取 + 调用本核 + 输出 proposal。
//
// 设计边界（重要）：本核只做**确定性、客观**的事——
//   - 清理/构造搜索字符串（cleanSearchQuery / coreQueryTerms，仅供构造 OpenAlex 查询）；
//   - 按客观数值（引用量 / 发文数 / 近年活跃 / 一作通讯 / country_code 地域事实）给"机械信号强度"粗排。
// 它**不做语义判断**：是不是综述、是不是同名合并实体、方向对不对、是不是中国生态——
// 这些交给宿主 Agent 依 sifta-search/references/academic-source-playbook.md §5 判断准则去判。
// 原因：这些判断靠正则/枚举表实现会枚举不尽、跨语言失效（中文 query vs 英文标题），
// 是典型"该交给 LLM 语义能力"的活。脚本硬编码它们既脆弱又有偏，故一律移到 rubric。

/** 清理 query 字符串（归一中文标点/空白、截断），仅供构造搜索用。 */
export function cleanSearchQuery(value) {
  return String(value || "multimodal large language model alignment")
    .replace(/[，；。]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 220);
}

// 停用词仅用于"把长 query 压成更聚焦的搜索串"这一构造用途（不是判断方向命中）。
// 方向是否契合由 Agent 判断，见 rubric §5.2。
const QUERY_STOP_WORDS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "are", "has", "have",
  "was", "been", "can", "will", "not", "but", "its", "our", "via", "using",
  "based", "large", "model", "models", "system", "systems", "learning",
  "deep", "neural", "network", "networks", "approach", "method", "methods",
]);

/** 提取核心词（去停用词、≥3 字母实词，去重保序）——仅供构造聚焦搜索串。 */
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

/**
 * 客观信号粗排（NON-authoritative）。
 * 只用客观数值给一个"机械信号强度"分，供脚本内粗排/截断；**不是**权威判级。
 * 最终 tier（强/相邻/弱、是否综述弱证据、是否消歧风险、方向是否契合）由宿主 Agent
 * 依 references/academic-source-playbook.md §5 判断，脚本不越俎代庖。
 *
 * @param {object} candidate  含 citedByCount / worksCount / recentWorksCount /
 *   firstOrCorrespondingAuthorCount / geoStrong / homepageUrl / orcid
 * @returns {{score:number, roughStrength:number, roughBand:'high'|'mid'|'low', signals:string[]}}
 */
export function scoreAcademicRoughSignals(candidate) {
  const signals = [];

  // ── 主轴：客观研究信号强度（纯数值，不含语义判断）──────────────────────
  let strength = 0;

  const cited = candidate.citedByCount ?? 0;
  if (cited >= 500) {
    strength += 3;
    signals.push("cited:500+");
  } else if (cited >= 100) {
    strength += 2;
    signals.push("cited:100+");
  } else if (cited >= 10) {
    strength += 1;
    signals.push("cited:10+");
  }

  const worksCount = candidate.worksCount ?? 0;
  if (worksCount >= 30) {
    strength += 2;
    signals.push("works:30+");
  } else if (worksCount >= 5) {
    strength += 1;
    signals.push("works:5+");
  }

  const recentWorks = candidate.recentWorksCount ?? 0;
  if (recentWorks >= 3) {
    strength += 1;
    signals.push("recent-active:3+");
  } else if (recentWorks >= 1) {
    signals.push("recent-active:1+");
  }

  if ((candidate.firstOrCorrespondingAuthorCount ?? 0) >= 1) {
    strength += 1;
    signals.push("first-or-corr-author");
  }

  // ── 次轴：地域偏好，只用 country_code 客观事实（CN/HK/TW）──────────────
  // 机构名/公司是否属中国生态由 Agent 判断（rubric §5.4），脚本不枚举机构清单。
  // 封顶 < 主轴档距，弱证据不因地域跨档反超（次轴永远只是档内加分）。
  let secondary = 0;
  if (candidate.geoStrong) {
    secondary += 8;
    signals.push("geo:CN/HK/TW");
  }
  if (candidate.homepageUrl || candidate.orcid) {
    secondary += 2;
    signals.push("identity-verifiable");
  }
  secondary = Math.min(secondary, 25);

  // roughBand 仅供脚本内粗排/截断，非权威判级（提醒下游别当 tier 用）。
  const roughBand = strength >= 6 ? "high" : strength >= 3 ? "mid" : "low";

  return {
    score: strength * 10 + secondary,
    roughStrength: strength,
    roughBand,
    signals,
  };
}
