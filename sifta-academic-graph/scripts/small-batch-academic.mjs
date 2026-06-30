#!/usr/bin/env node

/**
 * small-batch-academic.mjs
 * 学术图谱最小程序化召回 helper（paper-first，OpenAlex API）。
 *
 * 设计决策：跨 skill 相对 import recall-lib.mjs 在两种布局（workspace / ~/.agents/skills）下
 * 路径都不稳定（平级 skill 目录在 sync-local 后没有相对路径保证）。为保证脚本自包含可独立运行，
 * 内联最小评分逻辑（cleanSearchQuery / coreQueryTerms / scoreAcademicTwoAxis），
 * 注意：scoreCandidateTwoAxis 原函数对 GitHub 贡献数/PR 数做主轴，在学术域无意义；
 * 这里重写 scoreAcademicTwoAxis，用 cited_by_count / works_count / 近年发文 / geo 做同形评分。
 * 两轴结构与 recall-lib 保持一致（evidenceTier / evidenceRank / priority / signals / score）。
 *
 * 数据源：OpenAlex API（https://api.openalex.org，完全开放，无需 API key）。
 * 礼貌池：所有请求加 ?mailto=（env OPENALEX_MAILTO 覆盖）。
 *
 * 用法：
 *   node small-batch-academic.mjs --query "multimodal large language model alignment" --target-count 3
 *   node small-batch-academic.mjs --query "..." --target-count 5 --max-elapsed-ms 60000
 *   node small-batch-academic.mjs --query "..." --markdown  # 调试 fallback
 *
 * 输出形状对齐 small-batch-github.mjs proposal JSON：
 *   people / leadPeople / sourceLeads / coverage / recallPaths / providerFailed / executedSources
 *   每个 person：source/displayName/login/profileUrl/evidence/risk/nextAction/bucket/priority/...
 */

