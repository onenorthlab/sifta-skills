#!/usr/bin/env node
/**
 * small-batch-hf.mjs —— HuggingFace 模型作者的程序化召回（无需 key）。
 *
 * 用途：给"大模型工程师 / 研究工程师"画像补一条干净召回渠道。链路：
 *   模型（按下载排序）→ 模型 commit 作者(真正 push 模型的人) → HF 个人资料 → 去重 + 客观粗排。
 * HF 的身份是真人自维护、零同名合并噪声，拿到的是"实际提交了某模型的工程师"这种强信号候选。
 *
 * 方向由调用方(宿主 Agent)给，脚本不内置任何固定 org 全集——固定列表会成为召回天花板，
 * 不在列表里的新公司/冷门实验室/个人永远捞不到。两种方向入口，按目标画像给一个或都给：
 *   --seed <org>   针对具名团队召回（Agent 依目标决定找哪些 org，含新创业公司/冷门实验室）
 *   --task <tag>   按 HF 标准 task 标签跨全站召回 top 模型的作者（不依赖任何 org 列表，
 *                  能捞到任意 org 在该方向的领先团队）。tag 用 HF pipeline_tag，如
 *                  text-generation / image-text-to-text / automatic-speech-recognition /
 *                  text-to-image / feature-extraction 等。
 * 至少给一个 --seed 或 --task；都不给时脚本不臆造全集，直接提示调用方按目标补方向。
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
 *   node small-batch-hf.mjs --seed Qwen --seed deepseek-ai --max-authors 20 --json
 *   node small-batch-hf.mjs --task text-generation --task image-text-to-text --json
 */
import { scoreHfContributor, isOrgOrBot, isPlatformStaff } from "./hf-recall-lib.mjs";

const HF_BASE = "https://huggingface.co/api";
const HF_TIMEOUT_MS = 15000;

function parseArgs(argv) {
  const args = {
    query: "",
    seeds: [],
    tasks: [],
    targetCount: 6,
    maxAuthors: 30,
    authorsPerSource: 5, // 每个 org/task 最多取几个候选，保证跨来源广度（头部大来源不吃满预算）
    modelsPerSource: 3,
    commitsPerModel: 20,
    maxElapsedMs: 55000,
    json: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[(i += 1)];
    if (a === "--query") args.query = next() ?? "";
    else if (a === "--seed") args.seeds.push(next());
    else if (a === "--task") args.tasks.push(next());
    else if (a === "--target-count") args.targetCount = Number(next()) || args.targetCount;
    else if (a === "--max-authors") args.maxAuthors = Number(next()) || args.maxAuthors;
    else if (a === "--authors-per-source") args.authorsPerSource = Number(next()) || args.authorsPerSource;
    else if (a === "--models-per-source") args.modelsPerSource = Number(next()) || args.modelsPerSource;
    else if (a === "--commits-per-model") args.commitsPerModel = Number(next()) || args.commitsPerModel;
    else if (a === "--max-elapsed-ms") args.maxElapsedMs = Number(next()) || args.maxElapsedMs;
    else if (a === "--json") args.json = true;
  }
  return args;
}

const args = parseArgs(process.argv);
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
    return existing;
  }
  if (isOrgOrBot(username, args.seeds)) return null;
  if (candidatesByUser.size >= args.maxAuthors || outOfTime()) return null;

  const ov = await hfJson(`users/${encodeURIComponent(username)}/overview`);
  if (ov?.__error || !ov) {
    // 资料拉取失败也保留最小候选（仍是真实提交者），身份待 Agent 核验。
    const minimal = {
      hfUsername: username, fullName: null, orgs: [], numModels: 0, numPapers: 0,
      numFollowers: 0, numUpvotes: 0, bio: null,
      profileUrl: `https://huggingface.co/${username}`, contributedModels: [model],
    };
    applyScore(minimal);
    candidatesByUser.set(username, minimal);
    return minimal;
  }
  const orgs = (ov.orgs || []).map((o) => o.name).filter(Boolean);
  if (isPlatformStaff(orgs)) return null; // HF 平台运营方，非实验室招聘目标（客观角色，非人才判断）
  const c = {
    hfUsername: username,
    fullName: ov.fullname || null,
    orgs,
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
  return c;
}

