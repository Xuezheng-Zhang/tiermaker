/**
 * 从英文维基百科条目主图（pageimage）下载 256px 缩略图，作为中国著名旅游景点配图。
 * 写入 public/posters/china-attractions/，并生成 src/data/chinaAttractions40.generated.ts
 *
 * 说明：遵守 https://foundation.wikimedia.org/wiki/Policy:User-Agent_policy
 * 运行: node scripts/download-china-attractions-wiki.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const UA =
  "TierMaker/1.0 (https://github.com/local/tiermaker; educational; Wikipedia page images)";

const DELAY_MS = 1200;
const TOTAL = 40;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 中文展示名 + 英文维基百科条目名（与 en.wikipedia.org 标题一致） */
const ATTRACTIONS = [
  { zh: "北京故宫", en: "Forbidden City" },
  { zh: "万里长城", en: "Great Wall of China" },
  { zh: "兵马俑", en: "Terracotta Army" },
  { zh: "黄山", en: "Huangshan" },
  { zh: "九寨沟", en: "Jiuzhaigou" },
  { zh: "张家界", en: "Zhangjiajie National Forest Park" },
  { zh: "桂林漓江", en: "Li River" },
  { zh: "杭州西湖", en: "West Lake" },
  { zh: "泰山", en: "Mount Tai" },
  { zh: "峨眉山", en: "Mount Emei" },
  { zh: "庐山", en: "Mount Lu" },
  { zh: "布达拉宫", en: "Potala Palace" },
  { zh: "天坛", en: "Temple of Heaven" },
  { zh: "颐和园", en: "Summer Palace" },
  { zh: "丽江古城", en: "Old Town of Lijiang" },
  { zh: "乌镇", en: "Wuzhen" },
  { zh: "周庄", en: "Zhouzhuang" },
  { zh: "平遥古城", en: "Pingyao" },
  { zh: "莫高窟", en: "Mogao Caves" },
  { zh: "龙门石窟", en: "Longmen Grottoes" },
  { zh: "云冈石窟", en: "Yungang Grottoes" },
  { zh: "少林寺", en: "Shaolin Monastery" },
  { zh: "武当山", en: "Wudang Mountains" },
  { zh: "普陀山", en: "Mount Putuo" },
  { zh: "黄果树瀑布", en: "Huangguoshu Waterfall" },
  { zh: "泸沽湖", en: "Lugu Lake" },
  { zh: "大理古城", en: "Dali City" },
  { zh: "西双版纳", en: "Xishuangbanna Dai Autonomous Prefecture" },
  { zh: "喀纳斯湖", en: "Kanas Lake" },
  { zh: "青海湖", en: "Qinghai Lake" },
  { zh: "纳木错", en: "Namtso" },
  { zh: "珠穆朗玛峰", en: "Mount Everest" },
  { zh: "都江堰", en: "Dujiangyan" },
  { zh: "乐山大佛", en: "Leshan Giant Buddha" },
  { zh: "大三巴牌坊", en: "Ruins of Saint Paul's" },
  { zh: "维多利亚港", en: "Victoria Harbour" },
  { zh: "三亚亚龙湾", en: "Yalong Bay" },
  { zh: "苏州拙政园", en: "Humble Administrator's Garden" },
  { zh: "承德避暑山庄", en: "Chengde Mountain Resort" },
  { zh: "明十三陵", en: "Ming tombs" },
];

async function fetchThumbnailUrl(pageTitle) {
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
  if (!res.ok) throw new Error(`Wikipedia API HTTP ${res.status}`);
  const data = await res.json();
  const page = Object.values(data.query.pages)[0];
  if (page.missing) throw new Error(`missing page: ${pageTitle}`);
  const src = page.thumbnail?.source;
  if (!src) throw new Error(`no pageimage thumbnail: ${pageTitle}`);
  return src;
}

async function downloadImage(url, destPath) {
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      await sleep(2000 * Math.pow(2, attempt - 1));
    }
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "image/*,*/*;q=0.8",
        Referer: "https://en.wikipedia.org/",
      },
    });
    if (res.status === 429) {
      lastErr = new Error(`download HTTP 429`);
      continue;
    }
    if (!res.ok) throw new Error(`download HTTP ${res.status} ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    writeFileSync(destPath, buf);
    return;
  }
  throw lastErr ?? new Error(`download failed ${url}`);
}

async function main() {
  if (ATTRACTIONS.length !== TOTAL) {
    throw new Error(`ATTRACTIONS.length=${ATTRACTIONS.length}, expected ${TOTAL}`);
  }

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const projectRoot = join(__dirname, "..");
  const posterDir = join(projectRoot, "public/posters/china-attractions");
  const dataDir = join(projectRoot, "src/data");
  mkdirSync(posterDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });

  const lines = [];
  for (let i = 0; i < ATTRACTIONS.length; i++) {
    const { zh, en } = ATTRACTIONS[i];
    const n = String(i + 1).padStart(3, "0");
    const destPath = join(posterDir, `${n}.png`);
    process.stdout.write(`[${i + 1}/${TOTAL}] ${zh} (${en}) ... `);
    try {
      const thumb = await fetchThumbnailUrl(en);
      await downloadImage(thumb, destPath);
      lines.push(
        `    { name: ${JSON.stringify(zh)}, imageUrl: ${JSON.stringify(`/posters/china-attractions/${n}.png`)} },`
      );
      console.log("ok");
    } catch (e) {
      console.log("失败:", e.message);
      throw e;
    }
    await sleep(DELAY_MS);
  }

  const outPath = join(dataDir, "chinaAttractions40.generated.ts");
  const content = `/** 由 scripts/download-china-attractions-wiki.mjs 自动生成；图源：英文维基百科条目主图缩略图 */
import type { QuestionBankItem } from "../types";

export const CHINA_ATTRACTIONS_40_ITEMS: QuestionBankItem[] = [
${lines.join("\n")}
];
`;
  writeFileSync(outPath, content, "utf8");
  console.log(`\n完成 -> ${outPath}`);
  console.log(`海报目录: ${posterDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