// ─────────────────────────────────────────────────────────────────────────────
// 评分核：import 自同目录 academic-recall-lib.mjs
// sync 用 rsync -a 整目录搬运，同目录相对路径在 workspace / ~/.agents/skills 两种布局下都稳定。
// 机制（两轴重排 + survey 降权 + 消歧门）在 lib 里，由 academic-recall-lib.test.mjs 确定性单测守护。
// ─────────────────────────────────────────────────────────────────────────────
import {
  cleanSearchQuery,
  coreQueryTerms,
  isSurveyWork,
  scoreAcademicTwoAxis,
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

// 中国/香港/台湾 country_code
const CN_COUNTRY_CODES = new Set(["CN", "HK", "TW"]);

// 机构名称中明确表达"中国生态"的词（不靠姓名推断）
const CN_INSTITUTION_PATTERNS = [
  /tsinghua|peking university|pku|fudan|sjtu|zhejiang|ustc|hkust|cuhk|nus|nanyang|ntu/i,
  /chinese academy|cas\b|baidu|alibaba|tencent|bytedance|huawei|deepseek|zhipu|moonshot|minimax|sensetime|megvii|meituan/i,
  /renmin|tongji|beihang|nankai|wuhan|xiamen|harbin institute|sun yat-sen/i,
];

function detectGeo(authorData) {
  // last_known_institutions 是最近机构（更准）
  const institutions = [
    ...(authorData.last_known_institutions ?? []),
    ...(authorData.affiliations ?? []).map((a) => a.institution).filter(Boolean),
  ];

  let geoStrong = false;
  let geoMatched = false;
  const geoEvidence = [];

  for (const inst of institutions) {
    if (!inst) continue;
    const cc = String(inst.country_code ?? "").toUpperCase();
    const name = String(inst.display_name ?? "");

    if (CN_COUNTRY_CODES.has(cc)) {
      geoStrong = true;
      geoMatched = true;
      geoEvidence.push(`机构：${name}（country_code=${cc}）`);
      break;
    }
    if (CN_INSTITUTION_PATTERNS.some((p) => p.test(name))) {
      geoMatched = true;
      geoEvidence.push(`机构名匹配中国生态：${name}`);
    }
  }

  return {
    geoStrong,
    geoMatched,
    geoEvidence: geoEvidence.slice(0, 2),
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
const coreTerms = coreQueryTerms(query);

// 计算"近期活跃"年份门槛
const recentYearThreshold = new Date().getFullYear() - args.recentYears;

/**
 * 计算派生评分字段（nonSurveyCitedByCount + 两轴评分 + 消歧风险），写回 candidate。
 * 单一入口：upsertCandidate 和已 hydrate 复用路径都调它，保证评分口径一致。
 */
function applyAcademicScore(c) {
  // survey-only（召回到的证据全是综述）→ 非综述引用归零，触发核里的 survey-only 封顶；
  // 否则保守取总引用（无法精确拆分混合发表者的 survey/非 survey 引用占比）。
  c.nonSurveyCitedByCount =
    c.nonSurveyWorksCount === 0 && c.surveyWorksCount >= 1 ? 0 : c.citedByCount;
  const scored = scoreAcademicTwoAxis(c, coreTerms);
  c.evidenceTier = scored.evidenceTier;
  c.evidenceRank = scored.evidenceRank;
  c.priority = scored.priority;
  c.signals = scored.signals;
  c.score = scored.score;
  c.disambiguationRisk = scored.disambiguationRisk;
}

/**
 * 从 OpenAlex author 详情构建/合并候选人记录。
 * 合并策略：同一 OpenAlex author id 只 hydrate 一次，多论文累加 firstOrCorrespondingAuthorCount。
 * isSurvey: true=该证据论文是综述 / false=非综述 / null=非论文来源(profile-first，不计 survey)。
 */
function upsertCandidate(authorId, authorDetail, workEvidence, isFirstOrCorr, isSurvey = null) {
  const existing = candidatesByOpenAlexId.get(authorId);

  const countsRaw = authorDetail.counts_by_year ?? [];
  const recentWorksCount = countsRaw
    .filter((y) => (y.year ?? 0) >= recentYearThreshold)
    .reduce((sum, y) => sum + (y.works_count ?? 0), 0);
  // 活跃年份跨度（供消歧门"年均发文异常高 → 疑似多人合并"判断）
  const activeYearList = countsRaw
    .filter((y) => (y.works_count ?? 0) > 0)
    .map((y) => y.year ?? 0)
    .filter((y) => y > 0);
  const activeYears = activeYearList.length
    ? Math.max(...activeYearList) - Math.min(...activeYearList) + 1
    : 0;

  // 概念/主题标签（用于方向匹配评分 + 消歧门跨学科判断）
  const conceptTags = [
    ...(authorDetail.x_concepts ?? []).slice(0, 8).map((c) => c.display_name),
    ...(authorDetail.topics ?? []).slice(0, 5).map((t) => t.display_name),
  ];

  const geo = detectGeo(authorDetail);
  const lastInst = (authorDetail.last_known_institutions ?? [])[0];

  const base = existing ?? {
    openAlexId: authorId,
    displayName: authorDetail.display_name ?? "",
    orcid: authorDetail.orcid ?? null,
    homepageUrl: authorDetail.homepage_url ?? null,
    worksCount: authorDetail.works_count ?? 0,
    citedByCount: authorDetail.cited_by_count ?? 0,
    nonSurveyCitedByCount: authorDetail.cited_by_count ?? 0,
    recentWorksCount,
    activeYears,
    lastInstitution: lastInst?.display_name ?? "",
    lastInstitutionCountry: lastInst?.country_code ?? "",
    geoStrong: geo.geoStrong,
    geoMatched: geo.geoMatched,
    geoEvidence: geo.geoEvidence,
    conceptTags,
    evidence: [],
    surveyWorksCount: 0,
    nonSurveyWorksCount: 0,
    firstOrCorrespondingAuthorCount: 0,
    disambiguationRisk: [],
    sourcedFromWorks: [],
  };

  // 累加（survey 计数与 evidence 去重绑定：同一篇论文只计一次）
  base.firstOrCorrespondingAuthorCount += isFirstOrCorr ? 1 : 0;
  if (workEvidence && !base.evidence.includes(workEvidence)) {
    base.evidence.push(workEvidence);
    if (isSurvey === true) base.surveyWorksCount += 1;
    else if (isSurvey === false) base.nonSurveyWorksCount += 1;
  }
  // 以最新 hydrate 的 geo 为准（同一作者多篇论文机构可能不同）
  if (!base.geoStrong && geo.geoStrong) {
    base.geoStrong = true;
    base.geoMatched = true;
    base.geoEvidence = geo.geoEvidence;
  }
  if (!base.geoMatched && geo.geoMatched) {
    base.geoMatched = true;
    base.geoEvidence = geo.geoEvidence;
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
// paper-first 和 profile-first 两腿都用它，保证作者抽取/去重/survey 计数口径一致。
// cap：本腿的 hydrate 预算（paper-first 传 paperFirstCap，profile-first 传 maxAuthors）。
async function processWorkAuthors(work, cap, queryLabel) {
  const workTitle = work.title ?? "(无标题)";
  const workUrl = work.doi
    ? `https://doi.org/${work.doi.replace(/^https?:\/\/doi\.org\//i, "")}`
    : work.id ?? "";
  const workCited = work.cited_by_count ?? 0;
  const isSurvey = isSurveyWork(workTitle);

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
      upsertCandidate(authorId, authorDetail, workEvidence, isFirstOrCorr, isSurvey);
    } else {
      const existing = candidatesByOpenAlexId.get(authorId);
      if (existing) {
        if (!existing.evidence.includes(workEvidence)) {
          existing.evidence.push(workEvidence);
          if (isSurvey) existing.surveyWorksCount += 1;
          else existing.nonSurveyWorksCount += 1;
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
// 执行召回（paper-first 给强证据，profile-first 补池子；合并进同一 candidatesByOpenAlexId）
// ─────────────────────────────────────────────────────────────────────────────

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

// people（推荐人选，最多 targetCount）：学术来源最高 soft，绝不自报 strong。
// weak evidenceTier 不进推荐：弱证据档最高只能是 lead（待核验线索），不冒充候选。
const people = nonSeniorList
  .filter((c) => c.evidenceTier !== "weak")
  // 消歧风险实体（疑似 OpenAlex 同名合并）不进推荐人选，自动降级到 leadPeople 待核验，
  // 避免"跨学科噪声实体"凭高引浮到推荐第一名冒充候选。
  .filter((c) => (c.disambiguationRisk?.length ?? 0) === 0)
  .slice(0, args.targetCount);
const peopleIds = new Set(people.map((c) => c.openAlexId));

// leadPeople（待核验线索，剩余非资深候选）
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
    worksCount: candidate.worksCount ?? 0,
    citedByCount: candidate.citedByCount ?? 0,
    recentWorksCount: candidate.recentWorksCount ?? 0,
    geoEvidence: candidate.geoEvidence ?? [],
    priority: candidate.priority ?? (safeBucket === "soft" ? "B" : "C"),
    bucket: safeBucket,
    talentPool: safeBucket,
    evidenceTier: candidate.evidenceTier ?? null,
    // 学术来源只能达到 soft（待个人资料核验），不能自报 strong
    evidenceStatus: "academic-paper-lead-pending-identity-verify",
    score: candidate.score ?? 0,
    signals: candidate.signals ?? [],
    firstOrCorrespondingAuthorCount: candidate.firstOrCorrespondingAuthorCount ?? 0,
    evidence: (candidate.evidence ?? []).slice(0, 5),
    conceptTags: (candidate.conceptTags ?? []).slice(0, 5),
    // 风险：必须清晰写出
    risk: [
      ...identityRisk,
      ...(candidate.disambiguationRisk?.length
        ? [`消歧风险：${candidate.disambiguationRisk.join("；")}（已降级，需先确认是否同名合并）`]
        : []),
      candidate.geoStrong
        ? `机构地域：${(candidate.geoEvidence ?? []).join("；")}`
        : "机构地域未确认 CN/HK/TW；需核验当前所在地和求职市场",
      "不推断求职意愿、薪资、relocation；不查私人联系方式",
    ].join("；"),
    nextAction:
      safeBucket === "soft"
        ? "1) 找到个人主页/GitHub/LinkedIn 核验身份；2) 确认当前职业阶段（学生/博后/工业界）；3) 再决定是否草拟低压触达"
        : "先交叉核验 ORCID/主页/论文署名，确认不是同名误消歧；达到候选门槛后再升级",
  };
}

// coverage 判断
const coverage =
  timeBudgetHit
    ? "partial"
    : providerFailed
      ? "provider_failure"
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
  legsCovered: ["paper-first", "profile-first"],
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
    `- **${p.displayName}** | ${p.institution} | cited:${p.citedByCount} | ${p.bucket} | ${p.priority}\n`,
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
