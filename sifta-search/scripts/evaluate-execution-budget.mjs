#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const benchmarkPath = process.argv[2];
const outArgIndex = process.argv.indexOf("--out");
const outPath = outArgIndex >= 0 ? process.argv[outArgIndex + 1] : null;

if (!benchmarkPath) {
  console.error("Usage: node evaluate-execution-budget.mjs <benchmark.json> [--out report.json]");
  process.exit(2);
}

const benchmark = JSON.parse(fs.readFileSync(benchmarkPath, "utf8"));
const suiteDir = path.dirname(benchmarkPath);

const budgets = {
  execute: {
    maxDurationSeconds: 180,
    maxWebSearchCount: 2,
    maxLiveCommandCount: 4,
    maxFindPeopleCalls: 2,
    maxEnrichPeopleCalls: 1,
    maxHelperCalls: 1,
  },
  "plan-first": {
    maxDurationSeconds: 120,
    maxWebSearchCount: 0,
    maxLiveCommandCount: 0,
    maxFindPeopleCalls: 0,
    maxEnrichPeopleCalls: 0,
    maxHelperCalls: 0,
  },
  "hard-stop": {
    maxDurationSeconds: 90,
    maxWebSearchCount: 0,
    maxLiveCommandCount: 0,
    maxFindPeopleCalls: 0,
    maxEnrichPeopleCalls: 0,
    maxHelperCalls: 0,
  },
  "near-miss": {
    severity: "warning",
    maxFindPeopleCalls: 0,
    maxEnrichPeopleCalls: 0,
    maxHelperCalls: 0,
  },
};

function readTiming(row) {
  const timingPath = path.join(suiteDir, row.id, "outputs", "timing.json");
  if (!fs.existsSync(timingPath)) return {};
  return JSON.parse(fs.readFileSync(timingPath, "utf8"));
}

