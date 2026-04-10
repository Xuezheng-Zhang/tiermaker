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

/**
 * 部署在 GitHub Pages 子路径（如 /tiermaker/）时，题库里的 /posters/... 必须带上 Vite base，
 * 否则浏览器会请求 github.io/posters/... 导致 404。
 */
function withViteBaseIfSiteRootPath(imageUrl: string): string {
  if (!imageUrl.startsWith("/") || imageUrl.startsWith("//")) return imageUrl;
  return `${import.meta.env.BASE_URL}${imageUrl.slice(1)}`;
}

export function resolvePosterImageUrl(imageUrl: string): string {
  if (!imageUrl) return imageUrl;
  const rooted = withViteBaseIfSiteRootPath(imageUrl);
  try {
    const u = new URL(rooted, typeof window !== "undefined" ? window.location.href : undefined);
    if (u.protocol !== "https:" && u.protocol !== "http:") return rooted;

    if (/^img\d+\.doubanio\.com$/i.test(u.hostname) && u.pathname.includes("/view/photo/")) {
      return `${apiOrigin()}/poster-proxy?u=${encodeURIComponent(rooted)}`;
    }

    if (
      u.hostname === "bkimg.cdn.bcebos.com" ||
      u.hostname === "upload.wikimedia.org" ||
      u.hostname === "images.pexels.com" ||
      u.hostname === "loremflickr.com"
    ) {
      return `${apiOrigin()}/image-proxy?u=${encodeURIComponent(rooted)}`;
    }

    return rooted;
  } catch {
    return rooted;
  }
}

/** 经本服务代理的图片（可设 crossOrigin 供 html2canvas 导出） */
export function isProxiedTierImage(src: string): boolean {
  return src.includes("/poster-proxy?") || src.includes("/image-proxy?");
}

/** @deprecated 使用 isProxiedTierImage */
export function isProxiedDoubanPoster(src: string): boolean {
  return isProxiedTierImage(src);
}

/**
 * 经 image-proxy 后不再直连 bkimg，一般无需 no-referrer。
 * 仍直连 bkimg 时（未启后端代理）避免 Referer 导致 403。
 */
export function imageReferrerPolicyForUrl(url: string): "no-referrer" | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (u.hostname === "bkimg.cdn.bcebos.com") return "no-referrer";
  } catch {
    /* ignore */
  }
  return undefined;
}
