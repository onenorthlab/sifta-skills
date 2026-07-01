#!/usr/bin/env node
/**
 * small-batch-hf.mjs —— HuggingFace 模型作者的程序化召回（无需 key）。
 *
 * 用途：给"大模型工程师 / 研究工程师"画像补一条干净召回渠道。链路：
 *   中国 AI 组织种子 → 该组织按下载排序的热门模型 → 模型 commit 作者(真正 push 模型的人)
 *   → HF 个人资料(真名/组织/论文数/关注数/简介) → 去重 + 客观粗排 → proposal。
 *
 * 为什么用它：HF 的身份是真人自己维护、零同名合并噪声（对比 OpenAlex author 把 Cheng Chi
 * 合并进地质）。拿到的是"实际提交了 Qwen/DeepSeek 模型的工程师"这种强信号候选。
 *
 * 分工（与 academic/github 同构的铁律）：脚本只做确定性召回 + 客观量级粗排；
 * "是不是核心工程师 vs 一次性 contributor、方向对不对、是否中国生态、可招性"是语义判断，
 * 全部交宿主 Agent 依 rubric 判。输出每个候选带 needsAgentJudgment 明列待判项。
 *
 * 网络：默认直连 huggingface.co 即可。少数网络环境下直连会被重置(连接失败/候选为 0)，
 *   此时用运行者自己的代理跑（脚本走环境变量、不写死地址）：
 *   NODE_USE_ENV_PROXY=1 HTTPS_PROXY=<你的代理地址> node small-batch-hf.mjs ...
 *
 * 隐私硬门：只取公开职业字段(真名/组织/论文数/关注数/公开简介/HF 主页 URL)；
 * 不查私人邮箱/电话，不推断求职意愿/可招性(hireability 交 Agent 判)。
 *
 * 用法：
 *   node small-batch-hf.mjs --query "llm inference engineer" --target-count 6
 *   node small-batch-hf.mjs --seed Qwen --seed deepseek-ai --max-authors 30 --json
 */
import { scoreHfContributor, isOrgOrBot } from "./hf-recall-lib.mjs";

// 非穷尽的中国 AI 组织召回种子（"去哪找"的入口，Owner 可用 --seed 覆盖/补充，不是判断表）。
const DEFAULT_ORG_SEEDS = [
  "Qwen", "deepseek-ai", "THUDM", "internlm", "01-ai", "baichuan-inc",
  "OpenBMB", "BAAI", "m-a-p", "Skywork", "MiniMaxAI", "opencompass",
  "IDEA-CCNL", "Shanghai-AI-Laboratory",
];

const HF_BASE = "https://huggingface.co/api";
const HF_TIMEOUT_MS = 15000;

function parseArgs(argv) {
  const args = {
    query: "",
    seeds: [],
    targetCount: 6,
    maxAuthors: 30,
    modelsPerOrg: 3,
    commitsPerModel: 20,
    maxElapsedMs: 55000,
    json: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[(i += 1)];
    if (a === "--query") args.query = next() ?? "";
    else if (a === "--seed") args.seeds.push(next());
    else if (a === "--target-count") args.targetCount = Number(next()) || args.targetCount;
    else if (a === "--max-authors") args.maxAuthors = Number(next()) || args.maxAuthors;
    else if (a === "--models-per-org") args.modelsPerOrg = Number(next()) || args.modelsPerOrg;
    else if (a === "--commits-per-model") args.commitsPerModel = Number(next()) || args.commitsPerModel;
    else if (a === "--max-elapsed-ms") args.maxElapsedMs = Number(next()) || args.maxElapsedMs;
    else if (a === "--json") args.json = true;
  }
  return args;
}

const args = parseArgs(process.argv);
const orgSeeds = args.seeds.length ? args.seeds : DEFAULT_ORG_SEEDS;
const startedAt = Date.now();
const timeLeft = () => args.maxElapsedMs - (Date.now() - startedAt);
const outOfTime = () => timeLeft() <= 2000;

