#!/usr/bin/env node

/**
 * small-batch-academic.mjs
 * 学术图谱召回 helper（OpenAlex API）。**只做召回 + 客观信号粗排，不做语义判级。**
 *
 * 职责边界（重要）：
 *   脚本负责——OpenAlex 召回（seed/图邻居/paper-first/profile-first 腿）、去重、预算控制、
 *   country_code 地域事实、按客观数值（引用/发文/近年活跃/一作通讯）粗排、隐私硬门（最高 soft）。
 *   脚本不负责——综述是否弱证据、是否疑似同名合并实体、方向是否契合、机构是否属中国生态。
 *   这些是语义判断，靠正则/枚举会枚举不尽、跨语言失效，交给宿主 Agent 依
 *   sifta-search/references/academic-source-playbook.md §5 判断。输出里每个候选带
 *   needsAgentJudgment 明确标记待判项；roughBand 只是机械粗排，不是判级。
 *
 * 数据源：OpenAlex API（https://api.openalex.org，完全开放，无需 API key）。
 * 礼貌池：所有请求加 ?mailto=（env OPENALEX_MAILTO 覆盖）。
 *
 * 用法：
 *   node small-batch-academic.mjs --query "..." --seed W4385403811 --target-count 4
 *   node small-batch-academic.mjs --query "multimodal alignment" --target-count 3 --max-elapsed-ms 60000
 *   node small-batch-academic.mjs --query "..." --markdown  # 调试 fallback
 *
 * 输出形状对齐 small-batch-github.mjs proposal JSON：
 *   people / leadPeople / sourceLeads / coverage / recallPaths / providerFailed / executedSources
 *   每个 person：source/displayName/profileUrl/evidence/conceptTags/institutionNames/roughBand/
 *   needsAgentJudgment/risk/nextAction/bucket（学术最高 soft）
 */

// ─────────────────────────────────────────────────────────────────────────────
// 召回核：import 自同目录 academic-recall-lib.mjs
// sync 用 rsync -a 整目录搬运，同目录相对路径在 workspace / ~/.agents/skills 两种布局下都稳定。
// lib 只含确定性逻辑（搜索串构造 + 客观信号粗排），由 academic-recall-lib.test.mjs 单测守护。
// ─────────────────────────────────────────────────────────────────────────────
import {
  cleanSearchQuery,
  coreQueryTerms,
  scoreAcademicRoughSignals,
} from "./academic-recall-lib.mjs";

// ─────────────────────────────────────────────────────────────────────────────
// CLI 参数解析
// ─────────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {
    query: "",
    targetCount: 3,
    worksPerQuery: 10,    // 每次 works 搜索拉多少篇论文
    authorsPerWork: 3,    // 每篇论文最多取前 N 个 author
    maxAuthors: 30,       // 全程最多 hydrate 多少个 author 详情
    maxElapsedMs: 55_000,
    recentYears: 2,       // "近期活跃"定义：N 年内有发文
    seeds: [],            // 种子论文（OpenAlex work id 或标题）：paper-first 从具名标杆锚定
    json: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--query" && next) args.query = next;
    if (arg === "--target-count" && next) args.targetCount = Number(next);
    if (arg === "--works-per-query" && next) args.worksPerQuery = Number(next);
    if (arg === "--authors-per-work" && next) args.authorsPerWork = Number(next);
    if (arg === "--max-authors" && next) args.maxAuthors = Number(next);
    if (arg === "--max-elapsed-ms" && next) args.maxElapsedMs = Number(next);
    if (arg === "--recent-years" && next) args.recentYears = Number(next);
    if (arg === "--seed" && next) args.seeds.push(next);  // 可重复：多个种子论文
    if (arg === "--json") { args.json = next !== "false"; continue; }
    if (arg === "--markdown") { args.json = false; continue; }
    if (arg.startsWith("--")) i += 1;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
args.targetCount = Math.max(1, args.targetCount || 3);
args.worksPerQuery = Math.min(25, Math.max(5, args.worksPerQuery || 10));
args.authorsPerWork = Math.min(5, Math.max(1, args.authorsPerWork || 3));
args.maxAuthors = Math.max(args.targetCount * 4, args.maxAuthors || 30);
args.maxElapsedMs = Math.max(10_000, args.maxElapsedMs || 55_000);

// 两腿分预算：paper-first 占 ~60%，剩余留给 profile-first。
// 否则 paper-first 吃满 maxAuthors，profile-first 一个作者都召不到（实测的真实问题）。
const paperFirstCap = Math.max(args.targetCount * 3, Math.floor(args.maxAuthors * 0.6));

