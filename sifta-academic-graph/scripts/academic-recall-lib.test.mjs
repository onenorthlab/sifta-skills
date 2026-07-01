// 确定性单测：node --test academic-recall-lib.test.mjs
// 锁定学术召回核的质量约束，不依赖 live OpenAlex。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanSearchQuery,
  coreQueryTerms,
  isSurveyWork,
  detectDisambiguationRisk,
  scoreAcademicTwoAxis,
} from "./academic-recall-lib.mjs";

test("coreQueryTerms 去停用词并保留方向词", () => {
  const terms = coreQueryTerms("multimodal large language model alignment");
  assert.ok(terms.includes("multimodal"));
  assert.ok(terms.includes("alignment"));
  // 停用词 large/model/language(非停用) — large、model 在停用表，应被去掉
  assert.ok(!terms.includes("large"));
  assert.ok(!terms.includes("model"));
});

test("cleanSearchQuery 归一中文标点与空白并截断", () => {
  assert.equal(cleanSearchQuery("a，b；c"), "a b c");
  assert.equal(cleanSearchQuery("  x   y  "), "x y");
});

test("isSurveyWork 识别综述类标题", () => {
  assert.ok(isSurveyWork("A Survey on Large Language Model based Autonomous Agents"));
  assert.ok(isSurveyWork("A Comprehensive Review of Multimodal Learning"));
  assert.ok(isSurveyWork("Vision-Language Models: An Overview"));
  assert.ok(!isSurveyWork("Diffusion Policy for Robotic Manipulation"));
});

test("detectDisambiguationRisk: 跨无关重学科 → risky", () => {
  const r = detectDisambiguationRisk({
    conceptTags: ["Medicine", "Materials science", "Artificial intelligence"],
    worksCount: 46,
    orcid: "x",
  });
  assert.equal(r.risky, true);
  assert.ok(r.reasons.some((x) => /无关重学科/.test(x)));
});

test("detectDisambiguationRisk: 单一 CS/AI 领域 + 有锚 → 不 risky", () => {
  const r = detectDisambiguationRisk({
    conceptTags: ["Computer science", "Artificial intelligence"],
    worksCount: 20,
    orcid: "x",
  });
  assert.equal(r.risky, false);
});

test("detectDisambiguationRisk: 超高产无身份锚 → risky", () => {
  const r = detectDisambiguationRisk({
    conceptTags: ["Computer science"],
    worksCount: 120,
    orcid: null,
    homepageUrl: null,
  });
  assert.equal(r.risky, true);
});

test("survey-only 候选不能进 strong（综述效应降权）", () => {
  const surveyAuthor = {
    citedByCount: 1200,
    nonSurveyCitedByCount: 0, // 引用全来自 survey
    surveyWorksCount: 2,
    nonSurveyWorksCount: 0,
    worksCount: 40,
    recentWorksCount: 5,
    conceptTags: ["Computer science", "Artificial intelligence"],
    evidence: ["multimodal alignment survey"],
    firstOrCorrespondingAuthorCount: 1,
    orcid: "x",
  };
  const scored = scoreAcademicTwoAxis(surveyAuthor, ["multimodal", "alignment"]);
  assert.notEqual(scored.evidenceTier, "strong");
  assert.ok(scored.signals.includes("survey-only-penalty"));
});

test("消歧门：噪声合并实体被封顶在 adjacent，永不 strong", () => {
  // 模拟 Lei Wang 型：跨 Medicine/Materials/AI + 高引，本会算 strong
  const noisyEntity = {
    citedByCount: 1380,
    nonSurveyCitedByCount: 1380,
    worksCount: 46,
    recentWorksCount: 29,
    conceptTags: ["Medicine", "Computer science", "Materials science", "Artificial intelligence"],
    evidence: ["multimodal alignment work"],
    firstOrCorrespondingAuthorCount: 2,
    orcid: "x",
    geoStrong: true,
  };
  const scored = scoreAcademicTwoAxis(noisyEntity, ["multimodal", "alignment"]);
  assert.notEqual(scored.evidenceTier, "strong");
  assert.ok(scored.signals.includes("disambiguation-risk-capped"));
});

test("干净强候选排在噪声实体之前（核心回归）", () => {
  const cleanStrong = {
    citedByCount: 800,
    nonSurveyCitedByCount: 800,
    worksCount: 35,
    recentWorksCount: 6,
    conceptTags: ["Computer science", "Artificial intelligence"],
    evidence: ["multimodal alignment first-author paper"],
    firstOrCorrespondingAuthorCount: 2,
    orcid: "clean",
    geoStrong: true,
  };
  const noisyEntity = {
    citedByCount: 1380,
    nonSurveyCitedByCount: 1380,
    worksCount: 46,
    recentWorksCount: 29,
    conceptTags: ["Medicine", "Materials science", "Artificial intelligence"],
    evidence: ["multimodal alignment work"],
    firstOrCorrespondingAuthorCount: 2,
    orcid: "noisy",
    geoStrong: true,
  };
  const a = scoreAcademicTwoAxis(cleanStrong, ["multimodal", "alignment"]);
  const b = scoreAcademicTwoAxis(noisyEntity, ["multimodal", "alignment"]);
  assert.equal(a.evidenceTier, "strong");
  assert.equal(b.evidenceTier, "adjacent");
  assert.ok(a.score > b.score, `干净 strong(${a.score}) 应 > 噪声 adjacent(${b.score})`);
});

test("两轴硬约束：弱档+强地域 永不反超 强档", () => {
  const weakButChina = {
    citedByCount: 5,
    worksCount: 2,
    recentWorksCount: 0,
    conceptTags: [],
    evidence: [],
    firstOrCorrespondingAuthorCount: 0,
    geoStrong: true,
    orcid: "x",
    homepageUrl: "h",
  };
  const strongGlobal = {
    citedByCount: 900,
    nonSurveyCitedByCount: 900,
    worksCount: 40,
    recentWorksCount: 8,
    conceptTags: ["Artificial intelligence"],
    evidence: ["alignment paper"],
    firstOrCorrespondingAuthorCount: 2,
    geoStrong: false,
  };
  const w = scoreAcademicTwoAxis(weakButChina, ["alignment"]);
  const s = scoreAcademicTwoAxis(strongGlobal, ["alignment"]);
  assert.equal(w.evidenceTier, "weak");
  assert.equal(s.evidenceTier, "strong");
  assert.ok(s.score > w.score, "强档全球候选必须排在弱档中国候选之前");
});

test("方向门：不命中方向词的高产作者不给 strong（砍跑偏）", () => {
  // 上一轮 self-adaptive systems 型：高引/高产/多一作，但方向完全不沾具身/VLA
  const highOutputOffDirection = {
    citedByCount: 900,
    nonSurveyCitedByCount: 900,
    worksCount: 100,
    recentWorksCount: 10,
    conceptTags: ["Computer science", "Software engineering"],
    evidence: ["Generative AI for Self-Adaptive Systems"],
    firstOrCorrespondingAuthorCount: 4,
    orcid: "x",
  };
  const dirs = ["embodied", "vla", "robotics", "world"];
  const off = scoreAcademicTwoAxis(highOutputOffDirection, dirs);
  assert.notEqual(off.evidenceTier, "strong");
  assert.ok(off.signals.includes("no-direction-capped"));
  // 对照：同等产出但方向命中 → 仍可 strong
  const on = scoreAcademicTwoAxis(
    { ...highOutputOffDirection, evidence: ["Vision-Language-Action model for robotics manipulation"] },
    dirs,
  );
  assert.equal(on.evidenceTier, "strong");
});
