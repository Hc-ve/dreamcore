/** @type {import('tailwindcss').Config} */
// ============================================================
// Tailwind CSS 配置（S0-01 工单接入）
// 共存原则：
// 1) preflight 关闭（corePlugins.preflight:false），不输出重置样式，
//    避免破坏 css/style.css 现有页面样式（协作规范5.2强制要求）；
// 2) important:false，Tailwind 工具类不提升优先级，不覆盖原有样式；
// 3) 不设置 prefix，新页面直接使用工具类；样式边界通过"新模块仅在
//    js/camera、js/composition、js/photo-edit 及新页面使用"保证；
// 4) dream 色板：暗色霓虹色取自实施说明书（#0a0612/#9d6cff/#ff6ec7/#00e5ff），
//    soft 柔色直接映射现有 CSS 变量，保持与 Dreamcore 设计系统一致。
// ============================================================
export default {
  // 扫描范围：仅项目源码，不扫描 node_modules 与 dist 构建产物
  content: [
    './index.html',
    './*.html',
    './js/**/*.js',
    './data/**/*.js',
    './css/**/*.css'
  ],
  // Tailwind 默认 dark: 变体跟随现有暗色主题标记 data-theme="dark"
  darkMode: ['selector', '[data-theme="dark"]'],
  // 不提升工具类优先级，确保不覆盖原生 CSS
  important: false,
  corePlugins: {
    // 关键：关闭 preflight 重置样式表，与现有原生 CSS 无缝共存
    preflight: false
  },
  theme: {
    extend: {
      colors: {
        // Dreamcore 暗色主题霓虹主色（新模块主用，支持透明度修饰符）
        dream: {
          dark: '#0a0612',
          purple: '#9d6cff',
          pink: '#ff6ec7',
          cyan: '#00e5ff',
          // 柔色映射现有 CSS 变量（随明暗主题自动切换，不支持透明度修饰符）
          'pink-soft': 'var(--dream-pink)',
          'purple-soft': 'var(--dream-purple)',
          'blue-soft': 'var(--dream-blue)',
          'mint-soft': 'var(--dream-mint)',
          'gold-soft': 'var(--dream-gold)'
        }
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans SC"', 'system-ui', 'sans-serif'],
        serif: ['"Cormorant Garamond"', '"Noto Serif SC"', 'serif']
      },
      borderRadius: {
        dream: '1.25rem'
      },
      backdropBlur: {
        dream: '16px'
      }
    }
  },
  plugins: []
};
