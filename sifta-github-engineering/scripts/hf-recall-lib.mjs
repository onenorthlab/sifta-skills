// 纯函数：HuggingFace 工程贡献者的客观信号粗排（无 I/O、无副作用、无语义判断）。
// 与 academic/github 召回核同构：脚本只做确定性召回 + 客观量级粗排；
// "是不是核心工程师、方向对不对、是否中国生态、可招性"是语义判断，交宿主 Agent 依 rubric。
//
// 客观信号（都不含判断）：论文数、关注数、贡献到的种子模型下载量、贡献模型数、身份完整度。

/**
 * @param {object} c  含 numPapers / numFollowers / contributedModels[{downloads}] / fullName / orgs
 * @returns {{score:number, roughStrength:number, roughBand:'high'|'mid'|'low', signals:string[]}}
 */
export function scoreHfContributor(c) {
  const signals = [];
  let strength = 0;

  const papers = c.numPapers ?? 0;
  if (papers >= 10) { strength += 2; signals.push("papers:10+"); }
  else if (papers >= 1) { strength += 1; signals.push("papers:1+"); }

  // 注意：不把 numFollowers 计入强度——关注数奖励的是平台名气(HF DevRel/网红关注数极高)，
  // 与"是不是实验室核心工程师"无关，会把 HF 平台员工顶到高档。关注数只作为原始字段 emit 供 Agent 参考。

  // 贡献到的种子模型总下载量：贡献到高影响力模型是强工程信号（客观量级）。
  const dl = (c.contributedModels ?? []).reduce((s, m) => s + (m.downloads ?? 0), 0);
  if (dl >= 1_000_000) { strength += 3; signals.push("model-downloads:1M+"); }
  else if (dl >= 100_000) { strength += 2; signals.push("model-downloads:100k+"); }
  else if (dl >= 10_000) { strength += 1; signals.push("model-downloads:10k+"); }

  const models = (c.contributedModels ?? []).length;
  if (models >= 3) { strength += 1; signals.push(`contributed-models:${models}`); }

  // 次轴：身份完整度（弱 tiebreaker，封顶，永不跨档）。有真名/组织=更易核验与触达。
  let secondary = 0;
  if (c.fullName) { secondary += 2; signals.push("has-real-name"); }
  if ((c.orgs ?? []).length) { secondary += 1; signals.push(`orgs:${(c.orgs ?? []).length}`); }
  secondary = Math.min(secondary, 5);

  const roughBand = strength >= 5 ? "high" : strength >= 2 ? "mid" : "low";
  return { score: strength * 10 + secondary, roughStrength: strength, roughBand, signals };
}

// 明显的组织/机器人账号（不是个人工程师），召回时跳过。只做客观形态判断，不猜身份。
export function isOrgOrBot(username, orgSeeds = []) {
  const u = String(username ?? "").toLowerCase();
  if (!u) return true;
  if (/\bbot\b|-bot$|\[bot\]|^system$|^admin$/u.test(u)) return true;
  return orgSeeds.some((o) => String(o).toLowerCase() === u);
}

// HF 平台运营人员（huggingface 官方 org 成员）会因维护/curation 提交出现在大量模型的 commit 里，
// 但他们是平台方、不是实验室招聘目标。这是客观的"平台角色"事实(等同 bot 过滤)，不是人才判断。
const HF_PLATFORM_ORGS = new Set(["huggingface", "huggingface-course", "hf-internal-testing", "evaluate-metric"]);
export function isPlatformStaff(orgs = []) {
  return (orgs || []).some((o) => HF_PLATFORM_ORGS.has(String(o).toLowerCase()));
}
