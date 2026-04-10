/**
 * 中国家常菜题库：图片一律优先百度百科（bkimg），失败再 Commons file / 搜索 / 兜底。
 * 不下载到本地，写入 src/data/chinaHomeCooking49.generated.ts。
 *
 * 运行: node scripts/fetch-china-home-cooking-wiki-urls.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const UA =
  "TierMaker/1.0 (https://github.com/local/tiermaker; educational; Wikipedia / Commons thumbnails)";
const BAIDU_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const DELAY_MS = 200;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 本脚本默认不走英文维基（家常菜英文名易落到泛图）；解析顺序见 resolveImageUrl */
const SKIP_EN_WIKI_DEFAULT = true;

/**
 * zh + 可选 baike 词条别名 + Commons file / 搜索关键词 + en（仅作 Commons 搜索补充）
 * file: 百科失败后的 Commons 兜底图
 */
const DISHES = [
  { zh: "番茄炒蛋", baike: ["西红柿炒鸡蛋", "番茄炒蛋"], en: ["Stir-fried tomato and scrambled eggs"] },
  {
    zh: "醋溜土豆丝",
    baike: ["土豆丝", "醋溜土豆丝", "醋溜土豆"],
    commons: ["shredded potato stir fry", "Chinese potato", "土豆丝"],
    en: ["Potato"],
  },
  { zh: "地三鲜", baike: ["地三鲜"], file: "File:Disanxian.jpg", en: ["Di san xian"] },
  {
    zh: "干煸豆角",
    baike: ["干煸豆角", "干煸四季豆", "豆角"],
    commons: ["Sichuan green beans", "干煸豆角"],
    en: ["Dry-fried green beans", "Green bean"],
  },
  {
    zh: "蒜蓉西兰花",
    baike: ["清炒西兰花", "西兰花", "西兰花炒虾仁", "蒜蓉西兰花"],
    commons: ["broccoli garlic chinese", "蒜蓉西兰花"],
    en: ["Broccoli with garlic sauce", "Broccoli"],
  },
  {
    zh: "红烧茄子",
    baike: ["红烧茄子", "肉末茄子", "鱼香茄子"],
    commons: ["Chinese braised eggplant", "红烧茄子"],
    en: ["Braised eggplant", "Eggplant"],
  },
  {
    zh: "可乐鸡翅",
    baike: ["可乐鸡翅膀", "可乐鸡翅"],
    commons: ["Coca-Cola chicken", "可乐鸡翅"],
    en: ["Chicken wing"],
  },
  { zh: "土豆炖牛肉", baike: ["土豆炖牛肉"], en: ["Beef stew", "Beef bourguignon"] },
  { zh: "酸菜鱼", baike: ["酸菜鱼"], en: ["Fish with pickled mustard greens"] },
  {
    zh: "清蒸鱼",
    baike: ["清蒸鱼", "清蒸鲈鱼"],
    commons: ["Chinese steamed fish", "清蒸鱼", "steamed fish chinese"],
    en: ["Fish as food"],
  },
  { zh: "麻婆豆腐", baike: ["麻婆豆腐"], en: ["Mapo tofu"] },
  { zh: "鱼香肉丝", baike: ["鱼香肉丝"], en: ["Yuxiang shredded pork"] },
  { zh: "宫保鸡丁", baike: ["宫保鸡丁"], en: ["Kung Pao chicken"] },
  { zh: "回锅肉", baike: ["回锅肉"], en: ["Twice-cooked pork"] },
  { zh: "糖醋里脊", baike: ["糖醋里脊"], en: ["Sweet and sour pork"] },
  { zh: "红烧肉", baike: ["红烧肉"], en: ["Red braised pork belly"] },
  { zh: "木须肉", baike: ["木须肉"], en: ["Moo shu pork"] },
  {
    zh: "京酱肉丝",
    baike: ["京酱肉丝"],
    file: "File:京酱肉丝.jpg",
    commons: ["Jingjiang pork", "Beijing shredded pork"],
    en: ["Beijing cuisine"],
  },
  { zh: "辣子鸡", baike: ["辣子鸡", "重庆辣子鸡"], en: ["Laziji"] },
  {
    zh: "黄焖鸡",
    baike: ["黄焖鸡米饭", "黄焖鸡"],
    file: "File:Braised chicken.jpg",
    commons: ["黄焖鸡米饭", "Huangmenji"],
    en: ["Braised chicken"],
  },
  {
    zh: "手撕包菜",
    baike: ["手撕包菜", "包菜", "手撕卷心菜"],
    commons: ["Chinese hand torn cabbage", "手撕包菜"],
    en: ["Hand-torn cabbage", "Cabbage"],
  },
  { zh: "蚝油生菜", baike: ["蚝油生菜"], en: ["Lettuce with oyster sauce", "Lettuce"] },
  { zh: "青椒肉丝", baike: ["青椒肉丝"], commons: ["shredded pork pepper chinese", "青椒肉丝"], en: ["Stir-fried pork"] },
  {
    zh: "蛋炒饭",
    baike: ["黄金蛋炒饭", "扬州炒饭", "蛋炒饭", "炒饭"],
    en: ["Fried rice"],
  },
  { zh: "饺子", baike: ["饺子"], en: ["Jiaozi"] },
  { zh: "馄饨", baike: ["馄饨"], en: ["Wonton"] },
  { zh: "蛋花汤", baike: ["蛋花汤"], en: ["Egg drop soup"] },
  { zh: "酸辣汤", baike: ["酸辣汤"], en: ["Hot and sour soup"] },
  { zh: "紫菜蛋花汤", baike: ["紫菜蛋花汤", "紫菜汤"], en: ["Egg drop soup", "Seaweed"], commons: ["seaweed egg soup", "紫菜蛋花汤"] },
  { zh: "糖醋排骨", baike: ["糖醋排骨"], commons: ["sweet and sour ribs", "糖醋排骨"], en: ["Spare ribs"] },
  {
    zh: "农家小炒肉",
    baike: ["农家小炒肉", "辣椒炒肉"],
    file:
      "File:Nongjia Xiaochaorou at Xiangdu Xiangwei Restaurant, Beijing (20240125114913).jpg",
    commons: ["Hunan pork stir fry", "农家小炒肉"],
    en: ["Stir-fried pork"],
  },
  {
    zh: "剁椒鱼头",
    baike: ["剁椒鱼头"],
    file: "File:Steamed fish head with diced hot red peppers 20211206.jpg",
    commons: ["duojiao yutou", "steamed fish head chili"],
    en: ["Fish head"],
  },
  { zh: "白灼虾", baike: ["白灼虾"], file: "File:Canto white boiled shrimp.jpg", en: ["Blanched shrimp", "Shrimp"] },
  {
    zh: "葱爆羊肉",
    baike: ["葱爆羊肉", "葱爆羊肉片"],
    commons: ["scallion lamb chinese", "葱爆羊肉"],
    en: ["Lamb and mutton"],
  },
  {
    zh: "蒜泥白肉",
    baike: ["川菜蒜泥白肉", "蒜泥白肉", "李庄白肉"],
    commons: ["sliced pork garlic", "蒜泥白肉"],
    en: ["Pork belly"],
  },
  { zh: "韭菜炒蛋", baike: ["韭菜炒鸡蛋", "韭菜炒蛋"], file: "File:韭菜鸡蛋饼.jpg", commons: ["garlic chives egg", "韭菜炒蛋"], en: ["Garlic chives"] },
  { zh: "丝瓜炒蛋", baike: ["丝瓜炒蛋"], file: "File:Phat buap.jpg", commons: ["luffa egg", "丝瓜"], en: ["Luffa"] },
  {
    zh: "虎皮青椒",
    baike: ["虎皮青椒", "糖醋青椒"],
    commons: ["tiger skin pepper", "虎皮青椒"],
    en: ["Bell pepper"],
  },
  {
    zh: "干锅花菜",
    baike: ["干锅花菜", "干锅菜花", "干锅有机花菜"],
    commons: ["dry pot cauliflower", "干锅花菜"],
    en: ["Cauliflower"],
  },
  { zh: "清炒时蔬", baike: ["清炒时蔬", "炒时蔬"], en: ["Stir-fried vegetables", "Vegetable"] },
  { zh: "冬瓜排骨汤", baike: ["冬瓜排骨汤"], commons: ["winter melon rib soup", "冬瓜排骨"], en: ["Winter melon"] },
  { zh: "番茄鸡蛋汤", baike: ["番茄鸡蛋汤", "西红柿鸡蛋汤"], commons: ["tomato egg soup chinese", "番茄蛋花汤"], en: ["Tomato egg drop soup"] },
  { zh: "莲藕排骨汤", baike: ["莲藕排骨汤"], commons: ["lotus root pork soup", "lotus root soup pork", "莲藕汤"], en: ["Lotus root"] },
  { zh: "粉蒸肉", baike: ["粉蒸肉"], file: "File:粉蒸肉.jpg", commons: ["steamed pork rice flour"], en: ["Steamed pork"] },
  {
    zh: "梅菜扣肉",
    baike: ["梅菜扣肉"],
    file: "File:11月17日 梅菜扣肉.jpg",
    en: ["Meicai kourou", "Dongpo pork"],
    commons: ["mei cai kou rou", "梅菜扣肉"],
  },
  {
    zh: "口水鸡",
    baike: ["口水鸡"],
    file: "File:Koushuiji.jpg",
    commons: ["saliva chicken", "Sichuan mouthwatering chicken"],
    en: ["Chicken as food"],
  },
  { zh: "白切鸡", baike: ["白切鸡"], en: ["White cut chicken"] },
  { zh: "凉拌黄瓜", baike: ["凉拌黄瓜", "拍黄瓜"], en: ["Smashed cucumber salad", "Cucumber"] },
  { zh: "凉拌木耳", baike: ["凉拌木耳"], file: "File:Water-soaked black fungus.jpg", commons: ["wood ear salad"], en: ["Wood ear mushroom"] },
];

