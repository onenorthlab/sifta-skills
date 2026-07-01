#!/usr/bin/env node
/**
 * small-batch-arxiv.mjs —— arXiv 论文的程序化召回（无需 key）。
 *
 * 为什么：AI 研究者真实足迹在 arXiv（几乎所有 AI 论文的预印本，官方 API 免费无 key、最新最全、
 * 直连稳定），比 OpenAlex 全文搜索（易 504）新且全。用途=给"前沿/顶会研究员"画像做**最新方向
 * 论文的召回入口**，拿到论文+作者+官方代码链接，再交宿主 Agent 走 `paper→code→GitHub +
 * Scholar/主页` 核实身份。OpenReview 已弃用（无 key 不可用）。
 *
 * 分工（铁律）：脚本只做确定性召回（拉方向论文、抽代码链接、按客观项粗排），
 * "哪个是核心作者、是否中国生态、身份是谁、可招性"全交 Agent——arXiv 只给作者名字串，
 * 无 profile/机构/消歧，脚本不臆断。
 *
 * 隐私：arXiv 作者名/论文/代码链接都是公开学术署名，可输出并标来源；不查私人联系方式。
 *
 * 用法：
 *   node small-batch-arxiv.mjs --query "vision language model" --category cs.CV --category cs.CL --json
 *   node small-batch-arxiv.mjs --query "llm inference kv cache" --category cs.LG --max-results 40
 */
import { extractCodeUrl, extractProjectUrl, scoreArxivPaper } from "./arxiv-recall-lib.mjs";

function parseArgs(argv) {
  const args = { query: "", categories: [], maxResults: 30, json: false };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[(i += 1)];
    if (a === "--query") args.query = next() ?? "";
    else if (a === "--category") args.categories.push(next());
    else if (a === "--max-results") args.maxResults = Number(next()) || args.maxResults;
    else if (a === "--json") args.json = true;
  }
  return args;
}

const args = parseArgs(process.argv);

function buildSearchQuery() {
  const parts = [];
  if (args.categories.length) {
    parts.push(`(${args.categories.map((c) => `cat:${c}`).join("+OR+")})`);
  }
  if (args.query) {
    const terms = args.query.trim().split(/\s+/).map(encodeURIComponent).join("+");
    parts.push(`all:${terms}`);
  }
  return parts.join("+AND+") || "all:artificial+intelligence";
}

// 极简 Atom 解析：按 <entry> 切块，逐块正则取字段（arXiv 返回结构稳定）。
function parseEntries(xml) {
  const entries = [];
  const blocks = xml.split(/<entry>/).slice(1).map((b) => b.split(/<\/entry>/)[0]);
  for (const b of blocks) {
    const pick = (tag) => {
      const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
      return m ? m[1].replace(/\s+/g, " ").trim() : "";
    };
    const title = pick("title");
    const summary = pick("summary");
    const published = pick("published");
    const idUrl = pick("id");
    const comment = (b.match(/<arxiv:comment[^>]*>([\s\S]*?)<\/arxiv:comment>/) || [])[1] || "";
    const authors = [...b.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)].map((m) => m[1].trim());
    entries.push({ title, summary, published, idUrl, comment, authors });
  }
  return entries;
}

async function main() {
  const url =
    `https://export.arxiv.org/api/query?search_query=${buildSearchQuery()}` +
    `&sortBy=submittedDate&sortOrder=descending&max_results=${args.maxResults}`;

  let xml;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    const resp = await fetch(url, { headers: { "user-agent": "sifta-arxiv-small-batch/0.1" }, signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`arXiv HTTP ${resp.status}`);
    xml = await resp.text();
  } catch (err) {
    const fail = { source: "arxiv", coverage: "provider_failure", error: String(err?.message ?? err), papers: [] };
    process.stdout.write(args.json ? `${JSON.stringify(fail, null, 2)}\n` : `arXiv 拉取失败: ${fail.error}\n`);
    process.exit(1);
  }

  // nowIso 取最新一篇的 published 作参考点（避免脚本读系统时钟；相对新近度足够）。
  const raw = parseEntries(xml);
  const nowIso = raw[0]?.published || "";

  const papers = raw
    .map((e) => {
      const codeUrl = extractCodeUrl(`${e.comment} ${e.summary}`);
      const projectUrl = extractProjectUrl(`${e.comment} ${e.summary}`);
      const s = scoreArxivPaper({ codeUrl, projectUrl, published: e.published, authorCount: e.authors.length }, nowIso);
      const arxivUrl = e.idUrl;
      return {
        title: e.title,
        authors: e.authors,
        firstAuthor: e.authors[0] || null,
        published: (e.published || "").slice(0, 10),
        arxivUrl,
        codeUrl,
        projectUrl,
        band: s.band,
        signals: s.signals,
        score: s.score,
        // Agent 必须判的（脚本不判）：
        needsAgentJudgment: [
          "核心作者是谁（一作/通讯/共同一作，非按顺序臆断）",
          "身份核验：走 paper→code→GitHub + Google Scholar/主页，确认真人",
          "是否中国/中文生态（作者机构，arXiv 未给，需读论文首页/主页核）",
          "职业阶段与可招性（在读/毕业/在职，不推断意愿）",
        ],
      };
    })
    .sort((a, b) => b.score - a.score);

  const proposal = {
    source: "arxiv",
    query: args.query,
    categories: args.categories,
    coverage: papers.length ? "pilot" : "empty",
    totalPapers: papers.length,
    withCode: papers.filter((p) => p.codeUrl).length,
    papers,
    legsCovered: ["arxiv-recent-by-direction"],
    note: "arXiv 最新方向论文召回：只给论文+作者名+代码链接，身份/核心作者/地域/可招性交 Agent 核。有官方代码的优先追(能拿干净 GitHub 身份)。",
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(proposal, null, 2)}\n`);
    return;
  }
  process.stdout.write(`\n=== arXiv 最新方向论文召回 (${papers.length} 篇, ${proposal.withCode} 篇带官方代码) ===\n\n`);
  for (const p of papers.slice(0, 15)) {
    process.stdout.write(
      `[${p.band}] ${p.published} ${p.title}\n` +
        `   一作:${p.firstAuthor} | 作者${p.authors.length}人 | ${p.arxivUrl}\n` +
        (p.codeUrl ? `   代码:${p.codeUrl}\n` : p.projectUrl ? `   项目页:${p.projectUrl}\n` : "") +
        "\n",
    );
  }
}

main().catch((err) => {
  process.stderr.write(`fatal: ${String(err?.message ?? err)}\n`);
  process.exit(1);
});
