import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreHfContributor, isOrgOrBot } from "./hf-recall-lib.mjs";

test("高论文+高下载+高关注 → high 档", () => {
  const r = scoreHfContributor({
    numPapers: 41,
    numFollowers: 5000,
    fullName: "Junyang Lin",
    orgs: ["Qwen"],
    contributedModels: [{ downloads: 12_000_000 }],
  });
  assert.equal(r.roughBand, "high");
  assert.ok(r.roughStrength >= 5);
});

test("无客观信号 → low 档", () => {
  const r = scoreHfContributor({ numPapers: 0, numFollowers: 0, contributedModels: [] });
  assert.equal(r.roughBand, "low");
  assert.equal(r.roughStrength, 0);
});

test("贡献到高下载模型即使无论文也能进 mid+", () => {
  const r = scoreHfContributor({ contributedModels: [{ downloads: 500_000 }] });
  assert.ok(r.roughStrength >= 2);
  assert.notEqual(r.roughBand, "low");
});

test("次轴(身份完整度)封顶且永不跨档：满身份的 low 不反超有实绩的 mid", () => {
  const richIdentityNoWork = scoreHfContributor({
    fullName: "Someone", orgs: ["A", "B", "C"], contributedModels: [],
  });
  const realWork = scoreHfContributor({ contributedModels: [{ downloads: 200_000 }] });
  assert.ok(realWork.roughStrength > richIdentityNoWork.roughStrength);
  assert.ok(realWork.score > richIdentityNoWork.score);
});

test("isOrgOrBot：组织种子/机器人跳过，个人保留", () => {
  assert.equal(isOrgOrBot("Qwen", ["Qwen", "deepseek-ai"]), true);
  assert.equal(isOrgOrBot("github-actions[bot]", []), true);
  assert.equal(isOrgOrBot("JustinLin610", ["Qwen"]), false);
});
