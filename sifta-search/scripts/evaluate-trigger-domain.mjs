#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultEvalSet = path.resolve(__dirname, "../evals/trigger-evals.json");
const evalSetPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultEvalSet;

const cases = JSON.parse(fs.readFileSync(evalSetPath, "utf8"));

const recruitingSignals = [
  "候选", "招聘", "人才", "找人", "全职", "工程师", "产品经理", "研究员", "研究工程师",
  "gtm", "growth", "commercialization", "devrel", "sourcing", "candidate", "outreach",
  "私信", "邮件草稿", "上一轮", "深挖", "联系方式", "profile", "linkedin", "github handle",
];

const aiRoleSignals = [
  "ai", "agent", "llm", "mcp", "大模型", "智能体", "基础模型", "openalex", "semantic scholar",
  "arxiv", "openreview", "google scholar", "训练效率", "runtime", "开源", "proof-of-work",
];

const positiveIntents = [
  "候选", "人才", "工程师", "产品经理", "研究员", "研究工程师", "全职", "找几个", "找一个",
  "深挖", "判断是不是同一个人", "公开职业联系方式", "私信", "邮件草稿", "上一轮", "继续扩展",
  "linkedin 搜人", "sourcing", "candidate", "outreach",
];

const hardNegativeIntents = [
  "商业化模式", "赛道机会", "技术博客", "产品策略", "竞品定位", "技术调研", "不涉及招聘",
  "销售线索", "商务合作", "crm", "outbound", "融资新闻", "创始团队背景", "安排候选人面试",
  "ats stage", "recruiter 发提醒", "自动批量", "马上发邮件", "直接给我销售线索",
];

const prohibitedContactOrAutomation = [
  "私人手机号", "私人邮箱", "手机号", "自动批量加", "直接替我", "马上发",
];

function hasAny(text, signals) {
  return signals.some((signal) => text.includes(signal));
}

function classify(query) {
  const text = query.toLowerCase();
  const hasRecruiting = hasAny(text, recruitingSignals) || hasAny(text, positiveIntents);
  const hasAiRole = hasAny(text, aiRoleSignals);
  const hardNegative = hasAny(text, hardNegativeIntents);
  const safeDraftOnly = hasAny(text, ["不要自动发送", "不自动发送", "草稿"]);
  const unsafeAutomation = hasAny(text, prohibitedContactOrAutomation) ||
    (text.includes("自动发送") && !safeDraftOnly);

  if (unsafeAutomation) {
    return {
      shouldTrigger: false,
      route: "blocked-contact-or-autosend",
      reason: "Requests private contact discovery or automated sending; Sifta may draft outreach only after public evidence and human confirmation.",
    };
  }

  if (text.includes("不涉及招聘") || text.includes("ats stage") || text.includes("安排候选人面试")) {
    return {
      shouldTrigger: false,
      route: "near-miss-non-sourcing",
      reason: "Explicitly non-recruiting technical research or ATS/interview operations, not Sifta sourcing.",
    };
  }

  if (hardNegative && !hasAny(text, ["招聘", "候选", "全职", "人才", "产品经理", "工程师", "研究员"])) {
    return {
      shouldTrigger: false,
      route: "near-miss-non-sourcing",
      reason: "Adjacent company research, sales, CRM, ATS, blog, or technical research request without candidate sourcing intent.",
    };
  }

  if (hasRecruiting && hasAiRole) {
    return {
      shouldTrigger: true,
      route: "sifta-search",
      reason: "AI-industry candidate sourcing, dossier, outreach draft, or review-feedback intent.",
    };
  }

  if (hasAny(text, ["上一轮", "候选人", "候选人的", "公开联系方式", "私信", "邮件草稿"])) {
    return {
      shouldTrigger: true,
      route: "sifta-search",
      reason: "Known candidate dossier, outreach, or review-feedback workflow.",
    };
  }

  return {
    shouldTrigger: false,
    route: "no-match",
    reason: "No clear AI recruiting sourcing, candidate dossier, outreach draft, or review-feedback intent.",
  };
}

const results = cases.map((item, index) => {
  const actual = classify(item.query);
  return {
    index: index + 1,
    query: item.query,
    expected_should_trigger: item.should_trigger,
    actual_should_trigger: actual.shouldTrigger,
    pass: actual.shouldTrigger === item.should_trigger,
    route: actual.route,
    reason: actual.reason,
  };
});

const passed = results.filter((item) => item.pass).length;
const failed = results.length - passed;
const summary = {
  eval_set: evalSetPath,
  total: results.length,
  passed,
  failed,
  pass_rate: results.length === 0 ? 0 : passed / results.length,
};

const report = { summary, results };
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (failed > 0) {
  process.exitCode = 1;
}
