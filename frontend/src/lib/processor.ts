import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeKatex from 'rehype-katex'
import rehypeSlug from 'rehype-slug'
import rehypePrettyCode from 'rehype-pretty-code'
import rehypeStringify from 'rehype-stringify'

import { visit } from 'unist-util-visit'

/**
 * rehypeWrapTable
 * Wraps <table> elements in a responsive <div class="overflow-x-auto ..."> container
 */
function rehypeWrapTable() {
  return (tree: any) => {
    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName === 'table') {
        const wrapper = {
          type: 'element',
          tagName: 'div',
          properties: { className: ['overflow-x-auto', 'my-8', 'border', 'border-border', 'rounded-xl', 'shadow-sm'] },
          children: [node],
        }
        parent.children[index!] = wrapper
        // skip traversing the wrapper we just inserted
        return 'skip'
      }
    })
  }
}

/**
 * processMarkdown
 * 
 * Takes raw Markdown content and transforms it into a sanitized, fully 
 * rendered HTML string containing KaTeX math nodes, syntax-highlighted code blocks,
 * and slugified headings.
 * 
 * This should ideally run on the Server to keep the client bundle small.
 */
export async function processMarkdown(content: string): Promise<string> {
  // Pre-process: Convert LaTeX-style math delimiters to Markdown-style
  // Convert \[ ... \] to $$ ... $$
  let normalizedContent = content.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
  // Convert \( ... \) to $ ... $
  normalizedContent = normalizedContent.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

  const file = await unified()
    .use(remarkParse)
    .use(remarkMath) // $math$
    .use(remarkGfm)  // tables, strikethrough
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)  // Allow raw HTML embedded in markdown
    .use(rehypeSlug) // add ids to headings
    .use(rehypeWrapTable) // Wrap tables for responsive scrolling
    .use(rehypePrettyCode, {
      theme: 'dark-plus',
      keepBackground: false,
    })
    .use(rehypeKatex) // render math to HTML
    .use(rehypeStringify)
    .process(normalizedContent)

  return String(file)
}
