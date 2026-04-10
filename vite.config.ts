import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages 项目站为 /<仓库名>/，构建时设置环境变量 VITE_BASE_PATH=/<仓库名>/
// 本地开发不设该变量，默认为 /
export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react(), tailwindcss()],
})
