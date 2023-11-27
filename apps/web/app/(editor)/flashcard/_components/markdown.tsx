import wikiLinkPlugin from "@/lib/textbook/link-parsing/remark-plugin";
import classNames from "classnames";
import { ReactMarkdownOptions } from "react-markdown/lib/react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeMinifyWhitespace from "rehype-minify-whitespace";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

export const REMARK_PLUGINS: ReactMarkdownOptions["remarkPlugins"] = [
  remarkGfm,
  remarkMath,
  wikiLinkPlugin,
];

export const REHYPE_PLUGINS: ReactMarkdownOptions["rehypePlugins"] = [
  () => rehypeHighlight({ ignoreMissing: true }),
  // @ts-expect-error
  rehypeRaw,
  rehypeKatex,
  rehypeMinifyWhitespace,
];

export const REACT_MARKDOWN_COMPONENTS: ReactMarkdownOptions["components"] = {
  code: ({ node, inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || "");
    return !inline && match ? (
      <div>
        <pre className={classNames(className, "mb-4")}>
          <code className={match[1]} {...props}>
            {children}
          </code>
        </pre>
      </div>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => {
    return <>{children}</>;
  },
  img: ({ node, src, alt, title, ...props }) => {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        title={title}
        {...props}
        className="mx-auto max-h-72"
      />
    );
  },
};