function inspectEvents(row) {
  const eventsPath = path.join(suiteDir, row.id, "outputs", "events.jsonl");
  if (!fs.existsSync(eventsPath)) return null;
  const events = fs
    .readFileSync(eventsPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const webIds = new Set();
  const commandById = new Map();
  for (const event of events) {
    const item = event.item;
    if (!item?.id) continue;
    if (item.type === "web_search") webIds.add(item.id);
    if (item.type === "mcp_tool_call" && /web_search/i.test(item.tool ?? "")) webIds.add(item.id);
    if (item.type === "command_execution" && item.command) commandById.set(item.id, item.command);
  }
  const commandTexts = [...commandById.values()];
  const liveCommandTexts = commandTexts.filter((command) =>
    /\bsifta-cli\s+find-people\b|\bsifta-cli\s+enrich-people\b|\bgh\s+(search|api|repo|user)\b|\bcurl\b[^\n]*https?:|\bopen\s+https?:|\bnode\b.*(sifta|small-batch-github|small-batch-product-gtm)|python.*search/i.test(
      command,
    ),
  );
  return {
    uniqueWebSearchCount: webIds.size,
    uniqueCommandTexts: commandTexts,
    uniqueLiveCommandTexts: liveCommandTexts,
  };
}

function commandCounts(commandTexts) {
  const commands = Array.isArray(commandTexts) ? commandTexts : [];
  const uniqueCommands = [...new Set(commands)];
  const findPeople = commands.filter((command) => /\bsifta-cli\s+find-people\b/.test(command));
  const uniqueFindPeople = [...new Set(findPeople)];
  const enrichPeople = commands.filter((command) => /\bsifta-cli\s+enrich-people\b/.test(command));
  const uniqueEnrichPeople = [...new Set(enrichPeople)];
  const helpers = commands.filter((command) =>
    /\bnode\b.*(small-batch-(github|product-gtm)|known-github-dossier)\.mjs/.test(command),
  );
  const uniqueHelpers = [...new Set(helpers)];
  const gh = commands.filter((command) => /\bgh\s+(api|search|repo|user)\b/.test(command));
  const curl = commands.filter((command) => /\bcurl\b[^\n]*https?:/.test(command));
  return {
    rawCommandEventCount: commands.length,
    uniqueCommandCount: uniqueCommands.length,
    findPeopleCalls: uniqueFindPeople.length,
    rawFindPeopleEvents: findPeople.length,
    duplicateFindPeopleCalls: findPeople.length - uniqueFindPeople.length,
    enrichPeopleCalls: uniqueEnrichPeople.length,
    rawEnrichPeopleEvents: enrichPeople.length,
    helperCalls: uniqueHelpers.length,
    rawHelperEvents: helpers.length,
    ghCliCalls: new Set(gh).size,
    curlCalls: new Set(curl).size,
    duplicateCliCommandCount:
      commands.length -
      uniqueCommands.length,
    commandTexts: commands,
  };
}

function checkMax(label, actual, max, severity = "fail") {
  if (max === undefined) return null;
  return {
    text: `${label} <= ${max}`,
    passed: actual <= max,
    severity,
    evidence: `${label}=${actual}`,
  };
}

const rows = benchmark.rows.map((row) => {
  const timing = readTiming(row);
  const eventMetrics = inspectEvents(row);
  const budget = { ...(budgets[row.execution_policy] ?? budgets.execute), ...(row.budget ?? {}) };
  const severity = budget.severity ?? "fail";
  const commandTexts = eventMetrics?.uniqueCommandTexts ?? timing.command_texts ?? [];
  const counts = commandCounts(commandTexts);
  const webSearchCount =
    eventMetrics?.uniqueWebSearchCount ??
    timing.unique_web_search_count ??
    timing.web_search_count ??
    row.web_search_count ??
    0;
  const liveCommandCount =
    eventMetrics?.uniqueLiveCommandTexts?.length ??
    timing.unique_live_command_count ??
    timing.live_command_count ??
    row.live_command_count ??
    0;
  const checks = [
    checkMax("duration_seconds", timing.duration_seconds ?? row.duration_seconds ?? 0, budget.maxDurationSeconds, "warning"),
    checkMax("web_search_count", webSearchCount, budget.maxWebSearchCount, severity),
    checkMax("live_command_count", liveCommandCount, budget.maxLiveCommandCount, severity),
    checkMax("find_people_calls", counts.findPeopleCalls, budget.maxFindPeopleCalls, severity),
    checkMax("enrich_people_calls", counts.enrichPeopleCalls, budget.maxEnrichPeopleCalls, severity),
    checkMax("helper_calls", counts.helperCalls, budget.maxHelperCalls, severity),
  ].filter(Boolean);

  return {
    id: row.id,
    execution_policy: row.execution_policy,
    budget,
    metrics: {
      duration_seconds: timing.duration_seconds ?? row.duration_seconds,
      web_search_count: webSearchCount,
      raw_web_search_event_count: timing.raw_web_search_event_count ?? timing.web_search_count ?? row.web_search_count,
      live_command_count: liveCommandCount,
      raw_live_command_event_count: timing.raw_live_command_event_count ?? timing.live_command_count ?? row.live_command_count,
      model_output_missing: timing.model_output_missing ?? row.output_missing,
      ...counts,
    },
    checks,
    failed: checks.filter((check) => !check.passed && check.severity !== "warning").length,
    warnings: checks.filter((check) => !check.passed && check.severity === "warning").length,
  };
});

const summary = {
  suite: benchmark.suite,
  total_cases: rows.length,
  failed_cases: rows.filter((row) => row.failed > 0).length,
  warning_cases: rows.filter((row) => row.warnings > 0).length,
  total_failed_checks: rows.reduce((sum, row) => sum + row.failed, 0),
  total_warning_checks: rows.reduce((sum, row) => sum + row.warnings, 0),
};

const report = {
  evaluator: "sifta-execution-budget",
  generated_at: new Date().toISOString(),
  benchmark: benchmarkPath,
  summary,
  rows,
};

if (outPath) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
}

console.log(JSON.stringify(summary, null, 2));
if (summary.total_failed_checks > 0) process.exit(1);