// 从一批模型里走 commit 作者 → 候选；perSource 控制单来源最多取多少人，保证跨来源广度。
async function consumeModels(models, sourceLabel) {
  const list = Array.isArray(models) ? models : [];
  recallPaths.push(`${sourceLabel}: ${list.length} 个热门模型`);
  let takenFromSource = 0;
  for (const m of list) {
    if (outOfTime() || candidatesByUser.size >= args.maxAuthors || takenFromSource >= args.authorsPerSource) break;
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
    const model = { id: m.id, downloads: m.downloads || 0, likes: m.likes || 0, source: sourceLabel };
    for (const u of authors) {
      if (outOfTime() || candidatesByUser.size >= args.maxAuthors || takenFromSource >= args.authorsPerSource) break;
      const added = await upsertUser(u, model);
      if (added) takenFromSource += 1;
    }
  }
}

async function processOrg(org) {
  if (outOfTime()) return;
  const models = await hfJson(
    `models?author=${encodeURIComponent(org)}&sort=downloads&direction=-1&limit=${args.modelsPerSource}&full=false`,
  );
  if (models?.__error) {
    providerFailed = true;
    recallPaths.push(`org ${org}: 拉取失败 ${models.__error}`);
    return;
  }
  await consumeModels(models, `org ${org}`);
}

async function processTask(tag) {
  if (outOfTime()) return;
  const models = await hfJson(
    `models?pipeline_tag=${encodeURIComponent(tag)}&sort=downloads&direction=-1&limit=${args.modelsPerSource}&full=false`,
  );
  if (models?.__error) {
    providerFailed = true;
    recallPaths.push(`task ${tag}: 拉取失败 ${models.__error}`);
    return;
  }
  await consumeModels(models, `task ${tag}`);
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
    contributedModels: topModels.map((m) => ({ id: m.id, downloads: m.downloads, source: m.source })),
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
      hfUsername: c.hfUsername, fullName: c.fullName, orgs: c.orgs,
      numModels: c.numModels, numPapers: c.numPapers, numFollowers: c.numFollowers,
      profileUrl: c.profileUrl,
    },
    // HF 单源封顶 soft：身份需跨源(GitHub/论文)交叉核验才升级。
    status: "lead",
    risk: "HF 单源证据；未跨源核验身份与贡献深度前不升级。不含私人联系方式。",
  };
}

function emitGuidance() {
  const guidance = {
    source: "huggingface",
    coverage: "no_direction",
    people: [],
    leadPeople: [],
    note:
      "未给召回方向。脚本不内置固定 org 全集（会成为召回天花板）。请按目标画像给方向：" +
      "--seed <org>（具名团队，Agent 依目标决定，含新公司/冷门实验室）和/或 " +
      "--task <hf-pipeline-tag>（跨全站按方向召回，如 text-generation / image-text-to-text / " +
      "automatic-speech-recognition）。见 SKILL.md 的 HF 召回段。",
  };
  if (args.json) process.stdout.write(`${JSON.stringify(guidance, null, 2)}\n`);
  else process.stdout.write(`\n${guidance.note}\n`);
}

async function main() {
  if (!args.seeds.length && !args.tasks.length) {
    emitGuidance();
    return;
  }
  for (const org of args.seeds) {
    if (outOfTime() || candidatesByUser.size >= args.maxAuthors) break;
    await processOrg(org);
  }
  for (const tag of args.tasks) {
    if (outOfTime() || candidatesByUser.size >= args.maxAuthors) break;
    await processTask(tag);
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
    seedsGiven: args.seeds,
    tasksGiven: args.tasks,
    coverage,
    providerFailed,
    totalCandidates: candidatesByUser.size,
    people,
    leadPeople,
    recallPaths,
    legsCovered: [...(args.seeds.length ? ["hf-org-committers"] : []), ...(args.tasks.length ? ["hf-task-committers"] : [])],
    note: "HF 模型作者召回：干净身份、零同名合并；候选最高 soft，需跨源核验。方向由调用方给，语义判级交 Agent。",
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