let providerFailed = false;
const recallPaths = [];

async function hfJson(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(HF_TIMEOUT_MS, Math.max(3000, timeLeft())));
  try {
    const resp = await fetch(`${HF_BASE}/${path}`, {
      headers: { "user-agent": "sifta-hf-small-batch/0.1", accept: "application/json" },
      signal: controller.signal,
    });
    const body = await resp.text();
    if (!resp.ok) return { __error: `HF ${resp.status}: ${body.slice(0, 160)}` };
    return body ? JSON.parse(body) : null;
  } catch (err) {
    return { __error: String(err?.message ?? err) };
  } finally {
    clearTimeout(timer);
  }
}

// username -> candidate
const candidatesByUser = new Map();

function applyScore(c) {
  const s = scoreHfContributor(c);
  c.score = s.score;
  c.roughStrength = s.roughStrength;
  c.roughBand = s.roughBand;
  c.signals = s.signals;
}

async function upsertUser(username, model) {
  const existing = candidatesByUser.get(username);
  if (existing) {
    if (!existing.contributedModels.some((m) => m.id === model.id)) existing.contributedModels.push(model);
    applyScore(existing);
    return;
  }
  if (isOrgOrBot(username, orgSeeds)) return;
  if (candidatesByUser.size >= args.maxAuthors || outOfTime()) return;

  const ov = await hfJson(`users/${encodeURIComponent(username)}/overview`);
  if (ov?.__error || !ov) {
    // 资料拉取失败也保留最小候选（仍是真实提交者），身份待 Agent 核验。
    const minimal = {
      hfUsername: username,
      fullName: null,
      orgs: [],
      numModels: 0,
      numPapers: 0,
      numFollowers: 0,
      numUpvotes: 0,
      bio: null,
      profileUrl: `https://huggingface.co/${username}`,
      contributedModels: [model],
    };
    applyScore(minimal);
    candidatesByUser.set(username, minimal);
    return;
  }
  const c = {
    hfUsername: username,
    fullName: ov.fullname || null,
    orgs: (ov.orgs || []).map((o) => o.name).filter(Boolean),
    numModels: ov.numModels || 0,
    numPapers: ov.numPapers || 0,
    numFollowers: ov.numFollowers || 0,
    numUpvotes: ov.numUpvotes || 0,
    bio: ov.details || null,
    profileUrl: `https://huggingface.co/${username}`,
    contributedModels: [model],
  };
  applyScore(c);
  candidatesByUser.set(username, c);
}

async function processOrg(org) {
  if (outOfTime()) return;
  const models = await hfJson(
    `models?author=${encodeURIComponent(org)}&sort=downloads&direction=-1&limit=${args.modelsPerOrg}&full=false`,
  );
  if (models?.__error) {
    providerFailed = true;
    recallPaths.push(`HF org ${org}: 拉取失败 ${models.__error}`);
    return;
  }
  const list = Array.isArray(models) ? models : [];
  recallPaths.push(`HF org ${org}: ${list.length} 个热门模型`);
  for (const m of list) {
    if (outOfTime() || candidatesByUser.size >= args.maxAuthors) break;
    // m.id 形如 owner/model，斜杠不能 url-encode（HF 会 400），其余保持原样。
    const commits = await hfJson(`models/${m.id}/commits/main`);
    if (commits?.__error) {
      recallPaths.push(`  ${m.id}: commit 拉取失败 ${commits.__error}`);
      continue;
    }
    const authors = new Set();
    for (const commit of (Array.isArray(commits) ? commits : []).slice(0, args.commitsPerModel)) {
      for (const a of commit.authors || []) if (a.user) authors.add(a.user);
    }
    const model = { id: m.id, downloads: m.downloads || 0, likes: m.likes || 0, org };
    for (const u of authors) {
      if (outOfTime() || candidatesByUser.size >= args.maxAuthors) break;
      await upsertUser(u, model);
    }
  }
}

