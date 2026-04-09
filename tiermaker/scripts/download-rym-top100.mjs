/**
 * 抓取 RYM 风格「史上专辑榜」前 100 张，下载封面到 public/posters/rym/，
 * 并生成 src/data/rymTop100.generated.ts。
 *
 * 说明：
 * - https://rateyourmusic.com/charts/top/album/all-time/ 使用 Cloudflare，无法用简单 HTTP 抓取。
 * - 本脚本改为抓取 listchallenges.com 的「Rate Your Music's Top 1000 Albums」列表前 100 项
 *   （列表说明为 RYM 用户投票生成；数据快照较早，与官网当前排序可能不完全一致）。
 *
 * 运行: node scripts/download-rym-top100.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const LIST_BASE = "https://www.listchallenges.com/rate-your-musics-top-1000-albums";
const REFERER = "https://www.listchallenges.com/";

const DELAY_PAGE_MS = 900;
const DELAY_IMAGE_MS = 400;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function decodeEntities(s) {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchPage(pathSuffix) {
  const url = pathSuffix ? `${LIST_BASE}${pathSuffix}` : LIST_BASE;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      Referer: REFERER,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/** 从 img 标签属性串中取封面路径（含 lazy-load；部分条目为 /f/items-dl/） */
function extractItemImagePath(imgAttrs) {
  const ds = imgAttrs.match(/data-src="(\/f\/items(?:-dl)?\/[^"]+)"/);
  if (ds) return ds[1];
  const s = imgAttrs.match(/src="(\/f\/items(?:-dl)?\/[^"]+)"/);
  return s ? s[1] : null;
}

/** 解析一页中的条目：封面路径 + 专辑展示名（与 checklist 每行 item 块对应） */
function parseItems(html) {
  const items = [];
  const blockRe =
    /<div class="item (?:even|odd)"[^>]*>[\s\S]*?<div class="item-image-wrapper">[\s\S]*?<img([^>]+)\/>[\s\S]*?<div class="item-name">([^<]*)<\/div>/g;
  let m;
  while ((m = blockRe.exec(html)) !== null) {
    const remotePath = extractItemImagePath(m[1]);
    if (!remotePath) continue;
    items.push({
      remotePath,
      name: decodeEntities(m[2].trim()),
    });
  }
  return items;
}

function guessExt(remoteUrl, contentType) {
  const fromPath = extname(new URL(remoteUrl).pathname).toLowerCase();
  if (fromPath === ".jpg" || fromPath === ".jpeg" || fromPath === ".webp" || fromPath === ".png") {
    return fromPath === ".jpeg" ? ".jpg" : fromPath;
  }
  if (contentType?.includes("webp")) return ".webp";
  if (contentType?.includes("png")) return ".png";
  return ".jpg";
}

async function downloadPoster(remoteUrl, destPath) {
  const res = await fetch(remoteUrl, {
    headers: {
      "User-Agent": UA,
      Referer: LIST_BASE,
      Accept: "image/*,*/*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`poster HTTP ${res.status} ${remoteUrl}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type") || "";
  const ext = guessExt(remoteUrl, ct);
  const finalPath = destPath.replace(/\.(jpg|jpeg|webp|png)$/i, "") + ext;
  writeFileSync(finalPath, buf);
  return finalPath;
}

async function main() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const projectRoot = join(__dirname, "..");
  const posterDir = join(projectRoot, "public/posters/rym");
  mkdirSync(posterDir, { recursive: true });

  const pages = ["", "/list/2", "/list/3"];
  const all = [];
  for (const suf of pages) {
    process.stdout.write(`抓取列表 ${suf || "/"} ... `);
    const html = await fetchPage(suf);
    const pageItems = parseItems(html);
    console.log(`${pageItems.length} 条`);
    all.push(...pageItems);
    await sleep(DELAY_PAGE_MS);
  }

  const top100 = all.slice(0, 100);
  if (top100.length < 100) {
    throw new Error(`仅解析到 ${top100.length} 条，需要 100 条`);
  }

  const dataDir = join(projectRoot, "src/data");
  mkdirSync(dataDir, { recursive: true });

  const lines = [];
  for (let i = 0; i < top100.length; i++) {
    const it = top100[i];
    const remoteUrl = new URL(it.remotePath, LIST_BASE).href;
    const n = String(i + 1).padStart(3, "0");
    const tmpPath = join(posterDir, `${n}.jpg`);
    process.stdout.write(`[${i + 1}/100] ${it.name} ... `);
    try {
      const savedPath = await downloadPoster(remoteUrl, tmpPath);
      const base = savedPath.split(/[/\\]/).pop();
      const webPath = `/posters/rym/${base}`;
      lines.push(`    { name: ${JSON.stringify(it.name)}, imageUrl: ${JSON.stringify(webPath)} },`);
      console.log("ok");
    } catch (e) {
      console.log("失败", e.message);
      lines.push(
        `    { name: ${JSON.stringify(it.name)}, imageUrl: ${JSON.stringify(remoteUrl)} }, // 下载失败，暂用远程`
      );
    }
    await sleep(DELAY_IMAGE_MS);
  }

  const outPath = join(dataDir, "rymTop100.generated.ts");
  const content = `/** 由 scripts/download-rym-top100.mjs 自动生成；海报在 public/posters/rym/
 * 数据来源：listchallenges「RYM Top 1000」前 100 项（RYM 站受 Cloudflare 保护时可用此脚本更新）
 */
import type { QuestionBankItem } from "../types";

export const RYM_TOP100_ITEMS: QuestionBankItem[] = [
${lines.join("\n")}
];
`;
  writeFileSync(outPath, content, "utf8");
  console.log(`\n完成: 100 条 -> ${outPath}`);
  console.log(`海报目录: ${posterDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
