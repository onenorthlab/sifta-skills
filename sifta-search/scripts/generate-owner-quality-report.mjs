#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const inputPath = process.argv[2];
const outArgIndex = process.argv.indexOf("--out");
const outPath = outArgIndex >= 0 ? process.argv[outArgIndex + 1] : null;

if (!inputPath || !outPath) {
  console.error(
    "Usage: node generate-owner-quality-report.mjs <owner-quality-review.json> --out <candidate-quality-review-report.md>",
  );
  process.exit(2);
}

const review = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const requiredDimensions = ["relevance", "evidenceStrength", "sourceReliability", "weaknessHonesty"];
const samples = Array.isArray(review.samples) ? review.samples : [];
const failures = [];

if (samples.length < 6) failures.push(`Need at least 6 samples, found ${samples.length}.`);

for (const sample of samples) {
  if (!sample.id) failures.push("Sample missing id.");
  if (!sample.outputPath) failures.push(`${sample.id ?? "unknown"} missing outputPath.`);
  if (!sample.category) failures.push(`${sample.id ?? "unknown"} missing category.`);
  if (!sample.ownerDecision) failures.push(`${sample.id ?? "unknown"} missing ownerDecision.`);
  for (const dimension of requiredDimensions) {
    const rating = sample.ratings?.[dimension];
    if (!["pass", "fail", "not_applicable"].includes(rating)) {
      failures.push(`${sample.id ?? "unknown"} missing rating ${dimension}.`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

function countDecision(decision) {
  return samples.filter((sample) => sample.ownerDecision === decision).length;
}

function escapeCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

const dimensionLabels = {
  relevance: "相关性",
  evidenceStrength: "证据强度",
  sourceReliability: "来源可靠性",
  weaknessHonesty: "缺口诚实度",
};
const valueLabels = {
  pass: "通过",
  fail: "不通过",
  not_applicable: "不适用",
  needs_review: "需要复核",
};
const categoryLabels = {
  "engineering-github-small-batch": "工程 / GitHub 小批量",
  "product-gtm-linkedin-small-batch": "Product/GTM / LinkedIn 小批量",
  "academic-source-map-plan-first": "Academic source map / plan-first",
  "known-github-candidate-dossier": "已知 GitHub 候选人 dossier",
  "outreach-draft-from-verified-evidence": "基于已核验证据的触达草稿",
  "privacy-and-autosend-boundary": "隐私与自动发送边界",
};

const dimensionSummary = requiredDimensions.map((dimension) => ({
  dimension,
  pass: samples.filter((sample) => sample.ratings[dimension] === "pass").length,
  fail: samples.filter((sample) => sample.ratings[dimension] === "fail").length,
  notApplicable: samples.filter((sample) => sample.ratings[dimension] === "not_applicable").length,
}));

const lines = [
  "# 候选质量 Owner 评审",
  "",
  "## 1. 目标和边界",
  "",
  "本报告只评估真实 sourcing 输出的候选质量口径，不替代 execution budget 或 routing benchmark。",
  "结构化输出通过不等于候选人 relevance 通过；预算通过不等于候选人可以直接触达。",
  "",
  "## 2. 汇总",
  "",
  "| 项目 | 数量 |",
  "| --- | ---: |",
  `| 样本数 | ${samples.length} |`,
  `| Owner 通过 | ${countDecision("pass")} |`,
  `| Owner 不通过 | ${countDecision("fail")} |`,
  `| 需要复核 | ${countDecision("needs_review")} |`,
  "",
  "## 3. 维度汇总",
  "",
  "| 维度 | 通过 | 不通过 | 不适用 |",
  "| --- | ---: | ---: | ---: |",
  ...dimensionSummary.map(
    (row) => `| ${dimensionLabels[row.dimension] ?? row.dimension} | ${row.pass} | ${row.fail} | ${row.notApplicable} |`,
  ),
  "",
  "## 4. 样本明细",
  "",
  "| 样本 | 类型 | 相关性 | 证据强度 | 来源可靠性 | 缺口诚实度 | Owner 结论 | 备注 |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
  ...samples.map((sample) =>
    [
      `| ${escapeCell(sample.id)}`,
      escapeCell(categoryLabels[sample.category] ?? sample.category),
      escapeCell(valueLabels[sample.ratings.relevance] ?? sample.ratings.relevance),
      escapeCell(valueLabels[sample.ratings.evidenceStrength] ?? sample.ratings.evidenceStrength),
      escapeCell(valueLabels[sample.ratings.sourceReliability] ?? sample.ratings.sourceReliability),
      escapeCell(valueLabels[sample.ratings.weaknessHonesty] ?? sample.ratings.weaknessHonesty),
      escapeCell(valueLabels[sample.ownerDecision] ?? sample.ownerDecision),
      `${escapeCell(sample.notes)} |`,
    ].join(" | "),
  ),
  "",
  "## 5. 证据路径",
  "",
  ...samples.map((sample) => `- ${sample.id}: ${sample.outputPath}`),
  "",
  "## 6. 剩余风险",
  "",
  ...(Array.isArray(review.residualRisks) && review.residualRisks.length
    ? review.residualRisks.map((risk) => `- ${risk}`)
    : ["- No residual risks recorded."]),
  "",
];

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${lines.join("\n")}\n`);
fs.writeFileSync(
  path.join(path.dirname(outPath), "candidate-quality-review-summary.json"),
  JSON.stringify(
    {
      generated_at: new Date().toISOString(),
      sample_count: samples.length,
      owner_pass: countDecision("pass"),
      owner_fail: countDecision("fail"),
      needs_review: countDecision("needs_review"),
      dimensionSummary,
    },
    null,
    2,
  ),
);

console.log(`Wrote ${outPath}`);
