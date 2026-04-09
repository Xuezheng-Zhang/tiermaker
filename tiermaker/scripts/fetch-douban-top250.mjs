/**
 * 仅抓取列表与远程海报 URL（不下载图片到本地）。
 * 若要把海报存到 public/posters/douban/ 并生成本地路径，请用：
 *   npm run download:douban
 *
 * 运行: node scripts/fetch-douban-top250.mjs
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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
    return { name: mAltFirst[1].trim(), imageUrl: mAltFirst[2] };
  }
  const mSrcFirst = block.match(
    /<img[^>]+src="(https:\/\/img\d+\.doubanio\.com\/view\/photo\/s_ratio_poster\/public\/[^"]+)"[^>]+alt="([^"]*)"/
  );
  if (mSrcFirst) {
    return { name: mSrcFirst[2].trim(), imageUrl: mSrcFirst[1] };
  }
  return null;
}

function parseItems(html) {
  const items = [];
  const parts = html.split('<div class="item">');
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i];
    const it = extractPosterFromItemBlock(block);
    if (it && it.name && it.imageUrl) items.push(it);
  }
  return items;
}

async function main() {
  const all = [];
  for (let start = 0; start < 250; start += 25) {
    const html = await fetchPage(start);
    const pageItems = parseItems(html);
    all.push(...pageItems);
    if (pageItems.length === 0) {
      console.warn(`警告: start=${start} 未解析到条目，可能页面结构变化或被拦截`);
    }
    await new Promise((r) => setTimeout(r, 800));
  }

  const unique = [];
  const seen = new Set();
  for (const it of all) {
    const key = it.name + "|" + it.imageUrl;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(it);
  }

  if (unique.length < 200) {
    console.warn(`仅解析到 ${unique.length} 条，预期约 250 条`);
  }

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const outDir = join(__dirname, "../src/data");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "doubanTop250.generated.ts");

  const lines = unique.map((it) => {
    const name = JSON.stringify(it.name);
    const url = JSON.stringify(it.imageUrl);
    return `    { name: ${name}, imageUrl: ${url} },`;
  });

  const content = `/** 由 scripts/fetch-douban-top250.mjs 自动生成，请勿手改 */
import type { QuestionBankItem } from "../types";

export const DOUBAN_TOP250_ITEMS: QuestionBankItem[] = [
${lines.join("\n")}
];
`;

  writeFileSync(outPath, content, "utf8");
  console.log(`已写入 ${unique.length} 条 -> ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
