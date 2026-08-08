// 自动生成的 llms-zh.txt —— 纯中文版导航索引
// 站点默认英文优先（见 /llms.txt）；需要纯中文内容时使用本文件
import type { APIRoute } from 'astro';
import { getAllDocs, generateLlmsTxt } from '../integrations/llms';

export const GET: APIRoute = async () => {
	const docs = await getAllDocs('zh');
	const content = generateLlmsTxt(docs, 'zh');

	return new Response(content, {
		status: 200,
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=3600',
		},
	});
};
