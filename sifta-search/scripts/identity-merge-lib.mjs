// 跨源人物融合纯函数核（无 I/O、无副作用）。
// 目标：把同一个人在 GitHub / 学术 / 其它源里分别召回到的候选，按"公开互链"保守合并成一个，
// 叠加多源证据。解决分析里点名的盲区——研究型工程师 / infra 创业 CTO / 技术型 PM 这类
// 跨画像"超级个体"被单源管道各自低估、落在缝里。
//
// 核心纪律（落 output-quality「除非 same-person hint 或明确公开证据，否则不要断言同一人」）：
//  - 只用强公开身份锚合并：相同 GitHub login / ORCID / OpenAlex id / Twitter handle / 个人主页 host。
//  - 绝不靠姓名相同合并（重名是学术/GitHub 的头号误并源）。
//  - 个人主页 host 要排除共享平台（medium / linkedin / github.com 裸域等），否则
//    medium.com/@a 与 medium.com/@b 会被误判同人。
//  - 合并是"证据叠加"，跨源确认（≥2 个不同 source）是一个真实的信号增强，但学术源仍不证明可招聘性，
//    合并后 bucket 不自动升 strong：取各源最强 bucket 但学术参与时最高仍受其上限约束由调用方决定。

// 已知共享平台 host（这些 host 不是个人身份锚，不能用于合并）。
const SHARED_HOST_BLOCKLIST = new Set([
  "github.com",
  "github.io",
  "gist.github.com",
  "medium.com",
  "substack.com",
  "notion.site",
  "notion.so",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "t.co",
  "youtube.com",
  "youtu.be",
  "facebook.com",
  "instagram.com",
  "zhihu.com",
  "jianshu.com",
  "csdn.net",
  "google.com",
  "scholar.google.com",
  "researchgate.net",
  "semanticscholar.org",
  "orcid.org",
  "openalex.org",
  "huggingface.co",
  "bit.ly",
  "linktr.ee",
]);

function safeUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
}

/** 从 URL 取 GitHub login（github.com/<login>），排除组织/保留路径。 */
export function githubLogin(value) {
  const url = safeUrl(value);
  if (!url) return null;
  if (!/(^|\.)github\.com$/i.test(url.hostname)) return null;
  const seg = url.pathname.split("/").filter(Boolean)[0];
  if (!seg) return null;
  // 保留路径不是用户
  if (/^(orgs|sponsors|topics|search|marketplace|features|about|pricing)$/i.test(seg)) return null;
  return seg.toLowerCase();
}

/** 规范化 ORCID 为 0000-0000-0000-0000 形态。 */
export function normalizeOrcid(value) {
  const m = String(value ?? "").match(/(\d{4}-\d{4}-\d{4}-\d{3}[\dxX])/u);
  return m ? m[1].toUpperCase() : null;
}

/** 取 Twitter/X handle（去 @、小写）。 */
export function twitterHandle(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const url = safeUrl(raw);
  if (url && /(^|\.)(twitter\.com|x\.com)$/i.test(url.hostname)) {
    const seg = url.pathname.split("/").filter(Boolean)[0];
    return seg ? seg.replace(/^@/, "").toLowerCase() : null;
  }
  // 裸 handle（如 twitter_username 字段）
  if (/^@?[A-Za-z0-9_]{1,15}$/u.test(raw)) return raw.replace(/^@/, "").toLowerCase();
  return null;
}

/** 个人主页 host（排除共享平台）；返回 null 表示不是可用于合并的个人身份锚。 */
export function homepageHost(value) {
  const url = safeUrl(value);
  if (!url) return null;
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (SHARED_HOST_BLOCKLIST.has(host)) return null;
  // user.github.io 这类个人子域：保留完整 host（子域已能区分个人）
  return host;
}

/**
 * 抽取一个候选的全部强公开身份键集合（用于跨源合并）。
 * 键带类型前缀，避免不同类型碰撞：github:/orcid:/openalex:/x:/home:。
 */
