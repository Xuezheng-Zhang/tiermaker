/**
 * 抓取 Bangumi 网页榜单：日本 / TV / 2026 年 / 按「热度」排序，前 100 条。
 * 与 https://bangumi.tv/anime/browser/日本/tv/airtime/2026?sort=trends 一致（分页 ?page=2…）。
 * 封面使用 Bangumi CDN（https://lain.bgm.tv/...）。
 *
 * 运行: node scripts/fetch-bangumi-jp-tv-2026-heat.mjs
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const BASE =
  "https://bangumi.tv/anime/browser/%E6%97%A5%E6%9C%AC/tv/airtime/2026?sort=trends";
const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "bangumiJpTv2026Top100.generated.ts");

/** 从列表页 HTML 解析条目（顺序与页面一致） */
function parseBrowserPage(html) {
  const items = [];
  const re =
    /<a href="\/subject\/(\d+)" class="subjectCover[^"]*"[\s\S]*?<img src="(\/\/[^"]+)"[^>]*>[\s\S]*?<a href="\/subject\/\1" class="l">([^<]*)<\/a>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const id = m[1];
    let imageUrl = m[2].trim();
    if (imageUrl.startsWith("//")) imageUrl = `https:${imageUrl}`;
    const name = m[3].replace(/\s+/g, " ").trim();
    if (name && imageUrl) items.push({ id, name, imageUrl });
  }
  return items;
}

async function fetchPage(page) {
  const url = page <= 1 ? BASE : `${BASE}&page=${page}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

async function main() {
  const seen = new Set();
  const out = [];

  for (let page = 1; page <= 10 && out.length < 100; page++) {
    const html = await fetchPage(page);
    const chunk = parseBrowserPage(html);
    for (const it of chunk) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      out.push({ name: it.name, imageUrl: it.imageUrl });
      if (out.length >= 100) break;
    }
    if (chunk.length === 0) {
      console.warn(`警告: 第 ${page} 页未解析到条目，可能页面结构变化`);
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  if (out.length < 100) {
    console.warn(`警告: 共 ${out.length} 条（目标 100）`);
  }

  const lines = out.map(
    (it) => `    { name: ${JSON.stringify(it.name)}, imageUrl: ${JSON.stringify(it.imageUrl)} }`
  );

  const ts = `// 由 scripts/fetch-bangumi-jp-tv-2026-heat.mjs 生成
// 数据源：<https://bangumi.tv/anime/browser/日本/tv/airtime/2026?sort=trends>（番组计划）
import type { QuestionBankItem } from "../types";

export const BANGUMI_JP_TV_2026_TOP100_ITEMS: QuestionBankItem[] = [
${lines.join(",\n")},
];
`;
  writeFileSync(OUT, ts, "utf8");
  console.log(`已写入 ${out.length} 条 -> ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
