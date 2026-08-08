// 自动生成的 llms.txt —— 站点导航索引，供 AI 发现文档
// 遵循 llmstxt.org 规范，由构建自动生成，无需手动维护
// 英文优先：存在英文翻译时优先收录英文，否则回退到中文原文
import type { APIRoute } from 'astro';
import { getAllDocs, generateLlmsTxt } from '../integrations/llms';

export const GET: APIRoute = async () => {
	const docs = await getAllDocs('en');
	const content = generateLlmsTxt(docs, 'en');

	return new Response(content, {
		status: 200,
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=3600',
		},
	});
};
