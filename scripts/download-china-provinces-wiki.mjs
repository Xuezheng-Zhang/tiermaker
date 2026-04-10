/**
 * 从维基共享资源下载中国 34 个省级行政区示意地图（* locator map (China).svg）的 PNG 缩略图，
 * 写入 public/posters/china-provinces/，并生成 src/data/chinaProvinces34.generated.ts
 *
 * 图源：https://commons.wikimedia.org （与中文维基条目常用配图一致）
 * 运行: node scripts/download-china-provinces-wiki.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const UA =
  "TierMaker/1.0 (https://github.com/local/tiermaker; educational; China province maps from Wikimedia Commons API)";

const DELAY_MS = 1200;
const TOTAL = 34;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** 中文全称 + 共享资源 File: 标题 */
const PROVINCES = [
  { zh: "北京市", file: "File:Beijing locator map (China).svg" },
  { zh: "天津市", file: "File:Tianjin locator map (China).svg" },
  { zh: "河北省", file: "File:Hebei locator map (China).svg" },
  { zh: "山西省", file: "File:Shanxi locator map (China).svg" },
  { zh: "内蒙古自治区", file: "File:Inner Mongolia locator map (China).svg" },
  { zh: "辽宁省", file: "File:Liaoning locator map (China).svg" },
  { zh: "吉林省", file: "File:Jilin locator map (China).svg" },
  { zh: "黑龙江省", file: "File:Heilongjiang locator map (China).svg" },
  { zh: "上海市", file: "File:Shanghai locator map (China).svg" },
  { zh: "江苏省", file: "File:Jiangsu locator map (China).svg" },
  { zh: "浙江省", file: "File:Zhejiang locator map (China).svg" },
  { zh: "安徽省", file: "File:Anhui locator map (China).svg" },
  { zh: "福建省", file: "File:Fujian locator map (China).svg" },
  { zh: "江西省", file: "File:Jiangxi locator map (China).svg" },
  { zh: "山东省", file: "File:Shandong locator map (China).svg" },
  { zh: "河南省", file: "File:Henan locator map (China).svg" },
  { zh: "湖北省", file: "File:Hubei locator map (China).svg" },
  { zh: "湖南省", file: "File:Hunan locator map (China).svg" },
  { zh: "广东省", file: "File:Guangdong locator map (China).svg" },
  { zh: "广西壮族自治区", file: "File:Guangxi locator map (China).svg" },
  { zh: "海南省", file: "File:Hainan locator map (China).svg" },
  { zh: "重庆市", file: "File:Chongqing locator map (China).svg" },
  { zh: "四川省", file: "File:Sichuan locator map (China).svg" },
  { zh: "贵州省", file: "File:Guizhou locator map (China).svg" },
  { zh: "云南省", file: "File:Yunnan locator map (China).svg" },
  { zh: "西藏自治区", file: "File:Tibet locator map (China).svg" },
  { zh: "陕西省", file: "File:Shaanxi locator map (China).svg" },
  { zh: "甘肃省", file: "File:Gansu locator map (China).svg" },
  { zh: "青海省", file: "File:Qinghai locator map (China).svg" },
  { zh: "宁夏回族自治区", file: "File:Ningxia locator map (China).svg" },
  { zh: "新疆维吾尔自治区", file: "File:Xinjiang locator map (China).svg" },
  { zh: "香港特别行政区", file: "File:China Hong Kong 4 levels localisation.svg" },
  { zh: "澳门特别行政区", file: "File:Macau in China (zoomed).svg" },
  { zh: "台湾省", file: "File:China Taiwan Locator.svg" },
];

async function fetchThumbUrl(fileTitle) {
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
  if (!res.ok) throw new Error(`Commons API HTTP ${res.status}`);
  const data = await res.json();
  const page = Object.values(data.query.pages)[0];
  if (page.missing) throw new Error(`missing: ${fileTitle}`);
  const ii = page.imageinfo?.[0];
  const thumb = ii?.thumburl || ii?.url;
  if (!thumb) throw new Error(`no imageinfo: ${fileTitle}`);
  return thumb;
}

async function downloadImage(url, destPath) {
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      const wait = 2000 * Math.pow(2, attempt - 1);
      await sleep(wait);
    }
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "image/*,*/*;q=0.8",
        Referer: "https://commons.wikimedia.org/",
      },
    });
    if (res.status === 429) {
      lastErr = new Error(`download HTTP 429 ${url}`);
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
  if (PROVINCES.length !== TOTAL) {
    throw new Error(`PROVINCES.length=${PROVINCES.length}, expected ${TOTAL}`);
  }

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const projectRoot = join(__dirname, "..");
  const posterDir = join(projectRoot, "public/posters/china-provinces");
  const dataDir = join(projectRoot, "src/data");
  mkdirSync(posterDir, { recursive: true });
  mkdirSync(dataDir, { recursive: true });

  const lines = [];
  for (let i = 0; i < PROVINCES.length; i++) {
    const { zh, file } = PROVINCES[i];
    const n = String(i + 1).padStart(3, "0");
    const destPath = join(posterDir, `${n}.png`);
    process.stdout.write(`[${i + 1}/${TOTAL}] ${zh} ... `);
    try {
      const thumb = await fetchThumbUrl(file);
      await downloadImage(thumb, destPath);
      lines.push(
        `    { name: ${JSON.stringify(zh)}, imageUrl: ${JSON.stringify(`/posters/china-provinces/${n}.png`)} },`
      );
      console.log("ok");
    } catch (e) {
      console.log("失败:", e.message);
      throw e;
    }
    await sleep(DELAY_MS);
  }

  const outPath = join(dataDir, "chinaProvinces34.generated.ts");
  const content = `/** 由 scripts/download-china-provinces-wiki.mjs 自动生成；图源：维基共享资源中国省级行政区 locator map */
import type { QuestionBankItem } from "../types";

export const CHINA_PROVINCES_34_ITEMS: QuestionBankItem[] = [
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
