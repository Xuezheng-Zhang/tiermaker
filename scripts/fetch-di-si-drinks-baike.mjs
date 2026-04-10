/**
 * 屌丝饮料题库：图片优先百度百科（BaikeLemmaCardApi / 词条页 og:image / bkimg）
 * 失败时维基共享资源搜索兜底。
 *
 * 运行: node scripts/fetch-di-si-drinks-baike.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const UA =
  "TierMaker/1.0 (https://github.com/local/tiermaker; educational; Baidu Baike / Wikimedia)";
const BAIDU_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const DELAY_MS = 250;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 展示名 + 百度百科检索词（先试主名再试别名） */
const DRINKS = [
  { zh: "康师傅冰红茶", baike: ["康师傅冰红茶", "冰红茶"] },
  { zh: "康师傅绿茶", baike: ["康师傅绿茶", "康师傅 绿茶"] },
  {
    zh: "康师傅茉莉蜜茶",
    /** 百科无「茉莉蜜茶」独立词条时，用近义产品「茉莉清茶」配图 */
    baike: ["茉莉清茶", "康师傅茉莉清茶", "茉莉蜜茶", "茉莉花茶"],
  },
  { zh: "康师傅冰糖雪梨", baike: ["康师傅冰糖雪梨", "冰糖雪梨"] },
  { zh: "统一绿茶", baike: ["统一绿茶"] },
  { zh: "统一鲜橙多", baike: ["统一鲜橙多", "鲜橙多"] },
  { zh: "东鹏特饮", baike: ["东鹏特饮"] },
  {
    zh: "东方树叶",
    baike: ["东方树叶", "农夫山泉东方树叶", "东方树叶茶"],
  },
  { zh: "三得利乌龙茶", baike: ["三得利乌龙茶", "乌龙茶"] },
  { zh: "阿萨姆奶茶", baike: ["阿萨姆奶茶", "统一阿萨姆奶茶"] },
  { zh: "脉动", baike: ["脉动", "脉动饮料"] },
  { zh: "尖叫", baike: ["尖叫", "尖叫饮料"] },
  { zh: "维他柠檬茶", baike: ["维他柠檬茶", "柠檬茶"] },
  { zh: "可口可乐", baike: ["可口可乐", "可口可乐 经典"] },
  { zh: "雪碧", baike: ["雪碧"] },
  { zh: "百事可乐", baike: ["百事可乐", "百事 汽水"] },
  { zh: "美汁源果粒橙", baike: ["美汁源果粒橙", "果粒橙"] },
  { zh: "王老吉", baike: ["王老吉"] },
  { zh: "加多宝", baike: ["加多宝"] },
];

/** 指定款用维基共享资源瓶装/产品图（百科易混入 logo 或脏链） */
const MANUAL_IMAGE_URL = {
  /** 百科 bkimg，避免 Commons 误匹配无关货架图 */
  东鹏特饮:
    "https://bkimg.cdn.bcebos.com/pic/e824b899a9014c085053cc87057b02087bf4f4ac?x-bce-process=image/format,f_auto",
  百事可乐:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/A_bottle_of_Pepsi_2024-11-29.jpg/500px-A_bottle_of_Pepsi_2024-11-29.jpg",
  王老吉:
    "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/WangLaoJi_Herbal_Tea_250ml.jpg/500px-WangLaoJi_Herbal_Tea_250ml.jpg",
};

function baikeLemmaTitles(d) {
  const extra = Array.isArray(d.baike) ? d.baike : d.baike ? [d.baike] : [];
  return [...new Set([...extra, d.zh])];
}

