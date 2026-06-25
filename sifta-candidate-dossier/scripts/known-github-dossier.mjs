#!/usr/bin/env node

import { execFileSync } from "node:child_process";

function parseArgs(argv) {
  const args = {
    github: "",
    repo: "",
    query: "",
    maxRepos: 5,
    maxPrs: 3,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if ((arg === "--github" || arg === "--github-url" || arg === "--github-login") && next) args.github = next;
    if (arg === "--repo" && next) args.repo = next;
    if (arg === "--query" && next) args.query = next;
    if (arg === "--max-repos" && next) args.maxRepos = Number(next);
    if (arg === "--max-prs" && next) args.maxPrs = Number(next);
    if (arg.startsWith("--")) index += 1;
  }
  return args;
}

function loginFrom(value) {
  const match = String(value).match(/github\.com\/([^/?#]+)/i);
  return (match ? match[1] : value).replace(/^@/, "");
}

function ghJson(endpoint) {
  const stdout = execFileSync("gh", ["api", endpoint], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: 20_000,
  });
  return JSON.parse(stdout);
}

function safeGhJson(endpoint) {
  try {
    return ghJson(endpoint);
  } catch (error) {
    return { error: String(error.message ?? error) };
  }
}

function mdEscape(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ").trim();
}

function truncate(value, maxLength = 180) {
  const text = mdEscape(value);
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

const args = parseArgs(process.argv.slice(2));
const login = loginFrom(args.github);

if (!login) {
  process.stdout.write(
    [
      "# Known GitHub Candidate Dossier",
      "",
      "Execution Contract",
      "",
      "- STOP_AFTER_HELPER=true",
      "- HARD_STOP_AFTER_HELPER=true",
      "- No lookup executed because no GitHub login was provided.",
      "- Ask for one unambiguous GitHub, LinkedIn, homepage, company, or location signal.",
      "",
    ].join("\n"),
  );
  process.exit(0);
}

const user = safeGhJson(`users/${encodeURIComponent(login)}`);
const repos = safeGhJson(`users/${encodeURIComponent(login)}/repos?per_page=${args.maxRepos}&sort=updated`);
let prs = [];
if (args.repo) {
  const result = safeGhJson(
    `search/issues?q=author:${encodeURIComponent(login)}+repo:${args.repo}+is:pr&per_page=${args.maxPrs}`,
  );
  prs = Array.isArray(result.items) ? result.items : [];
}

const publicRepos = Array.isArray(repos) ? repos : [];
const lines = [
  "# Known GitHub Candidate Dossier",
  "",
  "Execution Contract",
  "",
  "- STOP_AFTER_HELPER=true",
  "- HARD_STOP_AFTER_HELPER=true",
  "- NO_FALLBACK_WEB=true",
  "- Same-turn fan-out allowed: no.",
  "- Commands executed: GitHub profile + recent repos + optional repo PR sample.",
  "- Forbidden same-turn actions: web search, raw README crawl, LinkedIn lookup, email search, extra repo sweep, or private contact inference.",
  "- Do not open GitHub/social URLs from this helper in the same turn; use the URLs already printed below.",
  "- Final answer must preserve exact headings: `Stop Condition` and `Coverage Warnings`.",
  "- Treat next actions as later user-approved verification, not permission to continue in this turn.",
  "",
  "Project Card",
  "",
  `- Input: ${mdEscape(args.github)}`,
  `- Capability Brief: ${mdEscape(args.query || "known GitHub candidate dossier")}`,
  `- Optional repo focus: ${mdEscape(args.repo || "none")}`,
  "",
  "Identity",
  "",
  "| Field | Value | Evidence | Confidence |",
  "| --- | --- | --- | --- |",
];

if (user.error) {
  lines.push(`| GitHub profile | ${mdEscape(login)} | ${mdEscape(user.error)} | low |`);
} else {
  lines.push(
    `| GitHub profile | ${mdEscape(user.name || user.login)} (${mdEscape(user.login)}) | ${mdEscape(user.html_url)} | high for GitHub identity |`,
    `| Public bio/company/location | ${truncate([user.bio, user.company, user.location].filter(Boolean).join(" / ") || "not public")} | GitHub public profile | medium |`,
    `| Public professional contact | ${mdEscape(user.email || "未找到公开职业联系方式")} | GitHub public email field only | ${user.email ? "medium" : "n/a"} |`,
  );
}

lines.push(
  "",
  "Public Evidence",
  "",
  "| Evidence | Source | Confidence | Weakness |",
  "| --- | --- | --- | --- |",
);

for (const repo of publicRepos.slice(0, args.maxRepos)) {
  lines.push(
    `| Repo: ${mdEscape(repo.full_name)}; stars=${repo.stargazers_count}; updated=${repo.updated_at} | ${mdEscape(repo.html_url)} | medium | Repo ownership/contribution signal, not role or availability proof |`,
  );
}

for (const pr of prs.slice(0, args.maxPrs)) {
  lines.push(
    `| PR: ${truncate(pr.title, 120)} | ${mdEscape(pr.html_url)} | medium | PR title proves public activity, not full contribution depth |`,
  );
}

if (!publicRepos.length && !prs.length) {
  lines.push("| No public GitHub evidence in budget | GitHub API | low | Need another public profile or repo focus |");
}

lines.push(
  "",
  "Fit Proof Packet",
  "",
  "| Requirement | Evidence | Source | Confidence | Weakness | Next action |",
  "| --- | --- | --- | --- | --- | --- |",
  `| ${mdEscape(args.query || "Known candidate public profile review")} | GitHub public profile and bounded repo/PR sample | ${mdEscape(user.html_url || `https://github.com/${login}`)} | medium | No LinkedIn/homepage/same-person cross-source verification in this pass | later user-approved pass: verify career profile or project ownership if needed |`,
  "",
  "Stop Condition",
  "",
  "- Helper output is final for this turn; do not continue profile/web verification without later user approval.",
  "",
  "Coverage Warnings",
  "",
  "- This helper intentionally stops after bounded GitHub public evidence.",
  "- It does not infer private email, phone, availability, salary, visa, relocation, or willingness to talk.",
  "- Public professional contact is only the GitHub public email field when present; do not guess email formats.",
  "- Candidate relevance still needs Owner review; this is evidence scaffolding, not approval.",
);

process.stdout.write(`${lines.join("\n")}\n`);
