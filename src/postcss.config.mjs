// PostCSS 配置：替代 @astrojs/tailwind 集成（该包不支持 Astro 7）
// 站点在首页通过 `import '../styles/tailwind.css'` 引入 Tailwind 样式
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
