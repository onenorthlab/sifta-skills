// 确定性单测：node --test identity-merge-lib.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  githubLogin,
  normalizeOrcid,
  twitterHandle,
  homepageHost,
  identityKeysOf,
  mergePeopleAcrossSources,
} from "./identity-merge-lib.mjs";

test("githubLogin 取用户、排除组织/保留路径/非 github", () => {
  assert.equal(githubLogin("https://github.com/Alice"), "alice");
  assert.equal(githubLogin("github.com/orgs/acme"), null);
  assert.equal(githubLogin("https://gitlab.com/bob"), null);
});

test("normalizeOrcid / twitterHandle / homepageHost 规范化", () => {
  assert.equal(normalizeOrcid("https://orcid.org/0000-0002-1825-0097"), "0000-0002-1825-0097");
  assert.equal(twitterHandle("@Jane_Doe"), "jane_doe");
  assert.equal(twitterHandle("https://x.com/handle"), "handle");
  assert.equal(homepageHost("https://alice.dev/about"), "alice.dev");
  assert.equal(homepageHost("https://alice.github.io"), "alice.github.io");
});

test("homepageHost 排除共享平台（防 medium/linkedin 误并）", () => {
  assert.equal(homepageHost("https://medium.com/@alice"), null);
  assert.equal(homepageHost("https://www.linkedin.com/in/bob"), null);
  assert.equal(homepageHost("https://github.com/alice"), null);
});

test("identityKeysOf：github 与 academic 候选各取强锚", () => {
  const gh = identityKeysOf({
    source: "github",
    login: "alice",
    profileUrl: "https://github.com/alice",
    blog: "https://alice.dev",
  });
  assert.ok(gh.has("github:alice"));
  assert.ok(gh.has("home:alice.dev"));

  const ac = identityKeysOf({
    source: "academic",
    orcid: "https://orcid.org/0000-0002-1825-0097",
    homepageUrl: "https://alice.dev",
    openAlexId: "https://openalex.org/A123",
  });
  assert.ok(ac.has("orcid:0000-0002-1825-0097"));
  assert.ok(ac.has("home:alice.dev"));
  assert.ok(ac.has("openalex:a123"));
});

test("跨源合并：github×academic 共享主页 host → 合并且 crossSourceConfirmed", () => {
  const { merged, crossSourceCount } = mergePeopleAcrossSources([
    {
      source: "github",
      people: [
        {
          source: "github",
          displayName: "Alice",
          login: "alice",
          profileUrl: "https://github.com/alice",
          blog: "https://alice.dev",
          bucket: "soft",
          score: 1200,
          evidence: ["核心 repo 贡献"],
        },
      ],
    },
    {
      source: "academic",
      people: [
        {
          source: "academic",
          displayName: "Alice W",
          homepageUrl: "https://alice.dev",
          openAlexId: "https://openalex.org/A1",
          bucket: "soft",
          score: 300,
          evidence: ["一作论文 X"],
        },
      ],
    },
  ]);
  assert.equal(merged.length, 1, "同人应合并为一条");
  assert.equal(crossSourceCount, 1);
  const m = merged[0];
  assert.equal(m.crossSourceConfirmed, true);
  assert.deepEqual([...m.sources].sort(), ["academic", "github"]);
  // 证据叠加且带源前缀
  assert.ok(m.evidence.some((e) => e.startsWith("[github]")));
  assert.ok(m.evidence.some((e) => e.startsWith("[academic]")));
});

test("保守：仅同名、无共享强锚 → 绝不合并", () => {
  const { merged, crossSourceCount } = mergePeopleAcrossSources([
    {
      source: "github",
      people: [
        { source: "github", displayName: "Wei Zhang", login: "weizhang1", profileUrl: "https://github.com/weizhang1", bucket: "soft" },
      ],
    },
    {
      source: "academic",
      people: [
        { source: "academic", displayName: "Wei Zhang", openAlexId: "https://openalex.org/A2", orcid: "0000-0001-0002-0003", bucket: "soft" },
      ],
    },
  ]);
  assert.equal(merged.length, 2, "同名不同人不得合并");
  assert.equal(crossSourceCount, 0);
});

test("共享平台 host 不作为合并锚（medium 不同人不误并）", () => {
  const { merged } = mergePeopleAcrossSources([
    {
      source: "github",
      people: [{ source: "github", login: "a", profileUrl: "https://github.com/a", blog: "https://medium.com/@a", bucket: "soft" }],
    },
    {
      source: "academic",
      people: [{ source: "academic", openAlexId: "https://openalex.org/A9", homepageUrl: "https://medium.com/@b", bucket: "soft" }],
    },
  ]);
  assert.equal(merged.length, 2, "共享平台主页不能把两个人并到一起");
});

test("同 ORCID 合并；主记录取证据更强者", () => {
  const { merged } = mergePeopleAcrossSources([
    {
      source: "academic",
      people: [{ source: "academic", displayName: "Lead", orcid: "0000-0003-0003-0003", bucket: "soft", score: 400, evidence: ["paper"] }],
    },
    {
      source: "scholar",
      people: [{ source: "scholar", displayName: "weak dup", orcid: "https://orcid.org/0000-0003-0003-0003", bucket: "lead", score: 100, evidence: ["scholar profile"] }],
    },
  ]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].displayName, "Lead", "应保留 bucket 更强的主记录");
  assert.equal(merged[0].crossSourceConfirmed, true);
});
