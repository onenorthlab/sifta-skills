import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreHfContributor, isOrgOrBot, isPlatformStaff } from "./hf-recall-lib.mjs";

test("高论文+高下载 → high 档", () => {
  const r = scoreHfContributor({
    numPapers: 41,
    fullName: "Junyang Lin",
    orgs: ["Qwen"],
    contributedModels: [{ downloads: 12_000_000 }],
  });
  assert.equal(r.roughBand, "high");
  assert.ok(r.roughStrength >= 5);
});

test("关注数不计入强度：高关注但无论文无实绩不应被顶上去（平台名气≠工程能力）", () => {
  const celeb = scoreHfContributor({ numFollowers: 50_000, numPapers: 0, contributedModels: [] });
  assert.equal(celeb.roughStrength, 0);
  assert.equal(celeb.roughBand, "low");
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

test("isPlatformStaff：HF 平台运营方(huggingface org 成员)剔除，实验室成员保留", () => {
  assert.equal(isPlatformStaff(["huggingface", "argilla"]), true);
  assert.equal(isPlatformStaff(["Qwen", "OFA-Sys"]), false);
});
