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
        return 'skip'
      }
    })
  }
}

export async function processMarkdown(content: string): Promise<string> {
  let normalizedContent = content.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
  normalizedContent = normalizedContent.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

  const file = await unified()
    .use(remarkParse)
    .use(remarkMath)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSlug)
    .use(rehypeWrapTable)
    .use(rehypePrettyCode, {
      theme: 'dark-plus',
      keepBackground: false,
    })
    .use(rehypeKatex)
    .use(rehypeStringify)
    .process(normalizedContent)

  return String(file)
}
