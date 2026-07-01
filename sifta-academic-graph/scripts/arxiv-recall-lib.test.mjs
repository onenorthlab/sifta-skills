import { test } from "node:test";
import assert from "node:assert/strict";
import { extractCodeUrl, extractProjectUrl, scoreArxivPaper } from "./arxiv-recall-lib.mjs";

test("extractCodeUrl: 从 comment/abstract 抽 github 仓，去尾部标点", () => {
  assert.equal(extractCodeUrl("Code at https://github.com/foo/bar."), "https://github.com/foo/bar");
  assert.equal(extractCodeUrl("see https://gitlab.com/a/b)"), "https://gitlab.com/a/b");
  assert.equal(extractCodeUrl("no link here"), null);
  assert.equal(extractCodeUrl(""), null);
});

test("extractProjectUrl: 抽 github.io 项目页", () => {
  assert.equal(extractProjectUrl("proj: https://someone.github.io/paper/"), "https://someone.github.io/paper/");
  assert.equal(extractProjectUrl("nope"), null);
});

test("scoreArxivPaper: 有官方代码=最高强度(能拿干净 GitHub 身份)", () => {
  const now = "2026-06-30T00:00:00Z";
  const withCode = scoreArxivPaper({ codeUrl: "https://github.com/a/b", published: "2026-06-01T00:00:00Z" }, now);
  const noCode = scoreArxivPaper({ codeUrl: null, published: "2026-06-01T00:00:00Z" }, now);
  assert.ok(withCode.score > noCode.score);
  assert.equal(withCode.band, "high");
  assert.ok(withCode.signals.includes("official-code"));
});

test("scoreArxivPaper: 新近度加分，老论文不加", () => {
  const now = "2026-06-30T00:00:00Z";
  const recent = scoreArxivPaper({ codeUrl: null, published: "2026-06-15T00:00:00Z" }, now);
  const old = scoreArxivPaper({ codeUrl: null, published: "2020-01-01T00:00:00Z" }, now);
  assert.ok(recent.score > old.score);
  assert.equal(old.score, 0);
});

test("scoreArxivPaper: 无 nowIso 不因时钟臆断新近度", () => {
  const r = scoreArxivPaper({ codeUrl: "https://github.com/a/b", published: "2026-06-01T00:00:00Z" }, "");
  assert.equal(r.score, 3); // 只有 official-code 的 3 分，无 recency
});
