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
    const stderr = error?.stderr ? String(error.stderr) : "";
    return { error: String(error.message ?? error), stderr };
  }
}

function githubRecoveryHint(error) {
  const text = `${error?.error ?? ""}\n${error?.stderr ?? ""}`;
  if (/auth|credential|login|authentication|401|403|rate limit/i.test(text)) {
    return "检查 `gh auth status`；必要时运行 `gh auth login`，或在宿主环境设置 `GH_TOKEN` / `GITHUB_TOKEN` 后重跑";
  }
  if (/not found|404/i.test(text)) return "确认 seed 仓库名称是否正确，或替换 seed";
  return "重试 GitHub API 或替换 seed；不要仅为 GitHub token 改走 Sifta CLI";
}

const publicGeoPatterns = [
  /china|chinese|beijing|shanghai|shenzhen|hangzhou|guangzhou|hong kong|taiwan|taipei|tsinghua|peking university|zhejiang university|fudan|sjtu|ustc|hkust|cuhk|chinese academy|cas/i,
  /tencent|alibaba|bytedance|baidu|meituan|xiaohongshu|pinduoduo|huawei|ant group|alipay|deepseek|qwen|zhipu|moonshot|minimax|sensetime|megvii/i,
  /\.cn\b|\.com\.cn\b/i,
];

function publicGeoEvidence(user) {
  const fields = [
    ["location", user.location],
    ["company", user.company],
    ["blog", user.blog],
    ["bio", user.bio],
  ];
  const matches = [];
  for (const [field, rawValue] of fields) {
    const value = String(rawValue ?? "").trim();
    if (!value) continue;
    if (/\p{Script=Han}/u.test(value) || publicGeoPatterns.some((pattern) => pattern.test(value))) {
      matches.push(`${field}: ${value}`);
    }
  }
  return {
    matched: matches.length > 0,
    evidence: matches.slice(0, 2).join("；") || "未看到公开中国/中文生态相关职业信号",
  };
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
    leadRows.push({
      lead: repoName,
      sourceFamily: "GitHub 仓库线索",
      whyRelevant: "agent runtime / tool calling / evaluation seed",
      blocker: "仓库元数据读取失败",
      next: githubRecoveryHint(repo),
    });
    continue;
  }
  const contributors = safeGhJson(`repos/${repoName}/contributors?per_page=${args.contributorsPerRepo}`);
  if (!Array.isArray(contributors)) {
    leadRows.push({
      lead: repoName,
      sourceFamily: "GitHub 仓库线索",
      whyRelevant: "agent runtime / tool calling / evaluation seed",
      blocker: "贡献者列表读取失败",
      next: githubRecoveryHint(contributors),
    });
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
      bio: user.bio ?? "",
    };
    const geoEvidence = publicGeoEvidence(user);
    if (geoEvidence.matched) {
      candidates.push({ ...lead, geoEvidence });
    } else {
      leadRows.push({
        lead: `${lead.name || lead.login} (${lead.login})`,
        sourceFamily: "GitHub 贡献者线索",
        whyRelevant: `${lead.repo} 贡献者；公开贡献数 ${lead.contributions}`,
        blocker: "默认地域/市场未核验；缺公开中国/中文生态相关职业信号，不能升级为候选人或强线索",
        next: "核验公开职业资料、个人主页、LinkedIn、中文社区、中国市场或中国相关机构/公司信号",
      });
    }
    if (candidates.length >= args.targetCount) break;
  }
  leadRows.push({
    lead: repo.full_name,
    sourceFamily: "GitHub 仓库线索",
    whyRelevant: "agent runtime / tool calling / evaluation seed",
    blocker: "贡献者身份和证据未核验前只能作为仓库线索",
    next: "核验头部贡献者个人资料和仓库贡献深度",
  });
  if (candidates.length >= args.targetCount) break;
}

