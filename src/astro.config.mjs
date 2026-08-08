// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import starlightVersions from 'starlight-versions';

// https://astro.build/config
export default defineConfig({
	site: 'https://micake.github.io',
	integrations: [
		sitemap(),
		react(),
		// Tailwind 通过 PostCSS 集成（见 postcss.config.mjs），
		// 不再使用 @astrojs/tailwind（不支持 Astro 7）
		starlight({
			title: 'MiCake',
			logo: {
				src: './src/assets/houston.webp',
			},
			defaultLocale: 'root',
			locales: {
				root: {
					label: '简体中文',
					lang: 'zh-CN',
				},
				en: {
					label: 'English',
					lang: 'en',
				},
			},
			plugins: [
				// 文档版本化：当前文档为最新版，归档版本见 versions 数组
				// 新增版本流程：1) 在 versions 数组加新 slug 2) 启动 dev 自动归档当前版
				starlightVersions({
					current: { label: 'v11.0.0-preview' },
					versions: [
						{ slug: '10.0.0', label: 'v10.0.0' },
					],
				}),
			],
			social: [
				{ icon: 'github', label: 'GitHub', href: 'https://github.com/MiCake/MiCake' }
			],
			editLink: {
				baseUrl: 'https://github.com/MiCake/MiCakeDoc/edit/main/src/',
			},
			customCss: [
				'./src/styles/custom.css',
			],
			components: {
				EditLink: './src/components/EditLink.astro',
			},
			expressiveCode: {
				themes: ['github-dark', 'github-light'],
				styleOverrides: {
					borderRadius: '0.5rem',
					borderWidth: '2px',
				},
			},
			sidebar: [
				{
					label: '开始使用',
					translations: { en: 'Getting Started' },
					items: [
						{ label: 'MiCake 简介', translations: { en: 'MiCake Introduction' }, slug: 'getting-started/introduction' },
						{ label: '快速开始', translations: { en: 'Quick Start' }, slug: 'getting-started/quick-start' },
						{ label: '现有项目集成', translations: { en: 'Integrating with an Existing Project' }, slug: 'getting-started/from-custom' },
						{ label: '核心概念', translations: { en: 'Core Concepts' }, slug: 'getting-started/core-concepts' },
					],
				},
				{
					label: '升级指南',
					translations: { en: 'Upgrade Guide' },
					items: [
						{ label: 'v10 → v11 迁移指南', translations: { en: 'v10 → v11 Migration Guide' }, slug: 'migration/v10-to-v11' },
					],
				},
				{
					label: '领域驱动设计',
					translations: { en: 'Domain-Driven Design' },
					items: [
						{ label: '实体', translations: { en: 'Entity' }, slug: 'domain-driven/entity' },
						{ label: '值对象', translations: { en: 'Value Object' }, slug: 'domain-driven/value-object' },
						{ label: '聚合根', translations: { en: 'Aggregate Root' }, slug: 'domain-driven/aggregate-root' },
						{ label: '仓储', translations: { en: 'Repository' }, slug: 'domain-driven/repository' },
						{ label: '领域事件', translations: { en: 'Domain Events' }, slug: 'domain-driven/domain-event' },
						{ label: '领域服务', translations: { en: 'Domain Service' }, slug: 'domain-driven/domain-service' },
						{ label: '工作单元', translations: { en: 'Unit of Work' }, slug: 'domain-driven/unit-of-work' },
					],
				},
				{
					label: '模块化',
					translations: { en: 'Modularity' },
					items: [
						{ label: '模块使用', translations: { en: 'Module Usage' }, slug: 'modularity/module-usage' },
					],
				},
				{
					label: '依赖注入',
					translations: { en: 'Dependency Injection' },
					slug: 'dependency-injection',
				},
				{
					label: '异常处理',
					translations: { en: 'Exception Handling' },
					slug: 'exception',
				},
				{
					label: '统一返回',
					translations: { en: 'Unified Response' },
					items: [
						{ label: '统一返回格式', translations: { en: 'Unified Response Format' }, slug: 'unified-response/overview' },
					],
				},
				{
					label: 'API 日志',
					translations: { en: 'API Logging' },
					items:[
						{ label: '记录API请求日志', translations: { en: 'Logging API Requests' }, slug: 'api-logging/api-log-usage' },
					]

				},
				{
					label: '自动审计',
					translations: { en: 'Automatic Audit' },
					slug: 'audit',
				},
				{
					label: '软删除支持',
					translations: { en: 'Soft Delete Support' },
					slug: 'soft-delete',
				},
				{
					label: '工具集',
					translations: { en: 'Utilities' },
					items: [
						{ label: '工具集概览', translations: { en: 'Utilities Overview' }, slug: 'utilities/overview' },
						{
							label: '缓存',
							translations: { en: 'Cache' },
							items: [
								{ label: 'BoundedLruCache', slug: 'utilities/cache/bounded-lru-cache' },
							],
						},
						{ label: '类型转换', translations: { en: 'Type Conversion' }, slug: 'utilities/converter' },
						{ label: '动态查询', translations: { en: 'Dynamic Query' }, slug: 'utilities/query' },
						{ label: '熔断器', translations: { en: 'Circuit Breaker' }, slug: 'utilities/resilience' },
						{ label: '数据存储池', translations: { en: 'Data Storage Pool' }, slug: 'utilities/storage' },
					],
				},
			],
		}),
	],
});
