/**
 * jichangx 主页 README 生成器:三站精品聚合
 * - 手工维护的链接清单在 ../hub.config.mjs
 * - 实时数字与「最近更新」每天由 GitHub Actions(.github/workflows/daily-update.yml)拉取
 * - 任何抓取失败都不会阻断生成,对应位置退回到固定文案
 * 用法:node scripts/build-readme.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITES, SITE_INTRO, SECTIONS, CLIENT_TABLE, REPOS, BRAND_REPOS, LIVE } from '../hub.config.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const today = new Date().toISOString().slice(0, 10);
const UA = { 'user-agent': 'jichangx-hub-readme' };

async function getText(url) {
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(String(r.status));
    return await r.text();
  } catch (e) {
    console.log('抓取失败(忽略):', url, e.message);
    return null;
  }
}
async function getJson(url) {
  const t = await getText(url);
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}
const decodeEntities = (s) =>
  String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .trim();
function parseRss(xml, n = 5) {
  if (!xml) return [];
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map((m) => {
      const b = m[1];
      const title = (b.match(/<title>([\s\S]*?)<\/title>/) || [])[1];
      const link = (b.match(/<link>([\s\S]*?)<\/link>/) || [])[1];
      const pub = (b.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1];
      const d = pub ? new Date(pub) : null;
      return { title: title ? decodeEntities(title) : '', link: link ? decodeEntities(link) : '', date: d && !isNaN(d) ? d.toISOString().slice(0, 10) : '' };
    })
    .filter((i) => i.title && i.link)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, n);
}

/* ---------- 实时数据 ---------- */
const airportsJson = await getJson(LIVE.airportsJson);
const bot = await getJson(LIVE.botData);
const freeReadme = await getText(LIVE.freeNodesReadme);
const rssLists = {};
for (const r of LIVE.rss) rssLists[r.site] = parseRss(await getText(r.url), 5);

const airportCount = airportsJson?.count ?? null;
const shareTotal = bot?.shareId?.total ?? null;
const warningCount = bot?.warnings?.count ?? null;
const freeNodesText = (freeReadme && (freeReadme.match(/今日 (约 \d+ 个)节点/) || [])[1]) || null;
const chaLatest = (bot?.articles ?? []).filter((a) => a.url && !a.url.includes('/undefined/')).slice(0, 5);

const liveNote = {
  freeNodes: freeNodesText ? `今日${freeNodesText}` : '每天 0 点更新',
  shareId: shareTotal ? `今日 ${shareTotal} 个账号` : '每日更新',
  warnings: warningCount ? `已收录 ${warningCount} 条` : '每日更新',
};

/* ---------- 工具 ---------- */
const badge = (label, value, color) => {
  const enc = (s) => encodeURIComponent(String(s).replace(/-/g, '--').replace(/_/g, '__'));
  return `![${label}](https://img.shields.io/badge/${enc(label)}-${enc(value)}-${color})`;
};
const tag = (site) => `\`${SITES[site].tag}\``;
const item = (i) => {
  const live = i.live ? ` · ${liveNote[i.live]}` : '';
  const note = i.note ? ` —— ${i.note}` : '';
  return `- ${tag(i.site)} [${i.label}](${i.url})${note}${live}`;
};
const section = (s) => {
  const groups = s.groups
    .map((g) => `${g.heading ? `**${g.heading}**\n\n` : ''}${g.items.map(item).join('\n')}`)
    .join('\n\n');
  return `<a name="${s.id}"></a>
## ${s.emoji} ${s.title}

${s.intro}

${groups}
`;
};

/* ---------- 客户端表 ---------- */
const clientTable = CLIENT_TABLE.map((p) => {
  const rows = p.rows
    .map((r) => {
      const dl = r.download ? `[下载与介绍](${r.download})` : '—';
      const tu = r.tutorials.length ? r.tutorials.map(([l, u]) => `[${l}](${u})`).join(' · ') : '—';
      return `| ${r.name} | ${dl} | ${tu} |`;
    })
    .join('\n');
  return `**${p.platform}**

| 客户端 | 下载与介绍 | 图文教程 |
| ---- | ---- | ---- |
${rows}`;
}).join('\n\n');

/* ---------- 最近更新 ---------- */
const latestBlock = (title, list, site) =>
  list.length
    ? `**${title}**\n\n${list.map((a) => `- ${tag(site)} [${a.title}](${a.url || a.link})${a.date ? ` · ${a.date}` : ''}`).join('\n')}`
    : `**${title}**\n\n- 暂时拉取失败,直接看 [${SITES[site].name}](${SITES[site].home})`;
const latest = [
  latestBlock('机场查 最新文章', chaLatest, 'cha'),
  latestBlock('机场中文网 最新文章', rssLists.cn ?? [], 'cn'),
  latestBlock('机场帮 最新文章', rssLists.help ?? [], 'help'),
].join('\n\n');

