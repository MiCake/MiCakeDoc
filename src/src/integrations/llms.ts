// AI 可读文档（llms.txt / llms-zh.txt）的共享生成逻辑
// 分组与顺序与 starlight sidebar 保持一致，新增文档时在 DOC_GROUPS 中补充即可
// 多语言：默认英文优先 —— 存在 en/{slug} 时使用英文文档，否则回退到中文原文
import fs from 'fs';
import path from 'path';
import { getCollection } from 'astro:content';

export const SITE_URL = 'https://micake.github.io';

/** 文档语言：en = 英文（缺失时回退中文）；zh = 仅中文 */
export type DocLocale = 'en' | 'zh';

/** 英文目录前缀（Starlight i18n 约定：src/content/docs/en/） */
export const EN_PREFIX = 'en/';

/** 分组中文标签 -> 英文标签（与 DOC_GROUPS 一一对应） */
export const EN_GROUP_LABELS: Record<string, string> = {
	'开始使用': 'Getting Started',
	'领域驱动设计': 'Domain-Driven Design',
	'模块化': 'Modularity',
	'依赖注入': 'Dependency Injection',
	'异常处理': 'Exception Handling',
	'统一返回': 'Unified Response',
	'API 日志': 'API Logging',
	'自动审计': 'Auto Audit',
	'软删除支持': 'Soft Delete',
	'工具集': 'Utilities',
	'其他': 'Others',
};

/** 按语言取分组标签 */
export function groupLabel(label: string, locale: DocLocale): string {
	return locale === 'en' ? EN_GROUP_LABELS[label] ?? label : label;
}

/**
 * 文档原始 Markdown URL（面向 AI，与 UI 页面相对）
 * 英文文档：/api/raw-markdown/en/{id}.txt；中文文档：/api/raw-markdown/{id}.txt
 * .txt 后缀确保 GitHub Pages 以 text/plain 提供（浏览器直接显示而非下载）
 */
export function docRawUrl(doc: Pick<DocEntry, 'id' | 'locale'>): string {
	return `${SITE_URL}/api/raw-markdown/${doc.locale === 'en' ? `${EN_PREFIX}` : ''}${doc.id}.txt`;
}

export interface DocGroup {
	label: string;
	/** slug 列表，顺序与 starlight sidebar 一致 */
	order: string[];
}

/** 文档分组配置（与 astro.config.mjs 中的 sidebar 保持一致） */
export const DOC_GROUPS: DocGroup[] = [
	{
		label: '开始使用',
		order: [
			'getting-started/introduction',
			'getting-started/quick-start',
			'getting-started/from-custom',
			'getting-started/core-concepts',
		],
	},
	{
		label: '领域驱动设计',
		order: [
			'domain-driven/entity',
			'domain-driven/value-object',
			'domain-driven/aggregate-root',
			'domain-driven/repository',
			'domain-driven/domain-event',
			'domain-driven/domain-service',
			'domain-driven/unit-of-work',
		],
	},
	{
		label: '模块化',
		order: ['modularity/module-usage'],
	},
	{
		label: '依赖注入',
		order: ['dependency-injection'],
	},
	{
		label: '异常处理',
		order: ['exception'],
	},
	{
		label: '统一返回',
		order: ['unified-response/overview'],
	},
	{
		label: 'API 日志',
		order: ['api-logging/api-log-usage'],
	},
	{
		label: '自动审计',
		order: ['audit'],
	},
	{
		label: '软删除支持',
		order: ['soft-delete'],
	},
	{
		label: '工具集',
		order: [
			'utilities/overview',
			'utilities/cache/bounded-lru-cache',
			'utilities/converter',
			'utilities/query',
			'utilities/resilience',
			'utilities/storage',
		],
	},
];

export interface DocEntry {
	/** slug，如 getting-started/introduction（不含语言前缀） */
	id: string;
	/** 实际选用的语言：en 表示使用了英文翻译，zh 表示回退到中文原文 */
	locale: DocLocale;
	title: string;
	description?: string;
	/** 原始 Markdown 正文（不含 frontmatter） */
	body: string;
}

/** 获取全部文档（按 sidebar 顺序）。locale='en' 时英文优先、中文兜底；'zh' 时仅中文 */
export async function getAllDocs(locale: DocLocale = 'en'): Promise<DocEntry[]> {
	const collection = await getCollection('docs');

	const zhBySlug = new Map<string, (typeof collection)[number]>();
	const enBySlug = new Map<string, (typeof collection)[number]>();
	for (const entry of collection) {
		if (entry.id.startsWith(EN_PREFIX)) {
			enBySlug.set(entry.id.slice(EN_PREFIX.length), entry);
		} else {
			zhBySlug.set(entry.id, entry);
		}
	}

	/** 按语言优先级选取单个文档 */
	const pick = (slug: string): DocEntry | null => {
		let entry = locale === 'en' ? enBySlug.get(slug) : undefined;
		let docLocale: DocLocale = 'en';
		if (!entry) {
			entry = zhBySlug.get(slug);
			docLocale = 'zh';
		}
		if (!entry) return null;
		return {
			id: slug,
			locale: docLocale,
			title: entry.data.title || slug,
			description: entry.data.description,
			body: readBody(slug, docLocale),
		};
	};

	// 按 DOC_GROUPS 中的顺序输出，未配置的文档排最后
	const order = DOC_GROUPS.flatMap((g) => g.order);
	const used = new Set<string>();
	const docs: DocEntry[] = [];

	for (const slug of order) {
		const doc = pick(slug);
		if (doc) {
			docs.push(doc);
			used.add(slug);
		}
	}

	// 未在 DOC_GROUPS 中配置的文档（中英文都算，英文优先），按 slug 排序排在最后
	const extraSlugs = new Set<string>();
	for (const entry of collection) {
		const slug = entry.id.startsWith(EN_PREFIX) ? entry.id.slice(EN_PREFIX.length) : entry.id;
		if (!used.has(slug) && !order.includes(slug)) extraSlugs.add(slug);
	}
	for (const slug of [...extraSlugs].sort()) {
		const doc = pick(slug);
		if (doc) docs.push(doc);
	}

	return docs;
}