function toPerson(c) {
  const topModels = [...c.contributedModels].sort((a, b) => b.downloads - a.downloads).slice(0, 5);
  return {
    displayName: c.fullName || c.hfUsername,
    hfUsername: c.hfUsername,
    profileUrl: c.profileUrl,
    orgs: c.orgs,
    numPapers: c.numPapers,
    numFollowers: c.numFollowers,
    bio: c.bio,
    contributedModels: topModels.map((m) => ({ id: m.id, downloads: m.downloads, org: m.org })),
    // 非权威机械粗排——只按客观量级，别当最终档位。
    roughBand: c.roughBand,
    signals: c.signals,
    // Agent 必须判的语义项（脚本不判）：
    needsAgentJudgment: [
      "核心工程师 vs 一次性 contributor（看贡献深度/是否 maintainer）",
      "方向契合（模型/组织方向 vs 目标岗位）",
      "是否中国生态（组织/简介/真名判断，不靠脚本硬编码）",
      "可招性/求职意愿（脚本不推断，需公开职业信号核验）",
      c.fullName ? "身份已有真名，仍需交叉 GitHub/主页核验" : "仅 HF 用户名，需交叉 GitHub/主页补全身份",
    ],
    rawFields: {
      hfUsername: c.hfUsername,
      fullName: c.fullName,
      orgs: c.orgs,
      numModels: c.numModels,
      numPapers: c.numPapers,
      numFollowers: c.numFollowers,
      profileUrl: c.profileUrl,
    },
    // HF 单源封顶 soft：身份需跨源(GitHub/论文)交叉核验才升级。
    status: "lead",
    risk: "HF 单源证据；未跨源核验身份与贡献深度前不升级。不含私人联系方式。",
  };
}

async function main() {
  for (const org of orgSeeds) {
    if (outOfTime() || candidatesByUser.size >= args.maxAuthors) break;
    await processOrg(org);
  }

  const all = [...candidatesByUser.values()].sort((a, b) => b.score - a.score);
  const people = all.filter((c) => c.roughStrength >= 2).slice(0, Math.max(args.targetCount, 6)).map(toPerson);
  const leadPeople = all.filter((c) => c.roughStrength < 2).slice(0, 10).map(toPerson);

  let coverage = "pilot";
  if (candidatesByUser.size === 0) coverage = providerFailed ? "provider_failure" : "empty";
  else if (providerFailed) coverage = "partial";

  const proposal = {
    source: "huggingface",
    query: args.query,
    orgSeeds,
    coverage,
    providerFailed,
    totalCandidates: candidatesByUser.size,
    people,
    leadPeople,
    recallPaths,
    legsCovered: ["hf-org-model-committers"],
    note: "HF 模型作者召回：干净身份、零同名合并；候选最高 soft，需跨源核验。语义判级交 Agent。",
  };

  if (args.json) {
    process.stdout.write(`${JSON.stringify(proposal, null, 2)}\n`);
    return;
  }
  process.stdout.write(`\n=== HuggingFace 模型作者召回 (coverage=${coverage}, 候选=${candidatesByUser.size}) ===\n\n`);
  for (const p of people) {
    process.stdout.write(
      `[${p.roughBand}] ${p.displayName} (@${p.hfUsername}) | orgs:${p.orgs.join(",") || "-"} | papers:${p.numPapers} followers:${p.numFollowers}\n` +
        `   模型:${p.contributedModels.map((m) => `${m.id}(${m.downloads})`).join(", ")}\n` +
        `   ${p.profileUrl}  信号:${p.signals.join(",")}\n\n`,
    );
  }
  process.stdout.write("召回路径:\n" + recallPaths.map((r) => `  ${r}`).join("\n") + "\n");
}

main().catch((err) => {
  process.stderr.write(`fatal: ${String(err?.message ?? err)}\n`);
  process.exit(1);
});
