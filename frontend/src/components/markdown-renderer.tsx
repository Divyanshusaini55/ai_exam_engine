'use client'

import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';
import { Crimson_Pro, Cormorant_Garamond, JetBrains_Mono } from 'next/font/google';
import { cn } from '@/lib/utils';

import 'katex/dist/katex.min.css';
import 'highlight.js/styles/atom-one-dark.css';
import './article.css';

const crimsonPro = Crimson_Pro({ 
  subsets: ['latin'], 
  weight: ['300', '400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-crimson-pro',
});

const cormorantGaramond = Cormorant_Garamond({ 
  subsets: ['latin'], 
  weight: ['300', '400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
});

const jetbrainsMono = JetBrains_Mono({ 
  subsets: ['latin'], 
  weight: ['300', '400'],
  variable: '--font-jetbrains',
});

interface MarkdownRendererProps {
  content: string
  className?: string
  title?: string
  author?: string
  authorLink?: string
  image?: string
  variant?: "academic" | "prose"
}

export default function MarkdownRenderer({ content, className, title, author, authorLink, image, variant = "academic" }: MarkdownRendererProps) {
  const isAcademic = variant === "academic";
  return (
    <div
      className={cn(
        isAcademic ? "academic-article" : "",
        isAcademic ? crimsonPro.className : "",
        cormorantGaramond.variable,
        jetbrainsMono.variable,
        className
      )}
    >
      <div className="mx-auto max-w-3xl">
        {image && (
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image} alt="Chapter opener" style={{ maxWidth: '150px', display: 'block', margin: '0 auto' }} />
          </div>
        )}
        {(title || author) && (
          <header className="mb-10 text-center">
            {title && (
              <h1 
                style={{ fontFamily: 'var(--font-cormorant), serif' }} 
                className="text-3xl sm:text-4xl font-normal text-foreground mb-4"
              >
                {title}
              </h1>
            )}
            {author && (
              <div className="text-muted-foreground text-sm font-medium tracking-wide">
                <a 
                  href={authorLink || "#"} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="hover:text-primary transition-colors"
                >
                  {author}
                </a>
              </div>
            )}
            <div className="mx-auto mt-8 h-[1px] w-12 bg-border"></div>
          </header>
        )}

        <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, [rehypeKatex, {
          macros: {
            "\\m": "\\mathbf",
            "\\R": "\\mathbb{R}",
            "\\N": "\\mathbb{N}",
            "\\Z": "\\mathbb{Z}",
            "\\E": "\\mathbb{E}",
            "\\P": "\\mathbb{P}",
            "\\argmin": "\\operatorname{arg\\,min}",
            "\\argmax": "\\operatorname{arg\\,max}",
            "\\softmax": "\\operatorname{softmax}",
            "\\sign": "\\operatorname{sign}",
            "\\Tr": "\\operatorname{Tr}",
            "\\rank": "\\operatorname{rank}",
            "\\diag": "\\operatorname{diag}",
            "\\grad": "\\nabla"
          }
        }], rehypeHighlight, rehypeSlug]}
        components={{
          h1: ({node, ...props}) => isAcademic ? <h1 style={{ fontFamily: 'var(--font-cormorant), serif' }} {...props} /> : <h1 {...props} />,
          h2: ({node, ...props}) => isAcademic ? <h2 style={{ fontFamily: 'var(--font-cormorant), serif' }} {...props} /> : <h2 {...props} />,
          h3: ({node, ...props}) => isAcademic ? <h3 style={{ fontFamily: 'var(--font-cormorant), serif' }} {...props} /> : <h3 {...props} />,
          h4: ({node, ...props}) => isAcademic ? <h4 style={{ fontFamily: 'var(--font-cormorant), serif' }} {...props} /> : <h4 {...props} />,
          h5: ({node, ...props}) => isAcademic ? <h5 style={{ fontFamily: 'var(--font-cormorant), serif' }} {...props} /> : <h5 {...props} />,
          h6: ({node, ...props}) => isAcademic ? <h6 style={{ fontFamily: 'var(--font-cormorant), serif' }} {...props} /> : <h6 {...props} />,
          table: ({node, ...props}) => (
            <div className="w-full overflow-x-auto my-6 pb-2">
              <table className="w-full text-left border-collapse min-w-[500px]" {...props} />
            </div>
          ),
          th: ({node, ...props}) => <th className="p-3 border-b border-border bg-secondary/30 font-bold" {...props} />,
          td: ({node, ...props}) => <td className="p-3 border-b border-border/50" {...props} />,
          code: ({node, className, children, ...props}) => {
            return <code className={cn(className, jetbrainsMono.className)} {...props}>{children}</code>;
          },
          p: ({node, children, ...props}) => {
            return <p {...props}>{children}</p>;
          }
        }}
      >
        {content}
      </ReactMarkdown>
      </div>
    </div>
  )
}