/** 最后兜底：不同菜品轮换，避免同图 */
const FALLBACK_FILES = [
  "File:Authentic Mapo Tofu.jpg",
  "File:Kung Pao chicken dish.jpg",
  "File:Jiaozi.jpg",
  "File:Zhajiangmian.jpg",
  "File:Hot pot food.jpg",
  "File:Yangzhou fried rice.jpg",
  "File:Wonton noodle soup.jpg",
  "File:Chinese steamed fish.jpg",
  "File:Mooncake.jpg",
  "File:Zongzi.jpg",
];

async function fetchWikiThumb(pageTitle) {
  const api =
    "https://en.wikipedia.org/w/api.php?" +
    new URLSearchParams({
      action: "query",
      titles: pageTitle,
      prop: "pageimages",
      piprop: "thumbnail",
      pithumbsize: "256",
      format: "json",
    });
  const res = await fetch(api, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const page = Object.values(data.query.pages)[0];
  if (page.missing) return null;
  return page.thumbnail?.source ?? null;
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

function isBadCommonsFile(title) {
  if (!title) return true;
  if (/\.(pdf|djvu|djv|svg)$/i.test(title)) return true;
  const t = title.toLowerCase();
  if (t.includes("particle") || t.includes("ultrasonic") || t.includes("wave field")) return true;
  if (t.includes(".djvu")) return true;
  return false;
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
        srlimit: "15",
      });
    const res = await fetch(api, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) continue;
    const data = await res.json();
    const hits = data.query?.search || [];
    for (const h of hits) {
      if (!h.title?.startsWith("File:")) continue;
      if (isBadCommonsFile(h.title)) continue;
      const u = await fetchCommonsThumb(h.title);
      if (u) return { url: u, via: `commons-search:"${q}"→${h.title}` };
      await sleep(DELAY_MS);
    }
    await sleep(DELAY_MS);
  }
  return null;
}