/* ---------- 站点表 / 仓库表 ---------- */
const siteTable = SITE_INTRO.map((s) => `| [${SITES[s.site].name} ${SITES[s.site].domain}](${SITES[s.site].home}) | ${s.role} | ${s.best} |`).join('\n');
const repoTable = REPOS.map((r) => `| ${r.emoji} [${r.name}](https://github.com/jichangx/${r.name}) | ${r.desc} | ${r.from} | [![Stars](https://img.shields.io/github/stars/jichangx/${r.name}?style=social)](https://github.com/jichangx/${r.name}/stargazers) |`).join('\n');
const brandRepos = BRAND_REPOS.map((r) => `[${r.replace('-jichang', '')}](https://github.com/jichangx/${r})`).join(' · ');

/* ---------- 组装 ---------- */
const nav = SECTIONS.map((s) => `[${s.emoji} ${s.title}](#${s.id})`).join(' · ');
const badges = [
  badge('更新', today, '00e676'),
  airportCount ? badge('收录机场', `${airportCount} 家`, '00b0ff') : '',
  freeNodesText ? badge('今日免费节点', freeNodesText, '00b0ff') : '',
  shareTotal ? badge('共享 Apple ID', `${shareTotal} 个`, 'fbbf24') : '',
  warningCount ? badge('跑路预警', `${warningCount} 条`, 'f87171') : '',
  `[![Telegram](https://img.shields.io/badge/Telegram-%40jichangcha-26A5E4?logo=telegram&logoColor=white)](https://t.me/jichangcha)`,
]
  .filter(Boolean)
  .join(' ');

const readme = `# 机场推荐 · 免费节点 · 共享 Apple ID · 跑路预警 · 客户端教程 · 翻墙科普｜三站精品聚合

${badges}

![2026 翻墙机场精品聚合](banner.png)

这里汇总 **机场查 jichangcha.com、机场帮 jichanghelp.com、机场中文网 jichangcnweb.com** 三个站和 GitHub 仓库里最值得收藏的页面,按七个板块整理。数字、最新文章每天由 GitHub Actions 自动同步,更新日期见顶部徽章。

<a name="repos"></a>
## 📦 GitHub 仓库导航

| 仓库 | 内容 | 来源 | Star |
| ---- | ---- | ---- | ---- |
${repoTable}

品牌测评仓库:${brandRepos}

**三个站各管什么**

| 站点 | 定位 | 招牌内容 |
| ---- | ---- | ---- |
${siteTable}

**快速导航**:${nav} · [📦 GitHub 仓库](#repos)

> ⚠️ 三个站都区分「站长实测」「官方资料」「公开反馈」与「尚未核验」,推广链接会明示;第一次买机场先月付,任何订阅链接都别外泄。

${SECTIONS.filter((s) => s.id !== 'clients' && s.id !== 'news').map(section).join('\n')}
<a name="clients"></a>
## 📱 2026 最全客户端下载与教程

${SECTIONS.find((s) => s.id === 'clients').intro}

${SECTIONS.find((s) => s.id === 'clients').groups.map((g) => `**${g.heading}**\n\n${g.items.map(item).join('\n')}`).join('\n\n')}

**按平台找客户端**

${clientTable}

<a name="news"></a>
## 📰 机场科普与快讯

${SECTIONS.find((s) => s.id === 'news').intro}

${latest}

${SECTIONS.find((s) => s.id === 'news').groups.map((g) => `**${g.heading}**\n\n${g.items.map(item).join('\n')}`).join('\n\n')}

## 📌 声明

- 三个站各自独立运营,内容口径见各站说明:[机场查 关于](https://www.jichangcha.com/about/) · [机场帮 编辑政策](https://www.jichanghelp.com/editorial-policy/) · [机场中文网 编辑原则](https://jichangcnweb.com/editorial-policy/)
- 本页由 GitHub Actions 每日自动生成:数字来自机场查公开数据端点,最近更新来自各站 RSS;链接清单在 [hub.config.mjs](hub.config.mjs)
- 部分链接为推广链接,可能为我们带来收益,不影响收录与排序;内容仅供学习交流,请遵守当地法律法规
- 反馈:[Issues](https://github.com/jichangx/jichangx/issues) · Telegram [@jichangcha_chat](https://t.me/jichangcha_chat)

> ⭐ 内容对你有帮助的话,给仓库点个 Star 就是最好的支持。
`;

writeFileSync(`${ROOT}/README.md`, readme);
console.log(`完成:README ${readme.length} 字符 · 机场 ${airportCount ?? '?'} · 免费节点 ${freeNodesText ?? '?'} · 共享 ID ${shareTotal ?? '?'} · 预警 ${warningCount ?? '?'} · 最新文章 cha ${chaLatest.length} / cn ${(rssLists.cn ?? []).length} / help ${(rssLists.help ?? []).length}`);
