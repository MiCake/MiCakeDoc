// Static generation of raw markdown API endpoints
// This file serves raw markdown content directly
// Accessible at /api/raw-markdown/[path].md

import type { GetStaticPaths, APIRoute } from 'astro';
import fs from 'fs';
import path from 'path';

interface MarkdownFile {
  slug: string;
  filePath: string;
}

/** 归档版本 slug 列表（starlight-versions 生成于 src/content/versions/*.json） */
function getArchivedVersionSlugs(): string[] {
  const versionsDir = path.join(process.cwd(), 'src', 'content', 'versions');
  if (!fs.existsSync(versionsDir)) return [];
  return fs
    .readdirSync(versionsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));
}

/** 判断相对路径是否属于归档版本目录（如 0.9/xxx 或 en/0.9/xxx） */
function isVersionedPath(relativePath: string, versionSlugs: string[]): boolean {
  const [first, second] = relativePath.split('/');
  return versionSlugs.includes(first) || (first === 'en' && versionSlugs.includes(second));
}

// Gather all markdown files at build time
// 注意：包含归档版本目录（如 0.9/xxx、en/0.9/xxx），
// 因为旧版本页面的「Markdown 原文」按钮和 AI 读取旧文档都需要这些静态文件。
// llms.txt 的索引过滤（只索引当前版）在 src/integrations/llms.ts 中处理。
function getAllMarkdownFiles(): MarkdownFile[] {
  const basePath = path.join(process.cwd(), 'src', 'content', 'docs');
  const files: MarkdownFile[] = [];
  
  function scanDirectory(dir: string, relativePath: string = '') {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        scanDirectory(fullPath, relativePath ? path.join(relativePath, item) : item);
      } else if (item.endsWith('.md') || item.endsWith('.mdx')) {
        const slug = path.join(relativePath, item.replace(/\.(md|mdx)$/, '')).replace(/\\/g, '/');
        files.push({
          slug,
          filePath: fullPath
        });
      }
    }
  }
  
  scanDirectory(basePath);
  return files;
}

export const getStaticPaths: GetStaticPaths = async () => {
  const files = getAllMarkdownFiles();
  
  // Add manifest path
  // 注意：路径带 .txt 后缀 —— GitHub Pages 对无扩展名文件返回
  // application/octet-stream（浏览器会下载），对 .txt 返回 text/plain（浏览器直接显示）
  const paths = [
    { params: { path: 'manifest.txt' } },
    ...files.map(file => ({ params: { path: file.slug + '.txt' } }))
  ];
  
  return paths;
};

export const GET: APIRoute = async ({ params }) => {
  let slug = params.path || '';

  // 固定使用 text/plain：
  // - 站点为纯静态构建（GitHub Pages），运行时无法读取请求头做内容协商
  // - text/plain 让浏览器直接显示内容而非下载（浏览器不认识 text/markdown 会触发下载）
  // - AI 客户端读取 text/plain 无任何障碍（同 GitHub raw 文件的做法）
  const contentType = 'text/plain; charset=utf-8';

  // 兼容带或不带 .txt 后缀的请求（后缀仅用于静态托管的 MIME 识别）
  if (slug.endsWith('.txt')) {
    slug = slug.slice(0, -'.txt'.length);
  }
  
  // Handle manifest request
  if (slug === 'manifest') {
    return generateManifest(contentType);
  }

  // 注意：允许访问归档版本路径（/api/raw-markdown/0.9/xxx.txt），
  // 供旧版本页面的「Markdown 原文」按钮和 AI 读取旧版本文档使用。
  // 版本文件位于 docs/0.9/ 下，与当前版文件路径自然隔离。
  
  const basePath = path.join(process.cwd(), 'src', 'content', 'docs');
  
  // Try different extensions
  const extensions = ['.md', '.mdx'];
  let filePath: string | null = null;
  
  for (const ext of extensions) {
    const fullPath = path.join(basePath, slug + ext);
    if (fs.existsSync(fullPath)) {
      filePath = fullPath;
      break;
    }
    
    // Try with index file
    const indexPath = path.join(basePath, slug, 'index' + ext);
    if (fs.existsSync(indexPath)) {
      filePath = indexPath;
      break;
    }
  }
  
  if (!filePath) {
    return new Response(
      `# 404 - Not Found

Markdown file not found for path: \`${slug}\`

## Available paths:
- \`/api/raw-markdown/manifest.txt\` - View all available documents
- \`/api/raw-markdown/{path}.txt\` - Get raw markdown content

Please check the manifest for available document paths.
`,
      { 
        status: 404,
        headers: {
          'Content-Type': contentType
        }
      }
    );
  }
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch (error) {
    return new Response(
      `# 500 - Internal Server Error

An error occurred while processing the request for path: \`${slug}\`

Error: ${String(error)}

Please try again later or contact support if the problem persists.
`,
      { 
        status: 500,
        headers: {
          'Content-Type': contentType
        }
      }
    );
  }
};