const startedAt = Date.now();
function timeRemainingMs() {
  return Math.max(0, args.maxElapsedMs - (Date.now() - startedAt));
}
function timeBudgetExceeded() {
  return Date.now() - startedAt >= args.maxElapsedMs;
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenAlex API 请求工具
// ─────────────────────────────────────────────────────────────────────────────

const OPENALEX_BASE = "https://api.openalex.org";
const OPENALEX_MAILTO =
  (process.env.OPENALEX_MAILTO || "sifta-academic@example.com").trim();
const OPENALEX_TIMEOUT_MS = 15_000;

let providerFailed = false;
let timeBudgetHit = false;

function openAlexUrl(path, params = {}) {
  const url = new URL(`${OPENALEX_BASE}/${path.replace(/^\/+/u, "")}`);
  // 礼貌池：所有请求必须加 mailto
  url.searchParams.set("mailto", OPENALEX_MAILTO);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  return url.toString();
}

async function openAlexJson(path, params = {}) {
  if (timeBudgetExceeded()) {
    timeBudgetHit = true;
    return { error: "time_budget_exceeded", budgetTimedOut: true };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENALEX_TIMEOUT_MS);
  try {
    const resp = await fetch(openAlexUrl(path, params), {
      headers: { "user-agent": "sifta-academic-small-batch/0.1" },
      signal: controller.signal,
    });
    const body = await resp.text();
    if (!resp.ok) {
      const err = new Error(
        `OpenAlex API ${resp.status} ${resp.statusText}: ${body.slice(0, 300)}`,
      );
      err.status = resp.status;
      throw err;
    }
    return body ? JSON.parse(body) : null;
  } catch (err) {
    if (err.name === "AbortError") {
      return { error: "request_timeout", message: "OpenAlex request timed out" };
    }
    return {
      error: String(err.message ?? err),
      status: err?.status,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 地域判断（基于机构公开信息，不做姓名/族裔推断）
// ─────────────────────────────────────────────────────────────────────────────

// 中国/香港/台湾 country_code —— 唯一的客观地域事实。
// 机构名/公司是否属"中国生态"（清华、智谱、深势、某 AI 创业公司…）是语义判断，
// 不在脚本里用机构清单枚举（枚举不尽、会漏新公司）；脚本只给 country_code 事实
// + 原始机构名，让宿主 Agent 依 rubric §5.4 自己判断生态归属。
const CN_COUNTRY_CODES = new Set(["CN", "HK", "TW"]);

function detectGeo(authorData) {
  // last_known_institutions 是最近机构（更准）
  const institutions = [
    ...(authorData.last_known_institutions ?? []),
    ...(authorData.affiliations ?? []).map((a) => a.institution).filter(Boolean),
  ];

  let geoStrong = false;
  // 原始机构名+国别，如实透传给 Agent 判断生态归属（不做任何名称匹配判断）。
  const institutionNames = [];

  for (const inst of institutions) {
    if (!inst) continue;
    const cc = String(inst.country_code ?? "").toUpperCase();
    const name = String(inst.display_name ?? "");
    if (name) institutionNames.push(cc ? `${name}（${cc}）` : name);
    if (CN_COUNTRY_CODES.has(cc)) geoStrong = true;
  }

  return {
    geoStrong,
    institutionNames: [...new Set(institutionNames)].slice(0, 4),
    // geoEvidence：country_code 命中的客观地域事实（供输出展示）。
    geoEvidence: geoStrong
      ? [...new Set(institutionNames)].filter((n) => /（(CN|HK|TW)）$/u.test(n)).slice(0, 2)
      : [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 候选人状态
// ─────────────────────────────────────────────────────────────────────────────

const candidatesByOpenAlexId = new Map();
const recallPaths = [];
const sourceLeads = [];
const hydratedAuthorIds = new Set();

const query = args.query || "multimodal large language model alignment";

// 计算"近期活跃"年份门槛
const recentYearThreshold = new Date().getFullYear() - args.recentYears;

/**
 * 写回客观信号粗排（score / roughBand / signals）。非权威判级——
 * 综述弱证据、消歧、方向契合、生态归属由宿主 Agent 依 rubric §5 判断。
 * 单一入口：upsertCandidate 和已 hydrate 复用路径都调它，保证粗排口径一致。
 */
function applyAcademicScore(c) {
  const scored = scoreAcademicRoughSignals(c);
  c.score = scored.score;
  c.roughBand = scored.roughBand;
  c.roughStrength = scored.roughStrength;
  c.signals = scored.signals;
}

/**
 * 从 OpenAlex author 详情构建/合并候选人记录。
 * 合并策略：同一 OpenAlex author id 只 hydrate 一次，多论文累加 firstOrCorrespondingAuthorCount。
 * 如实透传原始证据（论文标题/concepts/机构/活跃年份），综述/消歧/方向判断留给 Agent。
 */
function upsertCandidate(authorId, authorDetail, workEvidence, isFirstOrCorr) {
  const existing = candidatesByOpenAlexId.get(authorId);

  const countsRaw = authorDetail.counts_by_year ?? [];
  const recentWorksCount = countsRaw
    .filter((y) => (y.year ?? 0) >= recentYearThreshold)
    .reduce((sum, y) => sum + (y.works_count ?? 0), 0);
  // 活跃年份跨度（原始数据，供 Agent 判断"年均发文异常高 → 疑似同名合并"）
  const activeYearList = countsRaw
    .filter((y) => (y.works_count ?? 0) > 0)
    .map((y) => y.year ?? 0)
    .filter((y) => y > 0);
  const activeYears = activeYearList.length
    ? Math.max(...activeYearList) - Math.min(...activeYearList) + 1
    : 0;

  // 概念/主题标签：如实透传给 Agent 判断方向契合 + 是否疑似跨无关学科的合并实体。
  // x_concepts 已被 OpenAlex 弃用（实测返回空），改以 topics 为主；同时收 topic 的
  // 上位 field/domain 名（宽领域），让 Agent 能看到学科横跨情况。
  const topics = authorDetail.topics ?? [];
  const conceptTags = [
    ...(authorDetail.x_concepts ?? []).slice(0, 8).map((c) => c.display_name),
    ...topics.slice(0, 5).map((t) => t.display_name),
    ...topics.map((t) => t.field?.display_name).filter(Boolean),
    ...topics.map((t) => t.domain?.display_name).filter(Boolean),
  ].filter(Boolean);

  const geo = detectGeo(authorDetail);
  const lastInst = (authorDetail.last_known_institutions ?? [])[0];

  const base = existing ?? {
    openAlexId: authorId,
    displayName: authorDetail.display_name ?? "",
    orcid: authorDetail.orcid ?? null,
    homepageUrl: authorDetail.homepage_url ?? null,
    worksCount: authorDetail.works_count ?? 0,
    citedByCount: authorDetail.cited_by_count ?? 0,
    recentWorksCount,
    activeYears,
    lastInstitution: lastInst?.display_name ?? "",
    lastInstitutionCountry: lastInst?.country_code ?? "",
    geoStrong: geo.geoStrong,
    institutionNames: geo.institutionNames,
    geoEvidence: geo.geoEvidence,
    conceptTags,
    evidence: [],
    firstOrCorrespondingAuthorCount: 0,
    sourcedFromWorks: [],
  };

  base.firstOrCorrespondingAuthorCount += isFirstOrCorr ? 1 : 0;
  if (workEvidence && !base.evidence.includes(workEvidence)) {
    base.evidence.push(workEvidence);
  }
  // 以最新 hydrate 的 geo 为准（同一作者多篇论文机构可能不同）
  if (!base.geoStrong && geo.geoStrong) {
    base.geoStrong = true;
    base.geoEvidence = geo.geoEvidence;
  }
  if (geo.institutionNames.length) {
    base.institutionNames = [
      ...new Set([...(base.institutionNames ?? []), ...geo.institutionNames]),
    ].slice(0, 6);
  }

  applyAcademicScore(base);
  candidatesByOpenAlexId.set(authorId, base);
}

// ─────────────────────────────────────────────────────────────────────────────
// 召回腿：paper-first（works 搜索 → authorships → author hydrate）
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 生成 works 搜索查询变体（用 query 核心词，不写死方向词）。
 * 变体 1：全 query 词 + AI subfield 过滤，按引用排序（找高影响 AI 论文，减少跨领域噪音）。
 * 变体 2：核心词子集搜索 + AI subfield 过滤，按引用排序（找细方向论文）。
 * 变体 3：近 1-2 年最新论文，按发表时间排序（发现新兴研究者）。
 *
 * AI subfield filter: primary_topic.subfield.id=https://openalex.org/subfields/1702
 * 覆盖 AI/ML 主题下的 LLM、multimodal、alignment 等方向，排除医学/生态/教育学跨域噪音。
 */
const OPENALEX_AI_SUBFIELD_FILTER = "primary_topic.subfield.id:https://openalex.org/subfields/1702";

function worksSearchVariants(q) {
  const cleaned = cleanSearchQuery(q);
  const terms = coreQueryTerms(q);
  // 取前 4 个核心词拼一个更聚焦的查询
  const focused = terms.slice(0, 4).join(" ");
  const currentYear = new Date().getFullYear();

  const variants = [
    {
      search: cleaned,
      sort: "cited_by_count:desc",
      // AI subfield 过滤 + 近 2 年：缩窄到 AI 域高引论文
      filter: `from_publication_date:${currentYear - 3}-01-01,${OPENALEX_AI_SUBFIELD_FILTER}`,
      label: "full-query-cited-ai",
    },
  ];
  if (focused && focused !== cleaned.toLowerCase()) {
    variants.push({
      search: focused,
      sort: "cited_by_count:desc",
      filter: `from_publication_date:${currentYear - 3}-01-01,${OPENALEX_AI_SUBFIELD_FILTER}`,
      label: "focused-cited-ai",
    });
  }
  // 近 1 年最新论文（发现新兴研究者，放宽到 AI subfield + 时间窗）
  variants.push({
    search: focused || cleaned,
    sort: "publication_date:desc",
    filter: `from_publication_date:${currentYear - 1}-01-01,${OPENALEX_AI_SUBFIELD_FILTER}`,
    label: "recent-ai",
  });
  return variants;
}

async function runPaperFirstLeg(cap) {
  const variants = worksSearchVariants(query);
  for (const variant of variants) {
    if (timeBudgetExceeded()) break;
    if (hydratedAuthorIds.size >= cap) break;

    const params = {
      search: variant.search,
      sort: variant.sort,
      per_page: args.worksPerQuery,
    };
    if (variant.filter) params.filter = variant.filter;

    const result = await openAlexJson("works", params);
    const recallLabel = `OpenAlex works[${variant.label}]: ${variant.search}`;
    recallPaths.push(recallLabel);

    if (result?.error) {
      providerFailed = true;
      sourceLeads.push({
        lead: "OpenAlex works 搜索",
        sourceFamily: "OpenAlex 论文搜索",
        whyRelevant: variant.search,
        blocker: `API 失败: ${result.error}`,
        next: "检查网络或 OpenAlex 服务状态后重试；不要因此判断没有合适的人",
      });
      continue;
    }

    const works = result?.results ?? [];
    for (const work of works) {
      if (timeBudgetExceeded()) break;
      if (hydratedAuthorIds.size >= cap) break;

      await processWorkAuthors(work, cap);
    }
  }
}

// 共享：从一篇 work 抽取一作/通讯作者 → hydrate 详情 → upsert/合并候选，并把论文进来源地图。
// paper-first 和 profile-first 两腿都用它，保证作者抽取/去重口径一致。
// cap：本腿的 hydrate 预算（paper-first 传 paperFirstCap，profile-first 传 maxAuthors）。
async function processWorkAuthors(work, cap, queryLabel) {
  const workTitle = work.title ?? "(无标题)";
  const workUrl = work.doi
    ? `https://doi.org/${work.doi.replace(/^https?:\/\/doi\.org\//i, "")}`
    : work.id ?? "";
  const workCited = work.cited_by_count ?? 0;

  const authorships = work.authorships ?? [];
  // 优先一作/通讯（position: first/last），限制每篇取 N 个
  const prioritized = [
    ...authorships.filter(
      (a) => a.author_position === "first" || a.author_position === "last",
    ),
    ...authorships.filter(
      (a) => a.author_position !== "first" && a.author_position !== "last",
    ),
  ].slice(0, args.authorsPerWork);

  for (const authorship of prioritized) {
    if (timeBudgetExceeded()) break;
    if (hydratedAuthorIds.size >= cap) break;

    const author = authorship.author;
    if (!author?.id) continue;
    const authorId = author.id;
    const isFirstOrCorr =
      authorship.author_position === "first" ||
      authorship.author_position === "last";
    const workEvidence = `论文「${workTitle}」（引用 ${workCited}）${workUrl ? `；${workUrl}` : ""}`;

    // 同一 author 可能在多篇论文出现，只 hydrate 一次（节省配额）
    if (!hydratedAuthorIds.has(authorId)) {
      hydratedAuthorIds.add(authorId);
      const idPath = authorId.replace(/^https?:\/\/openalex\.org\//i, "");
      const authorDetail = await openAlexJson(`authors/${idPath}`);
      if (authorDetail?.error) {
        sourceLeads.push({
          lead: author.display_name ?? authorId,
          sourceFamily: "OpenAlex 作者详情",
          whyRelevant: `论文「${workTitle}」作者`,
          blocker: `作者详情 API 失败: ${authorDetail.error}`,
          next: "可人工查询 https://openalex.org/authors/" + idPath,
        });
        continue;
      }
      upsertCandidate(authorId, authorDetail, workEvidence, isFirstOrCorr);
    } else {
      const existing = candidatesByOpenAlexId.get(authorId);
      if (existing) {
        if (!existing.evidence.includes(workEvidence)) {
          existing.evidence.push(workEvidence);
        }
        if (isFirstOrCorr) existing.firstOrCorrespondingAuthorCount += 1;
        applyAcademicScore(existing);
      }
    }
  }

  // 论文本身进来源地图（找人入口线索，不进候选人表）
  sourceLeads.push({
    lead: workTitle.slice(0, 80),
    sourceFamily: "OpenAlex 论文线索",
    url: workUrl,
    whyRelevant: `引用 ${workCited}${queryLabel ? `；命中查询「${queryLabel.slice(0, 60)}」` : ""}`,
    blocker: "论文是找人入口，作者尚未完成个人资料和可招聘性验证",
    next: "核验一作/通讯的个人主页、GitHub、LinkedIn；确认当前职业阶段",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 召回腿：profile-first（中国优先地域锚定）
// works 按 authorships.institutions.country_code:CN/HK/TW 过滤 + 方向词搜索，抽取一作/通讯。
// 补 paper-first（全球引用排序）漏掉的中国机构研究者，直接落实"中国优先"默认。
// 设计教训：OpenAlex authors?search= 搜的是作者名而非方向，x_concepts 作者过滤已被弃用（实测 count=0），
// 故走 works 端点的机构地域过滤，这是可靠且能净增中国候选的路径。
// ─────────────────────────────────────────────────────────────────────────────

function profileFirstWorksVariants(q) {
  const terms = coreQueryTerms(q);
  const focused = terms.slice(0, 4).join(" ") || cleanSearchQuery(q);
  const currentYear = new Date().getFullYear();
  const cnFilter = "authorships.institutions.country_code:cn|hk|tw";
  return [
    // 变体 a：中国机构 + 方向 + AI 子领域，按引用排序（中国高影响研究者）
    {
      search: focused,
      sort: "cited_by_count:desc",
      filter: `${cnFilter},from_publication_date:${currentYear - 3}-01-01,${OPENALEX_AI_SUBFIELD_FILTER}`,
      label: "profile-first-cn-cited",
    },
    // 变体 b：中国机构 + 方向 + 近 1 年，按时间排序（新兴中国研究者）
    {
      search: focused,
      sort: "publication_date:desc",
      filter: `${cnFilter},from_publication_date:${currentYear - 1}-01-01,${OPENALEX_AI_SUBFIELD_FILTER}`,
      label: "profile-first-cn-recent",
    },
  ];
}

async function runProfileFirstLeg() {
  for (const variant of profileFirstWorksVariants(query)) {
    if (timeBudgetExceeded()) break;
    if (hydratedAuthorIds.size >= args.maxAuthors) break;

    const result = await openAlexJson("works", {
      search: variant.search,
      sort: variant.sort,
      filter: variant.filter,
      per_page: args.worksPerQuery,
    });
    recallPaths.push(`OpenAlex works[${variant.label}]: ${variant.search}`);

    if (result?.error) {
      providerFailed = true;
      sourceLeads.push({
        lead: "OpenAlex works 搜索（中国机构）",
        sourceFamily: "OpenAlex 论文搜索",
        whyRelevant: variant.search,
        blocker: `API 失败: ${result.error}`,
        next: "检查网络或 OpenAlex 服务状态后重试；不要因此判断没有合适的人",
      });
      continue;
    }

    for (const work of result?.results ?? []) {
      if (timeBudgetExceeded()) break;
      if (hydratedAuthorIds.size >= args.maxAuthors) break;
      await processWorkAuthors(work, args.maxAuthors, variant.search);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 召回腿：seed + graph-neighbor（老板文档里的 DeepSeek/OpenAlex 挖掘法）
// 从具名标杆论文（--seed，OpenAlex work id 或标题）锚定：
//   1. 种子论文自身的一作/通讯 —— 方向由标杆论文保证，天然强证据；
//   2. 图邻居：引用该标杆的近期论文（cites:）的一作/通讯 —— 发现"在标杆之上继续做"的
//      年轻高潜研究者（正是招聘要找的活跃全职梯队），比泛关键词搜精度高得多。
// 泛关键词搜索退居补充（paper-first/profile-first），只在种子腿之后跑。
// ─────────────────────────────────────────────────────────────────────────────

/** 把 OpenAlex work id / URL / 标题 解析成一篇 work 对象（含 authorships）。 */
async function resolveSeedWork(seed) {
  const raw = String(seed || "").trim();
  if (!raw) return null;
  // 优先走"纯 GET / 纯 filter"解析（work id、DOI）：这些路径稳定；
  // 全文 search 端点在部分网络/OpenAlex 负载下会 504（老板方法刻意避开泛搜也是此因），
  // 所以标题解析放到最后、且作为 best-effort。
  // 1) work id 形态：W\d+ 或 https://openalex.org/W\d+
  const idMatch = raw.match(/\bW\d{4,}\b/i);
  if (idMatch) {
    const detail = await openAlexJson(`works/${idMatch[0].toUpperCase()}`);
    if (detail && !detail.error) return detail;
    return null;
  }
  // 2) DOI（或 doi.org URL）：GET works/https://doi.org/{doi}
  const doiMatch = raw.match(/10\.\d{4,9}\/[^\s"']+/i);
  if (doiMatch) {
    const doi = doiMatch[0].replace(/[).,;]+$/u, "");
    const detail = await openAlexJson(`works/https://doi.org/${doi}`);
    if (detail && !detail.error) return detail;
    return null;
  }
  // 3) 否则按标题搜索（best-effort，环境不稳时可能 504）
  const result = await openAlexJson("works", {
    search: cleanSearchQuery(raw),
    sort: "relevance_score:desc",
    per_page: 1,
  });
  if (result?.error) return null;
  return (result?.results ?? [])[0] ?? null;
}

async function runSeedGraphLeg(cap) {
  for (const seed of args.seeds) {
    if (timeBudgetExceeded()) break;
    if (hydratedAuthorIds.size >= cap) break;

    const seedWork = await resolveSeedWork(seed);
    if (!seedWork?.id) {
      sourceLeads.push({
        lead: `种子论文未解析：${String(seed).slice(0, 80)}`,
        sourceFamily: "OpenAlex 种子论文",
        whyRelevant: "作为具名标杆锚定研究者",
        blocker: "OpenAlex 未按 work id/标题解析到该论文",
        next: "确认 work id（W 开头）或用更精确的论文标题重试",
      });
      continue;
    }

    const seedTitle = seedWork.title ?? "(无标题种子)";
    recallPaths.push(`OpenAlex seed: ${seedTitle.slice(0, 60)}`);
    // 种子作者/图邻居的方向由标杆论文保证（provenance），Agent 据此可直接信方向；
    // 脚本不再做方向词命中判断（那是 rubric §5.2 的语义判断）。

    // 1) 种子论文自身作者（一作/通讯优先）
    await processWorkAuthors(seedWork, cap, `种子标杆：${seedTitle.slice(0, 50)}`);

    // 2) 图邻居：引用该标杆的近期论文 → 年轻高潜作者。
    // 纯 filter=cites（引用图），不用 search=——OpenAlex 的 search 全文端点不稳（Cloudflare
    // 挑战 / 服务端 query_timeout），而引用图是老板方法的稳健主路径，直连即通。
    const shortId = String(seedWork.id).replace(/^https?:\/\/openalex\.org\//i, "");

    // 2a) 中国机构引用图邻居（中国优先，先跑）：direction 由种子保证 + 中国由 country_code
    // 过滤，纯 filter。等价于"引用了该标杆、且作者在中国机构的人"，直连稳过。
    if (!timeBudgetExceeded() && hydratedAuthorIds.size < cap) {
      const citingCn = await openAlexJson("works", {
        filter: `cites:${shortId},authorships.institutions.country_code:cn|hk|tw`,
        sort: "publication_date:desc",
        per_page: args.worksPerQuery,
      });
      recallPaths.push(`OpenAlex graph-neighbor[cites:${shortId} + CN机构]`);
      if (citingCn?.error) providerFailed = true;
      for (const work of citingCn?.results ?? []) {
        if (timeBudgetExceeded() || hydratedAuthorIds.size >= cap) break;
        await processWorkAuthors(work, cap, `中国机构引用标杆「${seedTitle.slice(0, 30)}」`);
      }
    }

    // 2b) 全球引用图邻居（补充，近期优先，发现年轻高潜）
    if (!timeBudgetExceeded() && hydratedAuthorIds.size < cap) {
      const citing = await openAlexJson("works", {
        filter: `cites:${shortId},${OPENALEX_AI_SUBFIELD_FILTER}`,
        sort: "publication_date:desc",
        per_page: args.worksPerQuery,
      });
      recallPaths.push(`OpenAlex graph-neighbor[cites:${shortId}]`);
      if (citing?.error) providerFailed = true;
      for (const work of citing?.results ?? []) {
        if (timeBudgetExceeded() || hydratedAuthorIds.size >= cap) break;
        await processWorkAuthors(work, cap, `引用标杆「${seedTitle.slice(0, 40)}」`);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 执行召回（有种子 → 种子/图邻居优先给强证据；paper-first/profile-first 补池子；
// 合并进同一 candidatesByOpenAlexId）
// ─────────────────────────────────────────────────────────────────────────────

// 种子腿预算：给到全部 maxAuthors。种子/引用图/中国机构过滤是稳健主路径（纯 filter，直连稳过），
// 优先吃满配额；下面 search-based 的 paper/profile 腿只在还有余量时补充（且它们不稳，失败也不影响主结果）。
const seedCap = args.maxAuthors;
if (args.seeds.length) await runSeedGraphLeg(seedCap);
await runPaperFirstLeg(paperFirstCap);
await runProfileFirstLeg();

// ─────────────────────────────────────────────────────────────────────────────
// 分类与过滤
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 简单的 PI/资深学者检测（works_count 大 + cited 高 → 可能是 PI 或资深教授）。
 * 这类人进「推荐人/顾问/标杆」桶，不当普通全职候选。
 * 阈值：总发文 ≥100 且总引用 ≥2000 → 视为高资历，进 advisor 桶。
 */
function isLikelySeniorPI(candidate) {
  return (candidate.worksCount ?? 0) >= 100 && (candidate.citedByCount ?? 0) >= 2000;
}

// 按分数排序全部候选
const allCandidates = [...candidatesByOpenAlexId.values()]
  .filter((c) => c.evidence.length > 0)
  .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

// 资深 PI 单独分桶，不进 people/leadPeople
const seniorPIList = allCandidates.filter(isLikelySeniorPI);
const nonSeniorList = allCandidates.filter((c) => !isLikelySeniorPI(c));

// people / leadPeople 只按客观信号强度粗排切分，**不是**判级——
// 谁是真候选、谁是弱证据/综述/消歧风险/方向不符，由宿主 Agent 依 rubric §5 判断。
// 学术来源一律最高 soft（隐私硬门），绝不自报 strong；这里给的是"待判级召回候选池"。
const people = nonSeniorList.slice(0, args.targetCount);
const peopleIds = new Set(people.map((c) => c.openAlexId));

// leadPeople（其余非资深召回候选，同样待 Agent 判级）
const leadPeople = nonSeniorList
  .filter((c) => !peopleIds.has(c.openAlexId))
  .slice(0, args.targetCount * 4);

// 资深 PI 进 sourceLeads（顾问/推荐人桶）
for (const pi of seniorPIList) {
  sourceLeads.unshift({
    lead: pi.displayName,
    sourceFamily: "学术顾问/标杆池",
    url: pi.openAlexId,
    profileUrl: pi.orcid ? `https://orcid.org/${pi.orcid.replace(/^https?:\/\/orcid\.org\//i, "")}` : pi.openAlexId,
    whyRelevant: `高资历学者（发文 ${pi.worksCount}，引用 ${pi.citedByCount}）；${(pi.evidence ?? []).slice(0, 1).join("")}`,
    blocker: "PI/资深教授默认进顾问/产业标杆池，不作全职候选；需另行判断是否可合作",
    next: "可从其学生、共同作者、实验室成员中扩展年轻全职候选",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 构建 proposal JSON（对齐 small-batch-github.mjs 输出形状）
// ─────────────────────────────────────────────────────────────────────────────

function toPerson(candidate, bucket) {
  // 学术来源不证明可招聘性：所有候选最高 soft；不自报 strong bucket
  const safeBucket = bucket === "soft" ? "soft" : "lead";

  // identity 风险：OpenAlex 作者可能重名/未消歧（必须提示）
  const identityRisk = [
    "OpenAlex 作者消歧不完全（同名同字段可能混入）；需交叉核验 ORCID/主页/论文署名",
    "论文作者不等于可招聘候选；需找到个人资料并核验身份（GitHub/LinkedIn/主页）",
  ];

  return {
    source: "academic",
    displayName: candidate.displayName,
    login: null, // 学术画像无 GitHub login
    openAlexId: candidate.openAlexId,
    orcid: candidate.orcid ?? null,
    homepageUrl: candidate.homepageUrl ?? null,
    profileUrl:
      candidate.homepageUrl ??
      (candidate.orcid ? `https://orcid.org/${candidate.orcid.replace(/^https?:\/\/orcid\.org\//i, "")}` : null) ??
      candidate.openAlexId,
    institution: candidate.lastInstitution ?? "",
    institutionCountry: candidate.lastInstitutionCountry ?? "",
    institutionNames: candidate.institutionNames ?? [],
    worksCount: candidate.worksCount ?? 0,
    citedByCount: candidate.citedByCount ?? 0,
    recentWorksCount: candidate.recentWorksCount ?? 0,
    activeYears: candidate.activeYears ?? 0,
    geoStrong: !!candidate.geoStrong,
    geoEvidence: candidate.geoEvidence ?? [],
    bucket: safeBucket,
    talentPool: safeBucket,
    // roughBand 只是客观信号强度粗排，**不是**判级；判级看下面 needsAgentJudgment。
    roughBand: candidate.roughBand ?? "low",
    // 学术来源只能达到 soft（待个人资料核验），不能自报 strong
    evidenceStatus: "academic-recall-candidate-pending-agent-judgment",
    // 明确标记：这是待宿主 Agent 依 rubric §5 判级的召回候选，不是成品判级。
    needsAgentJudgment: {
      rubric: "sifta-search/references/academic-source-playbook.md §5",
      judge: ["综述是否弱证据", "方向是否契合", "是否疑似同名合并实体", "是否中国生态", "当前职业阶段/可招聘性"],
    },
    score: candidate.score ?? 0,
    signals: candidate.signals ?? [],
    firstOrCorrespondingAuthorCount: candidate.firstOrCorrespondingAuthorCount ?? 0,
    evidence: (candidate.evidence ?? []).slice(0, 5),
    conceptTags: (candidate.conceptTags ?? []).slice(0, 8),
    // 风险：只写客观/隐私硬门；语义风险（综述/消歧/方向）由 Agent 判后补。
    risk: [
      ...identityRisk,
      candidate.geoStrong
        ? `机构地域(country_code)：${(candidate.geoEvidence ?? []).join("；") || "CN/HK/TW"}`
        : "机构地域未命中 CN/HK/TW country_code；生态归属与所在地需 Agent 结合机构名判断",
      "不推断求职意愿、薪资、relocation；不查私人联系方式",
    ].join("；"),
    nextAction:
      "先依 rubric §5 判级（综述/方向/消歧/生态/职业阶段），再找个人主页/GitHub/LinkedIn 核验身份与当前阶段；学术候选最高 soft",
  };
}

// coverage 判断：只有"完全没召回到任何候选"才算 provider_failure。
// 若稳健腿（种子/引用图/中国机构过滤）已产出候选，即便补充的 search 腿失败，也只是 partial。
const coverage =
  candidatesByOpenAlexId.size === 0
    ? providerFailed
      ? "provider_failure"
      : "partial"
    : timeBudgetHit || providerFailed
      ? "partial"
      : "pilot";

const proposal = {
  query,
  executedSources: ["openalex"],
  coverage,
  providerFailed,
  timeBudgetHit,
  maxElapsedMs: args.maxElapsedMs,
  rawPoolSize: candidatesByOpenAlexId.size,
  seniorPICount: seniorPIList.length,
  recommendedCount: people.length,
  potentialCount: leadPeople.length,
  recallPaths: [...new Set(recallPaths)],
  legsCovered: [
    ...(args.seeds.length ? ["seed-graph-neighbor"] : []),
    "paper-first",
    "profile-first",
  ],
  seeds: args.seeds,
  // 注意：学术来源 bucket 最高 soft；PI 进 sourceLeads，不进 people
  // people = 推荐人选（待个人资料交叉核验，最高 soft）
  people: people.map((c) => toPerson(c, "soft")),
  // leadPeople = 待核验线索（证据不足或geo未匹配）
  leadPeople: leadPeople.map((c) => ({
    ...toPerson(c, "lead"),
    canEnterCandidateTable: false,
  })),
  // sourceLeads = 论文/PI 线索（找人来源，不进候选表）
  sourceLeads: sourceLeads.slice(0, 30),
};

// ─────────────────────────────────────────────────────────────────────────────
// 输出
// ─────────────────────────────────────────────────────────────────────────────

if (args.json) {
  process.stdout.write(`${JSON.stringify(proposal, null, 2)}\n`);
  process.exit(0);
}

// --markdown 调试 fallback
process.stdout.write(`# 学术召回调试摘要\n\n`);
process.stdout.write(`**Query:** ${query}\n`);
process.stdout.write(`**rawPoolSize:** ${proposal.rawPoolSize}  **coverage:** ${coverage}\n\n`);
process.stdout.write(`## 推荐人选（${people.length}）\n\n`);
for (const p of people) {
  process.stdout.write(
    `- **${p.displayName}** | ${p.institution} | cited:${p.citedByCount} | ${p.bucket} | rough:${p.roughBand}\n`,
  );
  for (const e of p.evidence.slice(0, 2)) {
    process.stdout.write(`  - ${e}\n`);
  }
}
process.stdout.write(`\n## 待核验线索（${leadPeople.length}）\n\n`);
for (const p of leadPeople.slice(0, 5)) {
  process.stdout.write(`- ${p.displayName} | ${p.institution} | cited:${p.citedByCount}\n`);
}
process.stdout.write(`\n## 召回路径\n\n`);
for (const r of proposal.recallPaths) {
  process.stdout.write(`- ${r}\n`);
}
