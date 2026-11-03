import { defineConfig } from 'vitepress'
import { exampleSnippet } from './example-snippet'

// 部署到 GitHub Pages 的项目页时设 DOCS_BASE=/sapling2d/
const base = process.env.DOCS_BASE ?? '/'

export default defineConfig({
  lang: 'zh-CN',
  title: 'sapling2d',
  description: 'Code-first、对 agent 友好的 2D 游戏引擎：Godot 风格的节点树，PixiJS 渲染，planck.js 物理，浏览器和微信小游戏一份代码。',
  base,
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ['README.md'],

  markdown: {
    config: (md) => md.use(exampleSnippet),
  },
  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: '功能', link: '/features/sprite-label', activeMatch: '/features/' },
      { text: '平台', link: '/platforms/wechat', activeMatch: '/platforms/' },
      { text: '和 AI 一起开发', link: '/ai' },
    ],

    sidebar: [
      {
        text: '开始',
        items: [
          { text: '快速开始', link: '/guide/getting-started' },
          { text: '核心概念', link: '/guide/concepts' },
          { text: '无头测试', link: '/guide/testing' },
        ],
      },
      {
        text: '功能',
        items: [
          { text: '贴图与文字', link: '/features/sprite-label' },
          { text: '信号', link: '/features/signals' },
          { text: '输入', link: '/features/input' },
          { text: '物理与碰撞', link: '/features/physics' },
          { text: '相机', link: '/features/camera' },
        ],
      },
      {
        text: '平台',
        items: [{ text: '微信小游戏', link: '/platforms/wechat' }],
      },
      {
        text: '更多',
        items: [{ text: '和 AI 一起开发', link: '/ai' }],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/sapling2d/sapling2d' }],

    editLink: {
      pattern: 'https://github.com/sapling2d/sapling2d/edit/main/website/:path',
      text: '在 GitHub 上编辑此页',
    },

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
          modal: {
            noResultsText: '没有找到',
            resetButtonTitle: '清除',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' },
          },
        },
      },
    },

    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一页', next: '下一页' },
    lastUpdated: { text: '最后更新' },
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色',
    darkModeSwitchTitle: '切换到深色',

    footer: {
      message: 'MIT 许可证',
    },
  },
})
