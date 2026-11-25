import { defineConfig } from 'vite';

// GitHub Pages 배포 시 GitHub Actions 가 BASE_PATH 를 "/<저장소이름>/" 으로 주입한다.
// 로컬 개발/미리보기에서는 상대 경로("./")를 사용하므로 어떤 하위 경로에서도 동작한다.
export default defineConfig({
  base: process.env.BASE_PATH || './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 4096,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: { three: ['three'] },
      },
    },
  },
  server: { host: true, port: 5173 },
});