export function identityKeysOf(person) {
  const keys = new Set();
  const gh =
    githubLogin(person.profileUrl) ||
    githubLogin(person.url) ||
    (person.source === "github" && person.login ? String(person.login).toLowerCase() : null);
  if (gh) keys.add(`github:${gh}`);

  const orcid = normalizeOrcid(person.orcid) || normalizeOrcid(person.profileUrl);
  if (orcid) keys.add(`orcid:${orcid}`);

  if (person.openAlexId) {
    keys.add(
      `openalex:${String(person.openAlexId).replace(/^https?:\/\/openalex\.org\//iu, "").toLowerCase()}`,
    );
  }

  const tw = twitterHandle(person.twitter_username) || twitterHandle(person.blog);
  if (tw) keys.add(`x:${tw}`);

  for (const u of [person.blog, person.homepageUrl, person.profileUrl, person.url]) {
    const host = homepageHost(u);
    if (host) keys.add(`home:${host}`);
  }
  return keys;
}

const BUCKET_RANK = { strong: 3, soft: 2, lead: 1, reject: 0 };

/**
 * 跨源保守合并。
 * @param {Array<{source:string, people:Array<object>}>} lists 各源的候选列表
 * @returns {{merged:Array<object>, crossSourceCount:number}}
 *   merged 每条：原字段 + sources[] + identityKeys[] + crossSourceConfirmed + evidence 叠加。
 */
export function mergePeopleAcrossSources(lists) {
  const nodes = [];
  for (const list of lists ?? []) {
    const source = list?.source ?? "unknown";
    for (const person of list?.people ?? []) {
      nodes.push({ person, source, keys: identityKeysOf(person) });
    }
  }

  // Union-Find：把共享任一强身份键的节点并到一组。
  const parent = nodes.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  const keyToNode = new Map();
  nodes.forEach((node, i) => {
    for (const key of node.keys) {
      if (keyToNode.has(key)) union(keyToNode.get(key), i);
      else keyToNode.set(key, i);
    }
  });

  const clusters = new Map();
  nodes.forEach((node, i) => {
    const root = find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(node);
  });

  const merged = [];
  let crossSourceCount = 0;
  for (const cluster of clusters.values()) {
    if (cluster.length === 1) {
      const { person, source } = cluster[0];
      merged.push({
        ...person,
        sources: [source],
        identityKeys: [...cluster[0].keys],
        crossSourceConfirmed: false,
      });
      continue;
    }
    // 选证据最强的人作为主记录（bucket rank 高者；并列取 score 高者）。
    const primary = [...cluster].sort((a, b) => {
      const br = (BUCKET_RANK[b.person.bucket] ?? 0) - (BUCKET_RANK[a.person.bucket] ?? 0);
      if (br !== 0) return br;
      return (b.person.score ?? 0) - (a.person.score ?? 0);
    })[0].person;

    const sources = [...new Set(cluster.map((n) => n.source))];
    const allKeys = [...new Set(cluster.flatMap((n) => [...n.keys]))];
    const evidence = [
      ...new Set(
        cluster.flatMap((n) =>
          (n.person.evidence ?? []).map((e) => `[${n.source}] ${e}`),
        ),
      ),
    ];
    const crossSourceConfirmed = sources.length >= 2;
    if (crossSourceConfirmed) crossSourceCount += 1;

    merged.push({
      ...primary,
      sources,
      identityKeys: allKeys,
      crossSourceConfirmed,
      // 跨源确认是身份可信度增强（公开互链验证了同人），不是可招聘性结论。
      crossSourceNote: crossSourceConfirmed
        ? `同一人公开互链在 ${sources.join(" + ")} 多源确认；证据已叠加，仍需人工确认当前角色`
        : undefined,
      evidence: evidence.slice(0, 8),
      // 合并保留各源 bucket 供调用方决策；不在纯函数里自动升 strong（学术源不证明可招聘性）。
      mergedBuckets: cluster.map((n) => ({ source: n.source, bucket: n.person.bucket })),
    });
  }

  return { merged, crossSourceCount };
}