/** 读取文档正文（不含 frontmatter） */
function readBody(id: string, locale: DocLocale): string {
	const basePath = path.join(process.cwd(), 'src', 'content', 'docs');
	const rel = locale === 'en' ? path.join(EN_PREFIX, id) : id;
	for (const ext of ['.md', '.mdx']) {
		const filePath = path.join(basePath, rel + ext);
		if (fs.existsSync(filePath)) {
			const content = fs.readFileSync(filePath, 'utf-8');
			// 去除 frontmatter
			return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');
		}
	}
	return '';
}

/** 将文档按分组输出（含未配置的文档，自动归入 "其他"） */
export function groupDocs(docs: DocEntry[]): { label: string; items: DocEntry[] }[] {
	const groups: { label: string; items: DocEntry[] }[] = DOC_GROUPS.map((g) => ({
		label: g.label,
		items: [],
	}));

	const known = new Set<string>();
	const byId = new Map(docs.map((d) => [d.id, d]));

	DOC_GROUPS.forEach((g, i) => {
		for (const id of g.order) {
			const doc = byId.get(id);
			if (doc) {
				groups[i].items.push(doc);
				known.add(id);
			}
		}
	});

	const extras = docs.filter((d) => !known.has(d.id));
	if (extras.length > 0) {
		const extraGroups = new Map<string, DocEntry[]>();
		for (const doc of extras) {
			const label = doc.id.includes('/') ? doc.id.split('/')[0] : '其他';
			if (!extraGroups.has(label)) extraGroups.set(label, []);
			extraGroups.get(label)!.push(doc);
		}
		for (const [label, items] of extraGroups) {
			groups.push({ label, items });
		}
	}

	return groups.filter((g) => g.items.length > 0);
}

/** 生成 llms.txt（站点导航索引，供 AI 发现文档） */
export function generateLlmsTxt(docs: DocEntry[], locale: DocLocale = 'en'): string {
	const lines: string[] = [];
	const isEn = locale === 'en';

	lines.push('# MiCake');
	lines.push('');
	if (isEn) {
		lines.push(
			'> MiCake is a lightweight .NET Domain-Driven Design (DDD) toolkit that provides entities, value objects, aggregate roots, repositories, domain events, unit of work, and other infrastructure support.',
		);
		lines.push('');
		lines.push('This file is the AI-readable navigation index of the MiCake official documentation site.');
		lines.push('The site also serves as the online knowledge base of the MiCake framework - AI agents may consult it when answering questions about MiCake.');
		lines.push('Content is English-first: English translations are used whenever available; otherwise the Chinese original is included as a fallback.');
	} else {
		lines.push(
			'> MiCake 是一个轻量级的 .NET 领域驱动设计（DDD）工具包，提供实体、值对象、聚合根、仓储、领域事件、工作单元等基础设施支持。',
		);
		lines.push('');
		lines.push('本文件是 MiCake 官方文档站的 AI 可读导航索引，列出了全部文档。');
		lines.push('该站点也是 MiCake 框架的在线知识库，可供 AI 在回答 MiCake 相关问题时代为查阅。');
	}
	lines.push('');
	lines.push(isEn ? '## Documentation Index' : '## 文档导航');
	lines.push('');

	for (const group of groupDocs(docs)) {
		lines.push(`### ${groupLabel(group.label, locale)}`);
		lines.push('');
		for (const doc of group.items) {
			const desc = doc.description ? ` - ${doc.description}` : '';
			// 面向 AI：链接直接指向原始 Markdown，而非 UI 页面
			lines.push(`- [${doc.title}](${docRawUrl(doc)})${desc}`);
		}
		lines.push('');
	}

	lines.push(isEn ? '## Reading Guide for AI' : '## 给 AI 的读取指引');
	lines.push('');
	if (isEn) {
		lines.push('- Each link above points directly to the raw Markdown source of the document.');
		lines.push('- Fetch docs on demand instead of downloading everything at once: `https://micake.github.io/api/raw-markdown/{path}.txt`');
		lines.push('- Document manifest (all available docs): `https://micake.github.io/api/raw-markdown/manifest.txt`');
	} else {
		lines.push('- 上方每个链接均直接指向文档的 Markdown 原文。');
		lines.push('- 按需拉取单篇文档，无需一次性获取全量内容：`https://micake.github.io/api/raw-markdown/{path}.txt`，例如 `/api/raw-markdown/getting-started/introduction.txt`');
		lines.push('- 文档清单：`https://micake.github.io/api/raw-markdown/manifest.txt`');
	}
	lines.push('');
	lines.push(isEn ? '## Repository' : '## 仓库');
	lines.push('');
	lines.push('- GitHub source code: https://github.com/MiCake/MiCake');
	lines.push('- Docs repository: https://github.com/MiCake/micake.github.io');
	lines.push('');

	return lines.join('\n');
}
