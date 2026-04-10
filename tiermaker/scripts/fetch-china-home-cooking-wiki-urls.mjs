/**
 * 从英文维基百科 pageimages 解析主图 URL（不下载），写入 src/data/chinaHomeCooking49.generated.ts。
 * 无图时依次尝试 fallbacks；仍无则尝试维基共享资源 File:。
 *
 * 运行: node scripts/fetch-china-home-cooking-wiki-urls.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const UA =
  "TierMaker/1.0 (https://github.com/local/tiermaker; educational; Wikipedia thumbnails)";

const DELAY_MS = 250;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** zh + 英文维基标题尝试列表（前者优先） */
const DISHES = [
  { zh: "番茄炒蛋", en: ["Stir-fried tomato and scrambled eggs"] },
  { zh: "醋溜土豆丝", en: ["Shredded potato", "French fries", "Potato"] },
  { zh: "地三鲜", en: ["Di san xian"] },
  { zh: "干煸豆角", en: ["Dry-fried green beans"] },
  { zh: "蒜蓉西兰花", en: ["Broccoli with garlic sauce", "Broccoli"] },
  { zh: "红烧茄子", en: ["Braised eggplant", "Eggplant"] },
  { zh: "可乐鸡翅", en: ["Coca-Cola chicken"] },
  { zh: "土豆炖牛肉", en: ["Beef stew", "Beef bourguignon"] },
  { zh: "酸菜鱼", en: ["Fish with pickled mustard greens"] },
  { zh: "清蒸鱼", en: ["Steamed fish"] },
  { zh: "麻婆豆腐", en: ["Mapo tofu"] },
  { zh: "鱼香肉丝", en: ["Yuxiang shredded pork"] },
  { zh: "宫保鸡丁", en: ["Kung Pao chicken"] },
  { zh: "回锅肉", en: ["Twice-cooked pork"] },
  { zh: "糖醋里脊", en: ["Sweet and sour pork"] },
  { zh: "红烧肉", en: ["Red braised pork belly", "Hong shao rou"] },
  { zh: "木须肉", en: ["Moo shu pork"] },
  { zh: "京酱肉丝", en: ["Peking shredded pork", "Beijing cuisine"] },
  { zh: "辣子鸡", en: ["Laziji"] },
  { zh: "黄焖鸡", en: ["Huangmenji"] },
  { zh: "手撕包菜", en: ["Hand-torn cabbage", "Cabbage"] },
  { zh: "蚝油生菜", en: ["Lettuce with oyster sauce", "Lettuce"] },
  { zh: "青椒肉丝", en: ["Shredded pork with green pepper"] },
  { zh: "蛋炒饭", en: ["Fried rice"] },
  { zh: "饺子", en: ["Jiaozi"] },
  { zh: "馄饨", en: ["Wonton"] },
  { zh: "蛋花汤", en: ["Egg drop soup"] },
  { zh: "酸辣汤", en: ["Hot and sour soup"] },
  { zh: "紫菜蛋花汤", en: ["Egg drop soup", "Seaweed"] },
  { zh: "糖醋排骨", en: ["Sweet and sour spare ribs"] },
  { zh: "农家小炒肉", en: ["Stir-fried pork with chili pepper"] },
  { zh: "剁椒鱼头", en: ["Steamed fish head with diced chili"] },
  { zh: "白灼虾", en: ["Blanched shrimp", "Shrimp"] },
  { zh: "葱爆羊肉", en: ["Scallion lamb", "Lamb and mutton"] },
  { zh: "蒜泥白肉", en: ["Sliced pork with garlic sauce"] },
  { zh: "韭菜炒蛋", en: ["Stir-fried garlic chives and eggs"] },
  { zh: "丝瓜炒蛋", en: ["Stir-fried sponge gourd with egg"] },
  { zh: "虎皮青椒", en: ["Tiger skin green peppers"] },
  { zh: "干锅花菜", en: ["Dry pot cauliflower", "Cauliflower"] },
  { zh: "清炒时蔬", en: ["Stir-fried vegetables", "Vegetable"] },
  { zh: "冬瓜排骨汤", en: ["Winter melon soup", "Winter melon"] },
  { zh: "番茄鸡蛋汤", en: ["Tomato egg drop soup"] },
  { zh: "莲藕排骨汤", en: ["Lotus root soup", "Lotus root"] },
  { zh: "粉蒸肉", en: ["Steamed pork with rice flour"] },
  { zh: "梅菜扣肉", en: ["Meicai kourou", "Dongpo pork"] },
  { zh: "口水鸡", en: ["Saliva chicken", "Mouthwatering chicken"] },
  { zh: "白切鸡", en: ["White cut chicken"] },
  { zh: "凉拌黄瓜", en: ["Smashed cucumber salad", "Cucumber"] },
  { zh: "凉拌木耳", en: ["Wood ear salad", "Wood ear mushroom"] },
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

async function resolveImageUrl({ zh, en }) {
  for (const title of en) {
    const u = await fetchWikiThumb(title);
    if (u) return { url: u, via: `enwiki:${title}` };
    await sleep(DELAY_MS);
  }
  return null;
}

async function main() {
  const lines = [];
  const used = [];

  for (let i = 0; i < DISHES.length; i++) {
    const dish = DISHES[i];
    process.stdout.write(`[${i + 1}/${DISHES.length}] ${dish.zh} ... `);
    let resolved = await resolveImageUrl(dish);
    if (!resolved) {
      resolved = {
        url: await fetchCommonsThumb("File:Jiaozi.jpg"),
        via: "commons fallback File:Jiaozi.jpg",
      };
    }
    if (!resolved?.url) {
      console.log("FAIL");
      throw new Error(`无法解析图片: ${dish.zh}`);
    }
    console.log(resolved.via);
    used.push(resolved.via);
    lines.push(
      `    { name: ${JSON.stringify(dish.zh)}, imageUrl: ${JSON.stringify(resolved.url)} },`
    );
    await sleep(DELAY_MS);
  }

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outPath = join(__dirname, "..", "src", "data", "chinaHomeCooking49.generated.ts");
  const content = `/** 由 scripts/fetch-china-home-cooking-wiki-urls.mjs 自动生成；imageUrl 为维基媒体直链（未下载到本地） */
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
