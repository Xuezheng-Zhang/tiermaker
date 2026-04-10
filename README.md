# 从夯到拉生成器

一个受 Tier List 启发的网页小工具：从题库中选图，拖拽排行，支持**单机**与**多人实时联机**同步黑板，并可导出图片。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 在线体验

https://xuezheng-zhang.github.io/tiermaker/

## 功能一览

| 能力 | 说明 |
|------|------|
| 多题库 | 早餐、豆瓣 Top250、RYM 专辑、国旗、省份、景点、家常菜、[Bangumi](https://bangumi.tv) 热门日本番剧等 |
| 拖拽排行 | 触摸与鼠标拖拽，自动档位与排序 |
| 联机房间 | 创建 / 加入房间（5 位码），多人同步操作与进房提示 |
| 海报代理 | 豆瓣等受 Referer 限制的图片经后端代理加载；部分外链图同理 |
| 导出 | 基于 html-to-image 导出当前排行图为图片 |
| GitHub Actions | 可自动构建并发布到 GitHub Pages |

## 技术栈

- **前端**：React 19、TypeScript、Vite 7、Tailwind CSS 4
- **联机服务**：Node.js、Express 5、Socket.IO 4
- **其他**：html-to-image

## 本地运行

需要 **Node.js 20+**（建议）。

```bash
git clone https://github.com/Xuezheng-Zhang/tiermaker.git
cd tiermaker
npm ci
npm run dev
```

默认同时启动：

- 前端：<http://localhost:5173>
- 联机后端：<http://localhost:3001>（`server/index.js`）

仅前端预览构建：

```bash
npm run build
npm run preview
```

### 环境变量（可选）

| 变量 | 说明 |
|------|------|
| `VITE_SOCKET_URL` | 联机与图片代理的 API 根地址，例如 `http://localhost:3001`。生产构建时必须指向你的 **HTTPS** 后端 |

本地开发若不设置，前端会默认连接 `http://localhost:3001`。

后端默认端口：`PORT` 未设置时为 `3001`。

## 部署说明

### 前端（如 GitHub Pages）

仓库含 `.github/workflows/deploy-github-pages.yml`：**push 到 `main` / `master`** 可触发部署。

1. **Settings → Secrets → Actions** 中配置 `VITE_SOCKET_URL`（完整 URL，如 `https://你的服务.onrender.com`，勿只填 ID）。
2. **Settings → Pages** 将 **Source** 设为 **GitHub Actions**。
3. 项目页地址一般为 `https://<用户>.github.io/<仓库名>/`，构建时会自动设置 Vite `base`。

### 后端（如 Render / 自建）

- 类型选 **Web Service**，启动命令示例：`node server/index.js`。
- 确保前端 `VITE_SOCKET_URL` 指向该服务的 **https** 根地址。
- 免费实例可能休眠，首次连接或有冷启动延迟。

## 目录结构（简要）

```text
tiermaker/
├── src/                 # React 前端
├── server/              # Express + Socket.IO
├── public/posters/      # 本地题库配图（体积较大，可按需 clone）
├── scripts/             # 抓取、下载海报等维护脚本
└── .github/workflows/   # CI / GitHub Pages
```

## 题库维护脚本

部分题库数据由脚本生成，按需运行（详见 `package.json` 中 `scripts`）：

- `fetch:douban`、`download:douban` 等
- `fetch:bangumi-jp-tv-2026`：从 [Bangumi 榜单页](https://bangumi.tv/anime/browser/日本/tv/airtime/2026?sort=trends) 生成「热门日本番剧」前 100 条

## 开源与许可证

本项目以 **[MIT License](LICENSE)** 发布。

欢迎 **Issue / PR**；提交前可本地执行：

```bash
npm run lint
npm run build
```

## 致谢

题库与图片来自公开数据或按脚本抓取，版权归原作者所有；若用于二次发布请注意版权与使用条款。

---

**仓库**：[github.com/Xuezheng-Zhang/tiermaker](https://github.com/Xuezheng-Zhang/tiermaker)
