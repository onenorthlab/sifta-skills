#!/usr/bin/env node

// 跨源融合 CLI：把多个 source proposal JSON（GitHub / 学术 / …）合并成一个统一 shortlist。
// 用法：
//   node merge-proposals.mjs path/to/github.json path/to/academic.json [...]
// 输出：统一 proposal JSON，people 已按公开互链保守去重合并，crossSourceConfirmed 标记跨源确认者。
//
// 机制在 identity-merge-lib.mjs（纯函数 + 确定性单测）；本文件只做读文件 / 拼装 / 排序 / 输出。
// 跨源确认是身份可信度增强，不是可招聘性结论；学术参与的合并 bucket 仍不自动升 strong。

import { readFileSync } from "node:fs";
import { mergePeopleAcrossSources } from "./identity-merge-lib.mjs";

const files = process.argv.slice(2).filter((a) => !a.startsWith("--"));
if (!files.length) {
  process.stderr.write(
    "用法: node merge-proposals.mjs <proposal1.json> <proposal2.json> [...]\n",
  );
  process.exit(2);
}

function sourceOf(proposal, file) {
  const src = proposal?.executedSources?.[0];
  if (src) return src;
  if (/academic|openalex/i.test(file)) return "academic";
  if (/github/i.test(file)) return "github";
  if (/linkedin|product|gtm/i.test(file)) return "linkedin";
  return "unknown";
}

const lists = [];
const warnings = [];
for (const file of files) {
  try {
    const proposal = JSON.parse(readFileSync(file, "utf8"));
    const source = sourceOf(proposal, file);
    // 合并 people（推荐）+ leadPeople（待核验线索）：跨源确认也可能把一条 lead 抬成更可信。
    const people = [
      ...(proposal.people ?? []),
      ...(proposal.leadPeople ?? []),
    ];
    lists.push({ source, people });
  } catch (err) {
    warnings.push(`读取/解析失败 ${file}: ${String(err.message ?? err)}`);
  }
}

const { merged, crossSourceCount } = mergePeopleAcrossSources(lists);

// 排序：跨源确认优先 → 原 score 降序。跨源确认是身份增强，排序提示，不改 bucket。
merged.sort((a, b) => {
  const c = (b.crossSourceConfirmed ? 1 : 0) - (a.crossSourceConfirmed ? 1 : 0);
  if (c !== 0) return c;
  return (b.score ?? 0) - (a.score ?? 0);
});

const out = {
  mergedFrom: lists.map((l) => l.source),
  totalInput: lists.reduce((n, l) => n + l.people.length, 0),
  mergedCount: merged.length,
  crossSourceConfirmedCount: crossSourceCount,
  warnings,
  // 跨源确认者单独列出，方便宿主 agent 优先核验这批"超级个体"。
  crossSourceConfirmed: merged.filter((m) => m.crossSourceConfirmed),
  people: merged,
};

process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
