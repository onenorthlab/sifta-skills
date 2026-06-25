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
      "# Product/GTM 小批量寻访",
      "",
      "结论",
      "",
      "- 本轮没有形成可交付候选人。",
      "",
      "覆盖风险",
      "",
      `- ${reason}`,
      "",
      "下一步",
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
const geoBias = "默认地域/市场：中国/中文生态相关人才池优先（不做族裔推断；缺公开相关职业信号不进候选分桶）。";
const query = `${rawQuery}；${geoBias}；候选人摘要、证据、风险和下一步必须使用中文输出。`;
const checkpoint = args.checkpoint ? `${args.checkpoint}；${geoBias}` : query;

try {
  if (!args.skipStatus) {
    const status = runJson(["status"], 20_000);
    if (!status.authenticated || !status.api_reachable) {
      outputBlocked(
        "LinkedIn 连接器未认证或 API 不可达。",
        "配置 Sifta 连接器认证后重试，或让用户批准改走计划输出。",
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
    "# Product/GTM 小批量寻访",
    "",
    "结论",
    "",
    people.length > 0
      ? `- 本轮形成 ${people.length} 个 Product/GTM 待核验强线索。`
      : "- 本轮没有形成可交付候选人。",
    `- 能力画像：${mdEscape(query)}`,
    `- 默认地域/市场：${geoBias}`,
    "- 来源策略：LinkedIn 职业资料来源；缺少公开职业信号时不进候选人分桶。",
    "",
    "候选人分桶 / 来源地图",
    "",
    "| 分桶 | 线索 | 职能证据 | 来源 | 置信度 | 弱点 | 下一步 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const person of people) {
    const fit = person.projectFit ?? {};
    const priority = fit.priority ?? "B";
    const evidenceStatus = fit.evidenceStatus ?? "待补证据";
    const roleFit = Array.isArray(fit.roleFit) ? fit.roleFit.join(", ") : fit.roleFit ?? "";
    lines.push(
      `| 待核验候选 | ${mdEscape(person.displayName)} | ${truncate(roleFit || person.headline, 120)}; ${evidenceText(person)} | ${mdEscape(person.profileUrl)} | priority=${mdEscape(priority)}, identity=${mdEscape(fit.identityConfidence ?? "unknown")} | ${truncate(`${evidenceStatus}; ${fit.whyNot ?? "需要跨来源审查"}`, 160)} | 用户后续批准后：${truncate(fit.nextAction ?? "人工复核职业资料和第二来源证据", 120)} |`,
    );
  }

  if (people.length === 0) {
    lines.push(
      "| 待核验线索 | 没有返回可用候选人 | 连接器在单次预算内没有返回候选人 | LinkedIn 职业资料来源 | 低 | 召回失败 | 调整查询或请用户收窄项目简报 |",
    );
  }

  lines.push(
    "",
    "来源地图",
    "",
    "| lead | sourceFamily | whyRelevant | conversionBlocker | nextVerification |",
    "| --- | --- | --- | --- | --- |",
  );

  if (sourceMap.length) {
    for (const lead of sourceMap.slice(0, 5)) {
      lines.push(
        `| ${mdEscape(lead.lead ?? lead.name ?? lead.title ?? "source lead")} | LinkedIn/公司线索 | ${mdEscape(lead.whyRelevant ?? lead.reason ?? "匹配 Product/GTM 能力画像")} | ${mdEscape(lead.conversionBlocker ?? "需要职业资料和证据审查")} | 用户后续批准后：${mdEscape(lead.nextVerification ?? "打开公开职业资料并核验角色证据")} |`,
      );
    }
  } else {
    lines.push(
      "| LinkedIn 单次连接器 | 职业资料来源 | Product/GTM 候选人需要公开职业资料证据 | 缺第二来源证据 | 核验个人资料、公司角色和公开产品/GTM 负责人证据 |",
    );
  }

  lines.push(
    "",
    "适配证明",
    "",
    "| 候选人/线索 | 要求 | 证据 | 来源 | 置信度 | 弱点 | 下一步 |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  );

  for (const person of people) {
    const fit = person.projectFit ?? {};
    lines.push(
      `| ${mdEscape(person.displayName)} | AI 或前沿科技业务的 Product/GTM 负责人证据 | ${evidenceText(person) || truncate(person.headline, 160)} | ${mdEscape(person.profileUrl)} | ${mdEscape(fit.priority ?? "B")} | ${truncate(fit.whyNot ?? fit.evidenceStatus ?? "需要 Owner 相关性审查", 160)} | 用户后续批准后：${truncate(fit.nextAction ?? "人工复核公开职业证据", 120)} |`,
    );
  }

  lines.push(
    "",
    "覆盖风险",
    "",
  );
  if (warnings.length) {
    for (const warning of warnings) lines.push(`- ${mdEscape(warning)}`);
  }
  lines.push(
    "- 不推断可用性、薪资、签证、搬迁、私人联系方式或沟通意愿。",
    "- 默认地域/市场对来源地图是排序和核验偏置，对候选人分桶是升级门槛；缺公开中国/中文生态相关职业信号的线索必须进入覆盖风险，不要包装成已满足。",
    "- 本轮是单次小批量召回；弱证据或单来源人选仍是 `待核验候选`。",
    "- 结构化适配证明不是 Owner 相关性批准。",
    "",
    "下一步",
    "",
    people.length > 0
      ? "- 用户确认后，核验公开职业资料、公司角色和第二来源证据，再决定是否写触达草稿。"
      : "- 用户确认后，收窄公司/产品方向或扩大同来源召回。",
  );

  process.stdout.write(`${lines.join("\n")}\n`);
} catch (error) {
  outputBlocked(
    `Product/GTM 小批量召回失败：${String(error.message ?? error)}`,
    "先输出计划，或检查连接器认证后重试；不要编造候选人。",
  );
}
