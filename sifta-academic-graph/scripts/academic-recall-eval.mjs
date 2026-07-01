#!/usr/bin/env node
/**
 * academic-recall-eval.mjs —— 学术召回的自建评估（无需 Owner 提名 golden）。
 *
 * golden 由"公开常识里的标杆论文 → 其真实一作/通讯 + 方向"构造，用来可复现地量化：
 *   1. ground-truth 召回：种子标杆的真实核心作者，是否出现在召回池里（不管 OpenAlex profile 干不干净）；
 *   2. 噪声密度：people[] 里有多少是跨无关重学科的疑似同名合并实体（eval 专用启发式，仅测量用）；
 *   3. 中国占比。
 *
 * 直连 OpenAlex 跑（脚本内已设 NO_PROXY 等），无需任何 API key。
 * 用法：node academic-recall-eval.mjs        （跑全部 golden）
 *      node academic-recall-eval.mjs --json  （输出 JSON）
 *
 * 设计说明：这是"过程质量"回归工具——改召回后跑它，看 ground-truth 召回率/噪声密度有没有变好，
 * 而不是每次派 agent 人工核。它不替代宿主 Agent 的语义判级（那是产品行为），只测召回层。
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, "small-batch-academic.mjs");

// golden：公开常识（论文标题+作者是公开事实，非 Owner 提名）。work id 由 DOI/已知 id 得到。
const GOLDEN = [
  {
    name: "机器人操作 / VLA",
    seed: "W4385403811", // Diffusion Policy
    query: "diffusion policy visuomotor robot manipulation imitation learning",
    trueAuthors: ["cheng chi", "shuran song", "siyuan feng", "zhenjia xu", "eric cousineau", "benjamin burchfiel"],
  },
  {
    name: "LLM 对齐 / RLHF",
    seed: "W4226278401", // InstructGPT
    query: "reinforcement learning human feedback instruction following alignment",
    trueAuthors: ["long ouyang", "jeffrey wu", "jeff wu", "xu jiang", "ryan lowe", "jan leike", "paul christiano", "diogo almeida"],
  },
  {
    name: "世界模型 / 具身 RL",
    seed: "W4315706776", // DreamerV3
    query: "world model reinforcement learning imagination latent dynamics",
    trueAuthors: ["danijar hafner", "jimmy ba", "timothy lillicrap", "mohammad norouzi", "jurgis pasukonis"],
  },
];

// eval 专用：明显与 AI/CS/机器人无关的重学科（仅用于测量噪声密度，不进产品逻辑）。
const UNRELATED_FIELDS = [
  "medicine", "oncology", "cancer", "internal medicine", "radiology", "nursing", "veterinary",
  "biology", "gene", "genetics", "genomics", "molecular", "cell",
  "ophthalmology", "glaucoma", "dermatology", "cardiology", "surgery", "pathology",
  "geology", "planetary", "materials science", "chemistry", "chemical",
  "agriculture", "agronomy", "agricultural", "food science", "environmental",
];

function looksLikeNoise(person) {
  const tags = (person.conceptTags ?? []).join(" ").toLowerCase();
  const inst = (person.institutionNames ?? []).join(" ").toLowerCase();
  const hay = `${tags} ${inst}`;
  return UNRELATED_FIELDS.some((f) => hay.includes(f));
}

function runSeed(g) {
  const env = { ...process.env, NO_PROXY: "*", OPENALEX_MAILTO: process.env.OPENALEX_MAILTO || "sifta-eval@onenorth.dev" };
  delete env.HTTPS_PROXY;
  delete env.HTTP_PROXY;
  delete env.NODE_USE_ENV_PROXY;
  const out = execFileSync(
    "node",
    [SCRIPT, "--seed", g.seed, "--query", g.query, "--target-count", "5", "--max-authors", "24", "--max-elapsed-ms", "55000", "--json"],
    { env, encoding: "utf8", maxBuffer: 32 * 1024 * 1024, timeout: 90_000 },
  );
  return JSON.parse(out);
}

function evalSeed(g) {
  let proposal;
  try {
    proposal = runSeed(g);
  } catch (err) {
    return { name: g.name, error: String(err.message ?? err).slice(0, 200) };
  }
  const people = proposal.people ?? [];
  const pool = [...people, ...(proposal.leadPeople ?? [])];
  const poolNames = pool.map((p) => String(p.displayName ?? "").toLowerCase());

  // ground-truth 召回：真实核心作者是否出现在池里（名字子串匹配，容忍中英文/缩写）
  const foundTrue = g.trueAuthors.filter((t) =>
    poolNames.some((n) => n.includes(t) || t.split(" ").every((w) => n.includes(w))),
  );

  const noiseInPeople = people.filter(looksLikeNoise).length;
  const chinaInPeople = people.filter((p) => p.geoStrong).length;

  return {
    name: g.name,
    seed: g.seed,
    coverage: proposal.coverage,
    poolSize: pool.length,
    recommendedCount: people.length,
    groundTruthFound: foundTrue,
    groundTruthRecall: `${foundTrue.length}/${g.trueAuthors.length}`,
    noiseRateInPeople: people.length ? `${noiseInPeople}/${people.length}` : "0/0",
    chinaRateInPeople: people.length ? `${chinaInPeople}/${people.length}` : "0/0",
    peoplePreview: people.map((p) => ({
      name: p.displayName,
      inst: p.institution,
      cited: p.citedByCount,
      noise: looksLikeNoise(p),
      cn: !!p.geoStrong,
    })),
  };
}

const wantJson = process.argv.includes("--json");
const results = GOLDEN.map(evalSeed);

if (wantJson) {
  process.stdout.write(`${JSON.stringify({ results }, null, 2)}\n`);
  process.exit(0);
}

// 人类可读摘要
let gtFound = 0, gtTotal = 0, noiseNum = 0, noiseDen = 0, cnNum = 0, cnDen = 0;
process.stdout.write("\n=== 学术召回自建评估（OpenAlex 直连，golden=公开标杆论文）===\n\n");
for (const r of results) {
  if (r.error) {
    process.stdout.write(`## ${r.name}: 运行失败 — ${r.error}\n\n`);
    continue;
  }
  const [gf, gt] = r.groundTruthRecall.split("/").map(Number);
  const [nn, nd] = r.noiseRateInPeople.split("/").map(Number);
  const [cn, cd] = r.chinaRateInPeople.split("/").map(Number);
  gtFound += gf; gtTotal += gt; noiseNum += nn; noiseDen += nd; cnNum += cn; cnDen += cd;
  process.stdout.write(`## ${r.name}  (coverage=${r.coverage}, pool=${r.poolSize})\n`);
  process.stdout.write(`   ground-truth 真作者召回: ${r.groundTruthRecall}  命中=[${r.groundTruthFound.join(", ") || "无"}]\n`);
  process.stdout.write(`   people 噪声密度: ${r.noiseRateInPeople}  |  中国占比: ${r.chinaRateInPeople}\n`);
  for (const p of r.peoplePreview) {
    process.stdout.write(`     ${p.noise ? "⚠噪声" : "  ok "} ${p.cn ? "[CN]" : "[--]"} ${p.name} | ${p.inst} | cited:${p.cited}\n`);
  }
  process.stdout.write("\n");
}
process.stdout.write("=== 汇总 ===\n");
process.stdout.write(`ground-truth 真作者召回: ${gtFound}/${gtTotal}\n`);
process.stdout.write(`people 噪声密度: ${noiseNum}/${noiseDen}\n`);
process.stdout.write(`people 中国占比: ${cnNum}/${cnDen}\n`);
