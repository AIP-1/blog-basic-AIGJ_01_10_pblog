import Markdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { safeUrlTransform } from '../lib/markdown';

const components: Components = {
  a: ({ href, children, node: _node, ...rest }) => {
    if (!href) return <span>{children}</span>;
    const external = /^https?:\/\//i.test(href);
    return (
      <a href={href} {...rest} {...(external ? { target: '_blank', rel: 'noopener noreferrer nofollow' } : {})}>
        {children}
      </a>
    );
  },
  img: ({ src, alt, node: _node, ...rest }) => {
    if (!src) return null;
    return <img src={src} alt={alt ?? ''} loading="lazy" {...rest} />;
  },
};

/** 마크다운 본문. 원시 HTML 은 그리지 않는다 (skipHtml). */
export function MarkdownView({ source, className }: Readonly<{ source: string; className?: string }>) {
  return (
    <div className={className ? `markdown ${className}` : 'markdown'}>
      <Markdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={safeUrlTransform} components={components}>
        {source}
      </Markdown>
    </div>
  );
}
