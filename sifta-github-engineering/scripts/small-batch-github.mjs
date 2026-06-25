#!/usr/bin/env node

import { execFileSync } from "node:child_process";

function parseArgs(argv) {
  const args = {
    profile: "agent-runtime",
    query: "",
    targetCount: 2,
    maxRepos: 2,
    contributorsPerRepo: 3,
    seeds: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--profile" && next) args.profile = next;
    if (arg === "--query" && next) args.query = next;
    if (arg === "--target-count" && next) args.targetCount = Number(next);
    if (arg === "--max-repos" && next) args.maxRepos = Number(next);
    if (arg === "--contributors-per-repo" && next) args.contributorsPerRepo = Number(next);
    if (arg === "--seed" && next) args.seeds.push(next);
    if (arg.startsWith("--")) index += 1;
  }
  return args;
}

const profileSeeds = {
  "agent-runtime": [
    "langchain-ai/langgraph",
    "openai/openai-agents-python",
    "microsoft/autogen",
    "confident-ai/deepeval",
  ],
  "agent-evaluation": [
    "confident-ai/deepeval",
    "langchain-ai/agentevals",
    "braintrustdata/braintrust-sdk",
  ],
};

function ghJson(endpoint) {
  const stdout = execFileSync("gh", ["api", endpoint], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: 20_000,
  });
  return JSON.parse(stdout);
}

function isBot(login) {
  return /\[bot\]$|bot$|dependabot|pre-commit-ci/i.test(login);
}

function safeGhJson(endpoint) {
  try {
    return ghJson(endpoint);
  } catch (error) {
    return { error: String(error.message ?? error) };
  }
}

const args = parseArgs(process.argv.slice(2));
const seedRepos = (args.seeds.length ? args.seeds : profileSeeds[args.profile] ?? profileSeeds["agent-runtime"])
  .slice(0, args.maxRepos);

const candidates = [];
const leadRows = [];
const seen = new Set();

for (const repoName of seedRepos) {
  const repo = safeGhJson(`repos/${repoName}`);
  if (repo.error) {
    leadRows.push({ lead: repoName, blocker: "repo metadata failed", next: "retry repo or replace seed" });
    continue;
  }
  const contributors = safeGhJson(`repos/${repoName}/contributors?per_page=${args.contributorsPerRepo}`);
  if (!Array.isArray(contributors)) {
    leadRows.push({ lead: repoName, blocker: "contributors failed", next: "retry contributors endpoint" });
    continue;
  }

  for (const contributor of contributors) {
    if (!contributor?.login || isBot(contributor.login) || seen.has(contributor.login)) continue;
    seen.add(contributor.login);
    const user = safeGhJson(`users/${contributor.login}`);
    const lead = {
      login: contributor.login,
      name: user.name ?? "",
      repo: repo.full_name,
      repoUrl: repo.html_url,
      repoDescription: repo.description ?? "",
      repoStars: repo.stargazers_count ?? 0,
      repoUpdatedAt: repo.updated_at ?? "",
      contributions: contributor.contributions ?? 0,
      profile: contributor.html_url,
      company: user.company ?? "",
      blog: user.blog ?? "",
      location: user.location ?? "",
    };
    candidates.push(lead);
    if (candidates.length >= args.targetCount) break;
  }
  leadRows.push({
    lead: repo.full_name,
    blocker: "repo lead only until contributor identity/evidence is checked",
    next: "verify top contributor profile and repo contribution depth",
  });
  if (candidates.length >= args.targetCount) break;
}

function mdEscape(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

const query = args.query || "AI agent runtime, tool calling, evaluation system";
const lines = [
  "# GitHub Small-Batch Sourcing",
  "",
  "Project Card",
  "",
  `- Capability Brief: ${query}`,
  `- Target Count: ${args.targetCount}`,
  "- Execution Budget: max 2 seed repos, max 3 contributors per repo, no commit/issues search.",
  "",
  "Candidate Buckets",
  "",
  "| Bucket | Lead | Why relevant | Source | Confidence | Weakness | Next action |",
  "| --- | --- | --- | --- | --- | --- | --- |",
];

for (const candidate of candidates) {
  lines.push(
    `| 待核验强线索 | ${mdEscape(candidate.name || candidate.login)} (${mdEscape(candidate.login)}) | ${mdEscape(candidate.repo)} contributor; repo matches agent runtime/tool/evaluation seed; ${candidate.contributions} public contributions | ${mdEscape(candidate.profile)} / ${mdEscape(candidate.repoUrl)} | medium | GitHub metadata proves public contribution signal, not availability or exact role ownership | verify LinkedIn/personal site, contribution depth, and same-person identity |`,
  );
}

if (candidates.length === 0) {
  lines.push("| Lead Queue | No usable profile | No non-bot contributor passed the budget | GitHub API | low | recall failed | broaden seed repo or use Sifta CLI |");
}

lines.push(
  "",
  "Source Map",
  "",
  "| lead | sourceFamily | whyRelevant | conversionBlocker | nextVerification |",
  "| --- | --- | --- | --- | --- |",
);

for (const row of leadRows) {
  lines.push(
    `| ${mdEscape(row.lead)} | GitHub repo lead | agent runtime / tool calling / evaluation seed | ${mdEscape(row.blocker)} | ${mdEscape(row.next)} |`,
  );
}

lines.push(
  "",
  "Fit Proof Packet",
  "",
  "| requirement | evidence | source | confidence | weakness | next action |",
  "| --- | --- | --- | --- | --- | --- |",
);

for (const candidate of candidates) {
  lines.push(
    `| Built runtime/tool/eval systems | ${mdEscape(candidate.repo)} contributor with ${candidate.contributions} contributions; repo description: ${mdEscape(candidate.repoDescription)} | ${mdEscape(candidate.repoUrl)} and ${mdEscape(candidate.profile)} | medium | Needs identity, role, and contribution-depth review before candidate bucket upgrade | open profile, inspect merged PRs if needed, then verify career profile |`,
  );
}

lines.push(
  "",
  "Coverage Warnings",
  "",
  "- This helper intentionally stops early; it is recall scaffolding, not final candidate quality proof.",
  "- It does not infer availability, seniority, compensation, relocation, private contact, or willingness to talk.",
  "- Repo/project leads remain source-map leads until identity checked and evidence graded.",
);

process.stdout.write(`${lines.join("\n")}\n`);