function generateManifest(contentType: string) {
  const basePath = path.join(process.cwd(), 'src', 'content', 'docs');
  const versionSlugs = getArchivedVersionSlugs();
  const files: Array<{
    path: string;
    title: string;
    description?: string;
    type: 'md' | 'mdx';
    lang: 'en' | 'zh';
    apiUrl: string;
  }> = [];
  
  function scanDirectory(dir: string, relativePath: string = '') {
    if (!fs.existsSync(dir)) return;
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        const childPath = path.join(relativePath, item).replace(/\\/g, '/');
        // 跳过归档版本目录，只暴露当前版本
        if (isVersionedPath(childPath, versionSlugs)) continue;
        scanDirectory(fullPath, relativePath ? path.join(relativePath, item) : item);
      } else if (item.endsWith('.md') || item.endsWith('.mdx')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const metadata = extractMetadata(content);
        const slug = path.join(relativePath, item.replace(/\.(md|mdx)$/, '')).replace(/\\/g, '/');
        
        files.push({
          path: slug,
          title: metadata.title || slug,
          description: metadata.description,
          type: item.endsWith('.mdx') ? 'mdx' : 'md',
          lang: slug.startsWith('en/') ? 'en' : 'zh',
          apiUrl: `/api/raw-markdown/${slug}.txt`
        });
      }
    }
  }
  
  scanDirectory(basePath);
  
  // Generate markdown format manifest
  const markdownContent = `# MiCake Documentation Manifest

Generated at: ${new Date().toISOString()}

## Usage

Access individual documents directly:
- Get raw markdown: \`GET /api/raw-markdown/{path}.txt\`
- Example: \`GET /api/raw-markdown/getting-started/introduction.txt\`
- Manifest: \`GET /api/raw-markdown/manifest.txt\`

All responses are raw markdown content with \`Content-Type: text/plain; charset=utf-8\` (the \`.txt\` suffix ensures GitHub Pages serves it as \`text/plain\`, so browsers render it directly instead of downloading; equally consumable by AI agents).

## Languages

- English documents are served under the \`en/\` path prefix, e.g. \`/api/raw-markdown/en/getting-started/introduction.txt\`
- English is the preferred language for AI consumption; Chinese originals are available at the root paths
- The AI-readable navigation indexes: \`/llms.txt\` (English-first) and \`/llms-zh.txt\` (Chinese-only)

## Available Documents

${files.map(file => `### ${file.title}
- **Path**: \`${file.path}\`
- **Type**: ${file.type}
- **Language**: ${file.lang === 'en' ? 'English' : '中文'}
- **API URL**: ${file.apiUrl}
${file.description ? `- **Description**: ${file.description}` : ''}

**Raw Content**: [${file.apiUrl}.txt](${file.apiUrl}.txt)
`).join('\n')}`;
  
  return new Response(markdownContent, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

function extractMetadata(content: string): { title?: string; description?: string } {
  const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
  
  if (!frontmatterMatch) {
    return {};
  }
  
  const frontmatter = frontmatterMatch[1];
  const titleMatch = frontmatter.match(/^title:\s*['"]?(.+?)['"]?\s*$/m);
  const descriptionMatch = frontmatter.match(/^description:\s*['"]?(.+?)['"]?\s*$/m);
  
  return {
    title: titleMatch?.[1],
    description: descriptionMatch?.[1]
  };
}