function isRejectedBaiduImage(url) {
  if (!url || !/^https?:\/\//i.test(url)) return true;
  const u = url.toLowerCase();
  if (u.includes("baike.png") || u.includes("/cms/static/baike")) return true;
  if (u.includes("bkssl.bdimg.com/cms/static")) return true;
  return false;
}

/** URL 或路径上像品牌标志而非瓶装/罐装产品图 */
function isLikelyLogoOrBrandMarkUrl(url) {
  if (!url) return true;
  const u = decodeURIComponent(url).toLowerCase();
  if (/logo|标志|商标|徽标|icon|watermark|签名|题字/.test(u)) return true;
  return false;
}

/** 百科内嵌 JSON 会把 &quot; 粘在 URL 后，需截断避免脏链 */
function sanitizeBkimgUrl(raw) {
  let u = raw.replace(/&amp;/g, "&");
  const q = u.indexOf("&quot;");
  if (q !== -1) u = u.slice(0, q);
  const d = u.indexOf('"');
  if (d !== -1 && u.startsWith("http")) u = u.slice(0, d);
  return u.trim();
}

/** 从词条 HTML 中提取全部 bkimg，去重保序 */
function extractAllBkimgUrls(html) {
  const re = /https:\/\/bkimg\.cdn\.bcebos\.com\/[^"'\\\s<>]+/gi;
  const seen = new Set();
  const order = [];
  let m;
  while ((m = re.exec(html))) {
    let u = sanitizeBkimgUrl(m[0]);
    if (!u.startsWith("http")) continue;
    if (u.toLowerCase().includes(".svg")) continue;
    const key = u.split("?")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    order.push(u);
  }
  return order;
}

/**
 * 多图时百科首图常为 logo/企业标识，优先选其后一张产品图；
 * 单图则使用；并跳过明显为标志的 URL。
 */
function pickProductBkimg(urls) {
  const usable = urls.filter((u) => !isRejectedBaiduImage(u));
  if (usable.length === 0) return null;

  const nonLogo = usable.filter((u) => !isLikelyLogoOrBrandMarkUrl(u));
  const pool = nonLogo.length > 0 ? nonLogo : usable;

  if (pool.length >= 2) {
    const second = pool[1];
    if (!isLikelyLogoOrBrandMarkUrl(second)) return second;
    const rest = pool.slice(1).find((u) => !isLikelyLogoOrBrandMarkUrl(u));
    return rest ?? pool[1];
  }
  return pool[0];
}

/** pick 失败时：尽量用第二张或首张，避免整页无图 */
function fallbackBkimg(urls) {
  const usable = urls.filter((u) => !isRejectedBaiduImage(u));
  if (usable.length === 0) return null;
  if (usable.length >= 2) return usable[1];
  return usable[0];
}

async function fetchBaiduLemmaCardImage(title) {
  const api =
    "https://baike.baidu.com/api/openapi/BaikeLemmaCardApi?" +
    new URLSearchParams({
      scope: "103",
      format: "json",
      appid: "379020",
      bk_key: title,
    });
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(300 * attempt);
    const res = await fetch(api, {
      headers: { "User-Agent": BAIDU_UA, Accept: "application/json" },
    });
    if (!res.ok) continue;
    const data = await res.json();
    if (data.errno && Number(data.errno) !== 0) continue;
    const img = typeof data.image === "string" ? data.image.trim() : "";
    if (img && !isRejectedBaiduImage(img)) return img;
  }
  return null;
}

async function fetchBaiduHtmlPage(title) {
  const pageUrl = `https://baike.baidu.com/item/${encodeURIComponent(title)}`;
  try {
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": BAIDU_UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** 优先从正文多图中取产品图，其次 og:image，再首张 bkimg */
async function fetchBaiduHtmlProductImage(title) {
  const html = await fetchBaiduHtmlPage(title);
  if (!html) return null;
  const all = extractAllBkimgUrls(html);
  const picked = pickProductBkimg(all) ?? fallbackBkimg(all);
  if (picked) return { url: picked, via: `baike-html-pic:${title}` };

  const og =
    html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
    html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
  let img = og?.[1]?.trim();
  if (img && !isRejectedBaiduImage(img) && !isLikelyLogoOrBrandMarkUrl(img)) return { url: img, via: `baike-html-og:${title}` };

  if (all[0] && !isRejectedBaiduImage(all[0])) {
    return { url: all[0], via: `baike-html-first:${title}` };
  }
  return null;
}

async function fetchBaiduBaikeImageUrl(lemmaTitles) {
  for (const title of lemmaTitles) {
    if (!title) continue;
    const fromHtml = await fetchBaiduHtmlProductImage(title);
    if (fromHtml?.url) {
      await sleep(DELAY_MS);
      return fromHtml;
    }
    await sleep(DELAY_MS);
    const fromApi = await fetchBaiduLemmaCardImage(title);
    if (fromApi && !isLikelyLogoOrBrandMarkUrl(fromApi)) {
      return { url: fromApi, via: `baike-api:${title}` };
    }
    if (fromApi) {
      return { url: fromApi, via: `baike-api-fallback:${title}` };
    }
    await sleep(DELAY_MS);
  }
  return null;
}

async function fetchCommonsThumb(fileTitle) {
  const api =
    "https://commons.wikimedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      titles: fileTitle,
      prop: "imageinfo",
      iiprop: "url",
      iiurlwidth: "256",
      format: "json",
    });
  const res = await fetch(api, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const page = Object.values(data.query.pages)[0];
  if (page.missing) return null;
  const ii = page.imageinfo?.[0];
  return ii?.thumburl || ii?.url || null;
}

async function commonsSearchFirstThumb(queries) {
  for (const q of queries) {
    if (!q) continue;
    const api =
      "https://commons.wikimedia.org/w/api.php?" +
      new URLSearchParams({
        action: "query",
        list: "search",
        srsearch: q,
        srnamespace: "6",
        format: "json",
        srlimit: "12",
      });
    const res = await fetch(api, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) continue;
    const data = await res.json();
    const hits = data.query?.search || [];
    for (const h of hits) {
      if (!h.title?.startsWith("File:")) continue;
      if (/\.(pdf|svg|djvu)$/i.test(h.title)) continue;
      const u = await fetchCommonsThumb(h.title);
      if (u) return { url: u, via: `commons-search:"${q}"→${h.title}` };
      await sleep(DELAY_MS);
    }
    await sleep(DELAY_MS);
  }
  return null;
}

async function resolveImageUrl(d) {
  const manual = MANUAL_IMAGE_URL[d.zh];
  if (manual) return { url: manual, via: "manual-commons" };

  const bd = await fetchBaiduBaikeImageUrl(baikeLemmaTitles(d));
  if (bd) return bd;
  await sleep(DELAY_MS);

  const queries = [
    `${d.zh} bottle`,
    `${d.zh} 瓶装`,
    `${d.zh} 罐装`,
    `${d.zh} drink`,
    `${d.zh} beverage`,
    `${d.zh} 饮料`,
    d.zh,
  ];
  const cs = await commonsSearchFirstThumb(queries);
  if (cs) return cs;
  return null;
}

async function main() {
  const lines = [];

  for (let i = 0; i < DRINKS.length; i++) {
    const d = DRINKS[i];
    process.stdout.write(`[${i + 1}/${DRINKS.length}] ${d.zh} ... `);
    const resolved = await resolveImageUrl(d);
    if (!resolved?.url) {
      console.log("FAIL");
      throw new Error(`无法解析图片: ${d.zh}`);
    }
    console.log(resolved.via);
    lines.push(
      `    { name: ${JSON.stringify(d.zh)}, imageUrl: ${JSON.stringify(resolved.url)} },`
    );
    await sleep(DELAY_MS);
  }

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outPath = join(__dirname, "..", "src", "data", "diSiDrinks.generated.ts");
  const content = `/** 由 scripts/fetch-di-si-drinks-baike.mjs 自动生成；优先百度百科 bkimg，失败时为维基共享资源（未下载到本地） */
import type { QuestionBankItem } from "../types";

export const DI_SI_DRINKS_ITEMS: QuestionBankItem[] = [
${lines.join("\n")}
];
`;
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, content, "utf8");
  console.log(`\n完成 -> ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