/** 百度百科词条页 <meta property="og:image">，必要时从正文取首张 bkimg */
function baikeLemmaTitles(dish) {
  const { zh, baike } = dish;
  const extra = Array.isArray(baike) ? baike : baike ? [baike] : [];
  return [...new Set([...extra, zh])];
}

function isRejectedBaiduImage(url) {
  if (!url || !/^https?:\/\//i.test(url)) return true;
  const u = url.toLowerCase();
  if (u.includes("baike.png") || u.includes("/cms/static/baike")) return true;
  if (u.includes("bkssl.bdimg.com/cms/static")) return true;
  return false;
}

/** 百度百科卡片 API（比抓取 SPA 页面可靠） */
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

/** 抓取词条页 og:image 或正文 bkimg（API 无结果时备用） */
async function fetchBaiduHtmlFallbackImage(title) {
  const pageUrl = `https://baike.baidu.com/item/${encodeURIComponent(title)}`;
  let res;
  try {
    res = await fetch(pageUrl, {
      headers: { "User-Agent": BAIDU_UA, Accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const html = await res.text();
  const og =
    html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i) ||
    html.match(/<meta\s+content="([^"]+)"\s+property="og:image"/i);
  let img = og?.[1]?.trim();
  if (img && !isRejectedBaiduImage(img)) return img;
  const bk = html.match(/https:\/\/bkimg\.cdn\.bcebos\.com\/(?:pic|smart)\/[^"'\\\s<>]+/);
  if (bk?.[0] && !bk[0].toLowerCase().includes(".svg")) {
    return bk[0].startsWith("http") ? bk[0] : `https://${bk[0]}`;
  }
  return null;
}

async function fetchBaiduBaikeImageUrl(lemmaTitles) {
  for (const title of lemmaTitles) {
    if (!title) continue;
    const fromApi = await fetchBaiduLemmaCardImage(title);
    if (fromApi) return { url: fromApi, via: `baike-api:${title}` };
    await sleep(DELAY_MS);
    const fromHtml = await fetchBaiduHtmlFallbackImage(title);
    if (fromHtml && !isRejectedBaiduImage(fromHtml)) {
      return { url: fromHtml, via: `baike-html:${title}` };
    }
    await sleep(DELAY_MS);
  }
  return null;
}

async function resolveImageUrl(dish, index) {
  const { zh, en = [], commons = [], file } = dish;
  const skipEnWiki = dish.skipEnWiki ?? SKIP_EN_WIKI_DEFAULT;

  const bd = await fetchBaiduBaikeImageUrl(baikeLemmaTitles(dish));
  if (bd) return bd;
  await sleep(DELAY_MS);

  if (file) {
    const u = await fetchCommonsThumb(file);
    if (u) return { url: u, via: `commons:${file}` };
    await sleep(DELAY_MS);
  }

  if (!skipEnWiki) {
    for (const title of en) {
      const u = await fetchWikiThumb(title);
      if (u) return { url: u, via: `enwiki:${title}` };
      await sleep(DELAY_MS);
    }
  }

  const searchQueries = [
    ...commons,
    ...en.map((e) => `${e} chinese food`),
    zh,
  ].filter(Boolean);

  const cs = await commonsSearchFirstThumb(searchQueries);
  if (cs) return cs;

  const fb = FALLBACK_FILES[index % FALLBACK_FILES.length];
  const u = await fetchCommonsThumb(fb);
  if (u) return { url: u, via: `fallback:${fb}` };
  return null;
}

async function main() {
  const lines = [];

  for (let i = 0; i < DISHES.length; i++) {
    const dish = DISHES[i];
    process.stdout.write(`[${i + 1}/${DISHES.length}] ${dish.zh} ... `);
    const resolved = await resolveImageUrl(dish, i);
    if (!resolved?.url) {
      console.log("FAIL");
      throw new Error(`无法解析图片: ${dish.zh}`);
    }
    console.log(resolved.via);
    lines.push(
      `    { name: ${JSON.stringify(dish.zh)}, imageUrl: ${JSON.stringify(resolved.url)} },`
    );
    await sleep(DELAY_MS);
  }

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outPath = join(__dirname, "..", "src", "data", "chinaHomeCooking49.generated.ts");
  const content = `/** 由 scripts/fetch-china-home-cooking-wiki-urls.mjs 自动生成；优先百度百科 bkimg，失败时为维基共享资源（未下载到本地） */
import type { QuestionBankItem } from "../types";

export const CHINA_HOME_COOKING_49_ITEMS: QuestionBankItem[] = [
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
