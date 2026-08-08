import { defineCollection } from 'astro:content';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { docsVersionsLoader } from 'starlight-versions/loader';

export const collections = {
	docs: defineCollection({ loader: docsLoader(), schema: docsSchema() }),
	// 归档版本集合（starlight-versions 插件）
	versions: defineCollection({ loader: docsVersionsLoader() }),
	// 用户 UI 翻译覆盖（src/content/i18n/*.json），
	// Starlight 通过 getCollection('i18n') 加载，必须用官方 i18nLoader 注册
	i18n: defineCollection({ loader: i18nLoader() }),
};
