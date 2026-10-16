import { defineConfig, loadEnv } from 'vite';

const CACHE_VERSION = 'v20260717';

export default defineConfig(({ mode }) => {
  // 加载 .env 中所有变量（含非 VITE_ 前缀的 AI 密钥）注入 process.env，
  // 供下方 aiProxyDev 中间件与 netlify function 复用
  const env = loadEnv(mode, process.cwd(), '');
  Object.entries(env).forEach(([k, v]) => { if (!process.env[k]) process.env[k] = v; });

  // AI 推理代理（开发环境）：拦截 /api/ai/*，直接复用 netlify 云函数 handler，
  // 密钥从 .env 读取，前端零密钥。生产环境由 Netlify Functions 承接同一路由。
  const aiProxyDev = {
    name: 'ai-proxy-dev',
    configureServer(server) {
      server.middlewares.use('/api/ai', async (req, res) => {
        try {
          if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
          let body = '';
          for await (const chunk of req) body += chunk;
          // netlify function 在模块顶层读取 process.env，需在请求时动态导入
          const { handler } = await import('./netlify/functions/ai-proxy.mjs');
          const out = await handler({ httpMethod: req.method, path: '/api/ai' + (req.url || ''), body });
          res.statusCode = out.statusCode || 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(out.body);
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: 'AI代理异常: ' + (e.message || e) }));
        }
      });
      // M6a-2 密保找回密码云函数（开发环境）：拦截 /api/auth/*，复用 netlify 云函数 handler
      server.middlewares.use('/api/auth', async (req, res) => {
        try {
          if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
          let body = '';
          for await (const chunk of req) body += chunk;
          const { handler } = await import('./netlify/functions/auth-reset.mjs');
          const out = await handler({ httpMethod: req.method, path: '/api/auth' + (req.url || ''), body });
          res.statusCode = out.statusCode || 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(out.body);
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: '认证服务异常: ' + (e.message || e) }));
        }
      });
      // 方案B：作品发布即上云云函数（开发环境）：拦截 /api/sync-artwork
      // Storage RLS 不放行客户端直传，图片上传与入库统一由 service key 服务端承担
      server.middlewares.use('/api/sync-artwork', async (req, res) => {
        try {
          if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
          let body = '';
          for await (const chunk of req) body += chunk;
          const { handler } = await import('./netlify/functions/sync-artwork.mjs');
          const out = await handler({ httpMethod: req.method, path: '/api/sync-artwork' + (req.url || ''), body });
          res.statusCode = out.statusCode || 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(out.body);
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify({ error: '云端同步服务异常: ' + (e.message || e) }));
        }
      });
    }
  };

  return {
  plugins: [aiProxyDev],
  base: '/',

  // 开发服务器配置
  server: {
    port: 5173,
    open: true,
    // 代理配置：将 TTS 后端 API 请求转发到 Node.js 服务
    // /api/ai/* 优先于 /api/* 命中，转发到 Netlify dev 云函数（AI 推理代理）
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
        main: 'index.html',
        'ai-aesthetic': 'js/ai-aesthetic.js'
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
            './js/ai-tutor.js',
            './js/ai-assistant.js',
            './js/ai-inference.js',
            './js/ai-aesthetic.js',
            './js/ai-score-page.js',
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
  };
});
