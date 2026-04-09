/**
 * 慢速抓取豆瓣 Top250 列表，并逐张下载海报到 public/posters/douban/
 * 生成 src/data/doubanTop250.generated.ts（imageUrl 为本地路径 /posters/douban/xxx.jpg）
 *
 * 运行: node scripts/download-douban-posters.mjs
 *
 * 说明：请遵守豆瓣使用条款，仅供个人学习；请求间隔已加大，请勿改得过激。
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, extname } from "node:path";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DOUBAN_REFERER = "https://movie.douban.com/";

/** 翻页间隔（毫秒） */
const DELAY_PAGE_MS = 1500;
/** 每张海报下载间隔（毫秒） */
const DELAY_IMAGE_MS = 450;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchPage(start) {
  const url = `https://movie.douban.com/top250?start=${start}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

function extractPosterFromItemBlock(block) {
  const mAltFirst = block.match(
    /<img[^>]+alt="([^"]*)"[^>]+src="(https:\/\/img\d+\.doubanio\.com\/view\/photo\/s_ratio_poster\/public\/[^"]+)"/
  );
  if (mAltFirst) {
    return { name: mAltFirst[1].trim(), remoteUrl: mAltFirst[2] };
  }
  const mSrcFirst = block.match(
    /<img[^>]+src="(https:\/\/img\d+\.doubanio\.com\/view\/photo\/s_ratio_poster\/public\/[^"]+)"[^>]+alt="([^"]*)"/
  );
  if (mSrcFirst) {
    return { name: mSrcFirst[2].trim(), remoteUrl: mSrcFirst[1] };
  }
  return null;
}

function parseItems(html) {
  const items = [];
  const parts = html.split('<div class="item">');
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i];
    const it = extractPosterFromItemBlock(block);
    if (it && it.name && it.remoteUrl) items.push(it);
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
      Referer: DOUBAN_REFERER,
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
  const posterDir = join(projectRoot, "public/posters/douban");
  mkdirSync(posterDir, { recursive: true });

  const all = [];
  for (let start = 0; start < 250; start += 25) {
    process.stdout.write(`抓取列表页 start=${start} ... `);
    const html = await fetchPage(start);
    const pageItems = parseItems(html);
    all.push(...pageItems);
    console.log(`得到 ${pageItems.length} 条`);
    if (pageItems.length === 0) {
      console.warn(`警告: start=${start} 未解析到条目`);
    }
    await sleep(DELAY_PAGE_MS);
  }

  const unique = [];
  const seen = new Set();
  for (const it of all) {
    const key = it.name + "|" + it.remoteUrl;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(it);
  }

  if (unique.length < 200) {
    console.warn(`仅解析到 ${unique.length} 条，预期约 250 条`);
  }

  const dataDir = join(projectRoot, "src/data");
  mkdirSync(dataDir, { recursive: true });

  const lines = [];
  for (let i = 0; i < unique.length; i++) {
    const it = unique[i];
    const n = String(i + 1).padStart(3, "0");
    const tmpPath = join(posterDir, `${n}.jpg`);
    process.stdout.write(`[${i + 1}/${unique.length}] ${it.name} ... `);
    try {
      const savedPath = await downloadPoster(it.remoteUrl, tmpPath);
      const base = savedPath.split(/[/\\]/).pop();
      const webPath = `/posters/douban/${base}`;
      const nameJson = JSON.stringify(it.name);
      const urlJson = JSON.stringify(webPath);
      lines.push(`    { name: ${nameJson}, imageUrl: ${urlJson} },`);
      console.log("ok");
    } catch (e) {
      console.log("失败", e.message);
      const nameJson = JSON.stringify(it.name);
      lines.push(`    { name: ${nameJson}, imageUrl: ${JSON.stringify(it.remoteUrl)} }, // 下载失败，暂用远程`);
    }
    await sleep(DELAY_IMAGE_MS);
  }

  const outPath = join(dataDir, "doubanTop250.generated.ts");
  const content = `/** 由 scripts/download-douban-posters.mjs 自动生成；海报在 public/posters/douban/ */
import type { QuestionBankItem } from "../types";

export const DOUBAN_TOP250_ITEMS: QuestionBankItem[] = [
${lines.join("\n")}
];
`;

  writeFileSync(outPath, content, "utf8");
  console.log(`\n完成: ${unique.length} 条 -> ${outPath}`);
  console.log(`海报目录: ${posterDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
