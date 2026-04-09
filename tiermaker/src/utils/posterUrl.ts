/**
 * 豆瓣海报 CDN 会校验 Referer：从 localhost / 第三方站点直接嵌图会 403/418。
 * 通过联机服务同源代理转发，并在请求头带 movie.douban.com 的 Referer。
 */
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3001";

function apiOrigin(): string {
  try {
    return new URL(SOCKET_URL).origin;
  } catch {
    return "http://localhost:3001";
  }
}

export function resolvePosterImageUrl(imageUrl: string): string {
  if (!imageUrl) return imageUrl;
  try {
    const u = new URL(imageUrl);
    if (!/^img\d+\.doubanio\.com$/i.test(u.hostname)) return imageUrl;
    if (!u.pathname.includes("/view/photo/")) return imageUrl;
    if (u.protocol !== "https:" && u.protocol !== "http:") return imageUrl;
    return `${apiOrigin()}/poster-proxy?u=${encodeURIComponent(imageUrl)}`;
  } catch {
    return imageUrl;
  }
}

export function isProxiedDoubanPoster(src: string): boolean {
  return src.includes("/poster-proxy?");
}
