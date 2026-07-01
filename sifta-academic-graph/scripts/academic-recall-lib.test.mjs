// 确定性单测：node --test academic-recall-lib.test.mjs
// 本核只保留确定性/客观逻辑：搜索串构造 + 客观信号粗排。
// 语义判断（综述弱证据、消歧、方向命中、中国生态归属）已移到宿主 Agent + rubric，
// 不再在脚本里单测——那些不是脚本该做的判断。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanSearchQuery,
  coreQueryTerms,
  scoreAcademicRoughSignals,
} from "./academic-recall-lib.mjs";

test("cleanSearchQuery 归一中文标点与空白并截断", () => {
  assert.equal(cleanSearchQuery("a，b；c"), "a b c");
  assert.equal(cleanSearchQuery("  x   y  "), "x y");
});

test("coreQueryTerms 去停用词保留实词（仅供构造搜索串）", () => {
  const terms = coreQueryTerms("multimodal large language model alignment");
  assert.ok(terms.includes("multimodal"));
  assert.ok(terms.includes("alignment"));
  assert.ok(!terms.includes("large")); // 停用词
  assert.ok(!terms.includes("model")); // 停用词
});

test("scoreAcademicRoughSignals 只用客观数值累加信号强度", () => {
  const strong = scoreAcademicRoughSignals({
    citedByCount: 800,
    worksCount: 35,
    recentWorksCount: 6,
    firstOrCorrespondingAuthorCount: 2,
  });
  assert.equal(strong.roughStrength, 3 + 2 + 1 + 1); // cited500+ works30+ recent3+ 一作
  assert.equal(strong.roughBand, "high");
  assert.ok(strong.signals.includes("cited:500+"));
  assert.ok(strong.signals.includes("first-or-corr-author"));
});

test("roughBand 分档：mid / low", () => {
  // cited100+(2) + works5+(1) = 3 => mid
  const mid = scoreAcademicRoughSignals({ citedByCount: 120, worksCount: 6 });
  assert.equal(mid.roughStrength, 3);
  assert.equal(mid.roughBand, "mid");
  // cited100+(2) + works<5(0) = 2 => low
  const low = scoreAcademicRoughSignals({ citedByCount: 120, worksCount: 4 });
  assert.equal(low.roughStrength, 2);
  assert.equal(low.roughBand, "low");
});

test("次轴地域只用 country_code 客观事实，且封顶不跨主轴档", () => {
  // 弱证据 + 强地域：次轴加分有限，roughStrength 仍低，不会靠地域抬成 high。
  const weakButChina = scoreAcademicRoughSignals({
    citedByCount: 5,
    worksCount: 2,
    geoStrong: true,
    orcid: "x",
  });
  assert.equal(weakButChina.roughStrength, 0); // cited<10 works<5 无客观强度
  assert.equal(weakButChina.roughBand, "low");
  assert.ok(weakButChina.signals.includes("geo:CN/HK/TW"));

  const strongGlobal = scoreAcademicRoughSignals({
    citedByCount: 900,
    worksCount: 40,
    recentWorksCount: 8,
    firstOrCorrespondingAuthorCount: 2,
  });
  // 强证据全球候选的 score 必须高于弱证据中国候选（地域不反超证据）。
  assert.ok(strongGlobal.score > weakButChina.score);
});
