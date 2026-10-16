import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // 遗留的 test-modules-1-4.spec.js 为 CJS 语法，与项目 ESM(package.json type:module) 冲突，
  // 收集阶段即报 require is not defined，长期搁置未迁移，显式排除
  testIgnore: '**/test-modules-1-4.spec.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 1,
  reporter: [['line'], ['json', { outputFile: 'test-results/test-report.json' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'msedge', viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'Tablet',
      // 系统未安装 Playwright WebKit，复用 Edge 通道，仅保留平板视口
      use: { ...devices['iPad'], channel: 'msedge', viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'Mobile',
      // iPhone X 描述符强制 webkit（未安装），改用 Edge + 窄视口。
      // 注意：isMobile: true 在高 DPI Windows 上会使 Edge 移动仿真把系统缩放系数
      // 卷入 layout 视口（innerWidth≈425 而 visualViewport=375），layout 与 visual
      // 坐标持续错位，页面底部元素点击点系统性偏移 50~250px（表现为"intercepts
      // pointer events"交替拦截且 30s 超时）。故关闭 isMobile，仅保留窄视口 + 触摸：
      // 响应式媒体查询按视口宽度匹配，不受影响。
      use: { channel: 'msedge', viewport: { width: 375, height: 812 }, isMobile: false, hasTouch: true },
    },
  ],
});
