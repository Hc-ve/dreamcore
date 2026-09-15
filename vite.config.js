import { defineConfig } from 'vite';

const CACHE_VERSION = 'v20260717';

export default defineConfig({
  plugins: [],
  base: '/',

  // 开发服务器配置
  server: {
    port: 5173,
    open: true,
    // 代理配置：将 TTS 后端 API 请求转发到 Node.js 服务
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      '/tts': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/tts/, '/api/tts')
      }
    }
  },

  // 构建配置
  build: {
    // 输出目录
    outDir: 'dist',
    // 生成 sourcemap 用于调试
    sourcemap: false,
    // chunk 大小警告阈值
    chunkSizeWarningLimit: 1500,
    // Rollup 选项：代码分割
    rollupOptions: {
      input: {
        main: 'index.html'
      },
      output: {
        // 代码分割：按功能模块分组
        manualChunks: {
          // 第三方库单独 chunk
          'vendor-three': ['three'],
          'vendor-gsap': ['gsap'],
          // 业务代码按功能分组
          'auth-group': [
            './js/auth.js',
            './js/profile.js',
            './js/notifications.js'
          ],
          'gallery-group': [
            './js/gallery.js',
            './js/artist.js',
            './js/interactions.js',
            './js/search.js',
            './js/share.js',
            './js/publish.js'
          ],
          'admin-group': [
            './js/admin.js'
          ],
          'ai-group': [
            './js/ai-assistant.js',
            './js/sound.js',
            './js/particles.js'
          ]
        },
        // chunk 文件命名规则
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
      }
    },
    // 压缩配置
    minify: 'esbuild',
    target: 'es2020'
  },

  // 依赖优化
  optimizeDeps: {
    include: ['three', 'gsap'],
    exclude: ['vite-plugin-pwa']
  },

  // CSS 配置
  css: {
    devSourcemap: true
  },

  // 静态资源处理
  assetsInclude: ['**/*.woff2', '**/*.woff', '**/*.ttf']
});
