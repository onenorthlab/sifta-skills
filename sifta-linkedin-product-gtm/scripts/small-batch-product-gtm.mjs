#!/usr/bin/env node

import { execFileSync } from "node:child_process";

function parseArgs(argv) {
  const args = {
    query: "",
    checkpoint: "",
    targetCount: 3,
    skipStatus: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--query" && next) args.query = next;
    if (arg === "--checkpoint" && next) args.checkpoint = next;
    if (arg === "--target-count" && next) args.targetCount = Number(next);
    if (arg === "--skip-status") args.skipStatus = true;
    if (arg.startsWith("--") && arg !== "--skip-status") index += 1;
  }
  return args;
}

function runJson(args, timeout = 60_000) {
  const stdout = execFileSync("sifta-cli", args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    timeout,
  });
  return JSON.parse(stdout);
}

function mdEscape(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function truncate(value, maxLength = 220) {
  const text = mdEscape(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function evidenceText(person) {
  const packet = person.projectFit?.evidencePacket ?? person.raw?.evidencePacket ?? {};
  const career = Array.isArray(packet.career) ? packet.career : [];
  const rawEvidence = Array.isArray(person.raw?.evidence) ? person.raw.evidence : [];
  return truncate([...career, ...rawEvidence].filter(Boolean).slice(0, 2).join(" / "));
}

function outputBlocked(reason, nextAction) {
  process.stdout.write(
    [
      "# Product/GTM Small-Batch Sourcing",
      "",
      "Execution Contract",
      "",
      "- STOP_AFTER_HELPER=true",
      "- HARD_STOP_AFTER_HELPER=true",
      "- NO_FALLBACK_WEB=true",
      "- CLI find-people completed: no.",
      "- Do not run web search, exa, browser lookup, company validation, or another `sifta-cli find-people` in this turn.",
      "- Final answer must report this helper failure and next action only; do not fabricate or replace candidates from another source.",
      "",
      "Stop Condition",
      "",
      "- Helper output is final for this turn; do not continue searching without later user approval.",
      "",
      "Coverage Warnings",
      "",
      `- ${reason}`,
      "",
      "Next Action",
      "",
      `- ${nextAction}`,
      "",
    ].join("\n"),
  );
}

const args = parseArgs(process.argv.slice(2));
const rawQuery =
  args.query ||
  "AI product GTM growth commercialization DevRel product leader enterprise AI application";
const query = `${rawQuery}；候选人摘要、证据、风险和下一步必须使用中文输出。`;
const checkpoint = args.checkpoint || query;

try {
  if (!args.skipStatus) {
    const status = runJson(["status"], 20_000);
    if (!status.authenticated || !status.api_reachable) {
      outputBlocked(
        "Sifta CLI status is not authenticated or API is not reachable.",
        "Run `sifta-cli auth <user-api-key> --base-url <api-url>` and retry this helper.",
      );
      process.exit(0);
    }
  }

  const result = runJson(
    [
      "find-people",
      "--query",
      query,
      "--checkpoint",
      checkpoint,
      "--sources",
      '["linkedin"]',
      "--target-count",
      String(args.targetCount),
    ],
    70_000,
  );

  const people = Array.isArray(result.people) ? result.people.slice(0, args.targetCount) : [];
  const warnings = Array.isArray(result.warnings) ? result.warnings : [];
  const sourceMap = Array.isArray(result.sourceMap) ? result.sourceMap : [];

  const lines = [
    "# Product/GTM Small-Batch Sourcing",
    "",
    "Execution Contract",
    "",
    "- STOP_AFTER_HELPER=true",
    "- HARD_STOP_AFTER_HELPER=true",
    "- NO_FALLBACK_WEB=true",
    "- Same-turn fan-out allowed: no.",
    "- CLI calls executed: 1 status + 1 find-people.",
    "- Do not run another `sifta-cli find-people`, web search, exa, company validation, browser lookup, or LinkedIn scraping in this turn.",
    "- Final answer must preserve exact headings: `Stop Condition` and `Coverage Warnings`.",
    "- Treat this output as recall scaffolding; candidate quality still needs Owner review.",
    "",
    "Project Card",
    "",
    `- Capability Brief: ${mdEscape(query)}`,
    `- Checkpoint: ${mdEscape(checkpoint)}`,
    `- Target Count: ${args.targetCount}`,
    "- Source: linkedin",
    "",
    "Candidate Buckets",
    "",
    "| Bucket | Lead | Function evidence | Source | Confidence | Weakness | Next action |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const person of people) {
    const fit = person.projectFit ?? {};
    const priority = fit.priority ?? "B";
    const evidenceStatus = fit.evidenceStatus ?? "待补证据";
    const roleFit = Array.isArray(fit.roleFit) ? fit.roleFit.join(", ") : fit.roleFit ?? "";
    lines.push(
      `| 待核验候选 | ${mdEscape(person.displayName)} | ${truncate(roleFit || person.headline, 120)}; ${evidenceText(person)} | ${mdEscape(person.profileUrl)} | priority=${mdEscape(priority)}, identity=${mdEscape(fit.identityConfidence ?? "unknown")} | ${truncate(`${evidenceStatus}; ${fit.whyNot ?? "Needs cross-source review"}`, 160)} | later user-approved pass: ${truncate(fit.nextAction ?? "人工复核职业 profile 和第二来源证据", 120)} |`,
    );
  }

  if (people.length === 0) {
    lines.push(
      "| Lead Queue | No usable people returned | Connector returned no people within one-pass budget | Sifta CLI | low | recall failed | revise query or ask user for a narrower brief |",
    );
  }

  lines.push(
    "",
    "Source Map",
    "",
    "| lead | sourceFamily | whyRelevant | conversionBlocker | nextVerification |",
    "| --- | --- | --- | --- | --- |",
  );

  if (sourceMap.length) {
    for (const lead of sourceMap.slice(0, 5)) {
      lines.push(
        `| ${mdEscape(lead.lead ?? lead.name ?? lead.title ?? "source lead")} | LinkedIn/company lead | ${mdEscape(lead.whyRelevant ?? lead.reason ?? "Matches Product/GTM capability brief")} | ${mdEscape(lead.conversionBlocker ?? "Needs career profile and evidence review")} | later user-approved pass: ${mdEscape(lead.nextVerification ?? "Open public career profile and verify role evidence")} |`,
      );
    }
  } else {
    lines.push(
      "| LinkedIn one-pass connector | career-profile source | Product/GTM candidates require public career profile evidence | second-source evidence missing | verify profile, company role, public product/GTM ownership |",
    );
  }

  lines.push(
    "",
    "Fit Proof Packet",
    "",
    "| Candidate/Lead | Requirement | Evidence | Source | Confidence | Weakness | Next action |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  );

  for (const person of people) {
    const fit = person.projectFit ?? {};
    lines.push(
      `| ${mdEscape(person.displayName)} | Product/GTM ownership for AI or frontier-tech business | ${evidenceText(person) || truncate(person.headline, 160)} | ${mdEscape(person.profileUrl)} | ${mdEscape(fit.priority ?? "B")} | ${truncate(fit.whyNot ?? fit.evidenceStatus ?? "Needs Owner relevance review", 160)} | later user-approved pass: ${truncate(fit.nextAction ?? "人工复核公开职业证据", 120)} |`,
    );
  }

  lines.push(
    "",
    "Stop Condition",
    "",
    "- Helper output is final for this turn; do not continue searching without later user approval.",
    "",
    "Coverage Warnings",
    "",
  );
  if (warnings.length) {
    for (const warning of warnings) lines.push(`- ${mdEscape(warning)}`);
  }
  lines.push(
    "- Do not infer availability, salary, visa, relocation, private contact, or willingness to talk.",
    "- This helper intentionally stops after one connector pass; weak or single-source people remain `待核验候选`.",
    "- Structural Fit Proof Packet is not an Owner relevance approval.",
    "- Next actions are later user-approved actions, not permission to continue searching in this turn.",
  );

  process.stdout.write(`${lines.join("\n")}\n`);
} catch (error) {
  outputBlocked(
    `Product/GTM helper failed: ${String(error.message ?? error)}`,
    "Use plan-first output or retry after checking `sifta-cli status`; do not fabricate candidates.",
  );
}