function mdEscape(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

const query = args.query || "AI agent runtime, tool calling, evaluation system";
const lines = [
  "# GitHub 小批量寻访",
  "",
  "项目简报",
  "",
  `- 能力画像：${query}`,
  "- 默认地域/市场：中国/中文生态相关人才池优先（候选人升级门槛；不凭姓名、照片或族裔猜测，缺公开职业信号不进候选分桶）。",
  `- 目标数量：${args.targetCount}`,
  "- STOP_AFTER_HELPER=true",
  "- HARD_STOP_AFTER_HELPER=true",
  "- 同轮扩展：不允许。",
  "- 本轮禁止动作：网页搜索、`gh search`、查询 commits/issues、浏览器查找、LinkedIn 补全或追加 seed 仓库。",
  "- 最终答复必须保留标题：`停止条件` 和 `覆盖风险`。",
  "- 执行预算：最多 2 个 seed 仓库、每个仓库最多 3 个贡献者、不查 commit/issues。",
  "- 如果本辅助脚本返回可用线索，本轮停止并汇报；如果没有可用线索，带覆盖风险停止，并询问或建议用户批准后再跑第二轮。",
  "",
  "候选人分桶",
  "",
  "| 分桶 | 线索 | 相关原因 | 来源 | 置信度 | 弱点 | 下一步 |",
  "| --- | --- | --- | --- | --- | --- | --- |",
];

for (const candidate of candidates) {
  lines.push(
    `| 待复核候选 | ${mdEscape(candidate.name || candidate.login)} (${mdEscape(candidate.login)}) | ${mdEscape(candidate.repo)} 贡献者；仓库匹配 Agent runtime/tool/evaluation seed；公开贡献数 ${candidate.contributions}；默认地域公开信号：${mdEscape(candidate.geoEvidence.evidence)} | ${mdEscape(candidate.profile)} / ${mdEscape(candidate.repoUrl)} | 中 | GitHub 元数据只能证明公开贡献信号，不能证明可用性、准确角色归属或沟通意愿 | 用户后续批准后：核验职业资料、贡献深度和同人身份 |`,
  );
}

if (candidates.length === 0) {
  lines.push("| 未升级 | 无符合默认地域/市场升级门槛的人选 | 预算内贡献者缺公开中国/中文生态相关职业信号 | GitHub API | 低 | 不能为凑数把全球贡献者包装成候选人 | 用户批准后改用中国/中文生态相关 seed 或放宽为全球人才池 |");
}

lines.push(
  "",
  "来源地图",
  "",
  "| lead | sourceFamily | whyRelevant | conversionBlocker | nextVerification |",
  "| --- | --- | --- | --- | --- |",
);

for (const row of leadRows) {
  lines.push(
    `| ${mdEscape(row.lead)} | ${mdEscape(row.sourceFamily ?? "GitHub 线索")} | ${mdEscape(row.whyRelevant ?? "agent runtime / tool calling / evaluation seed")} | ${mdEscape(row.blocker)} | ${mdEscape(row.next)} |`,
  );
}

lines.push(
  "",
  "适配证明包",
  "",
  "| 要求 | 证据 | 来源 | 置信度 | 弱点 | 下一步 |",
  "| --- | --- | --- | --- | --- | --- |",
);

for (const candidate of candidates) {
  lines.push(
    `| 构建 runtime/tool/eval 系统 | ${mdEscape(candidate.repo)} 贡献者，公开贡献数 ${candidate.contributions}；仓库描述：${mdEscape(candidate.repoDescription)} | ${mdEscape(candidate.repoUrl)} 和 ${mdEscape(candidate.profile)} | 中 | 升级到候选人分桶前，需要核验身份、角色和贡献深度 | 用户后续批准后：必要时检查职业资料或已合并 PR |`,
  );
}

if (candidates.length === 0) {
  lines.push(
    "| 默认地域/市场升级门槛 | 本轮固定 seed 内没有贡献者同时具备公开工程证据和中国/中文生态相关职业信号 | GitHub API | 中 | 只能证明这些是来源地图线索，不能证明符合默认人才池 | 用户批准后再跑中国/中文生态定向搜索，或明确放宽为全球人才池 |",
  );
}

lines.push(
  "",
  "停止条件",
  "",
  "- 本辅助脚本输出就是本轮最终执行结果；没有用户后续批准，不要继续搜索。",
  "",
  "覆盖风险",
  "",
  "- 本辅助脚本有意早停；它提供召回脚手架，不是最终候选人质量证明。",
  "- 不推断可用性、职级、薪酬、搬迁、私人联系方式或沟通意愿。",
  "- 默认地域/市场是候选人升级门槛：来源地图可以保留全球线索；缺公开中国/中文生态相关职业信号时不能进入候选人或强线索分桶。",
  "- 本轮未追加中国/中文生态定向搜索；如用户要继续，应批准下一轮换 seed、扩大 GitHub 搜索或明确放宽为全球人才池。",
  "- 仓库/项目线索在身份核验和证据评级前仍是来源地图线索。",
  "- 下一步动作是用户后续批准后的动作，不是本轮继续搜索许可。",
);

process.stdout.write(`${lines.join("\n")}\n`);
