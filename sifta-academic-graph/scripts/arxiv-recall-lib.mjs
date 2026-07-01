// 纯函数：arXiv 论文线索的客观处理（无 I/O、无副作用、无语义判断）。
// arXiv 给的是论文 + 作者名字串（无 profile / 无机构 / 无消歧），所以脚本只做确定性的
// "论文→代码链接抽取 + 客观粗排"，把"哪个是核心作者、是否中国生态、身份是谁、可招性"
// 全部交宿主 Agent 走 paper→code→identity + Scholar/主页核验。

// 从论文 comment / abstract 里抽官方代码仓链接（github/gitlab）。有官方代码=最干净的身份路径。
export function extractCodeUrl(text) {
  if (!text) return null;
  const m = String(text).match(/https?:\/\/(?:github\.com|gitlab\.com)\/[\w.-]+\/[\w.-]+/i);
  if (!m) return null;
  return m[0].replace(/[).,]+$/, "");
}

// 项目页链接（有些论文不放 github 但有 project page，也是找人入口）。
export function extractProjectUrl(text) {
  if (!text) return null;
  const m = String(text).match(/https?:\/\/[\w.-]+\.github\.io\/[\w./-]*/i);
  return m ? m[0].replace(/[).,]+$/, "") : null;
}

/**
 * 论文线索的客观粗排（决定先追哪条 paper→code→identity 链，不排人）。
 * 强度只看客观项：有无官方代码(能拿到干净 GitHub 身份=最高)、新旧。
 * @param {object} p  { codeUrl, projectUrl, published(ISO), authorCount }
 * @param {string} nowIso  参考"现在"时间（ISO，由调用方传入，避免脚本读时钟）
 */
export function scoreArxivPaper(p, nowIso) {
  const signals = [];
  let strength = 0;
  if (p.codeUrl) { strength += 3; signals.push("official-code"); }
  else if (p.projectUrl) { strength += 1; signals.push("project-page"); }

  // 新近度：越新越可能是"在标杆之上继续做"的年轻梯队（招聘更想要）。
  if (p.published && nowIso) {
    const days = (Date.parse(nowIso) - Date.parse(p.published)) / 86400000;
    if (days <= 90) { strength += 2; signals.push("recent:90d"); }
    else if (days <= 365) { strength += 1; signals.push("recent:1y"); }
  }

  const band = strength >= 4 ? "high" : strength >= 2 ? "mid" : "low";
  return { score: strength, band, signals };
}
