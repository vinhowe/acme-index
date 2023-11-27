import wikiLinkPlugin from "@/lib/textbook/link-parsing/remark-plugin";
import classNames from "classnames";
import { memo } from "react";
import {
  ReactMarkdown,
  ReactMarkdownOptions,
} from "react-markdown/lib/react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeMinifyWhitespace from "rehype-minify-whitespace";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const REMARK_PLUGINS: ReactMarkdownOptions["remarkPlugins"] = [
  remarkGfm,
  remarkMath,
  wikiLinkPlugin,
];

const REHYPE_PLUGINS: ReactMarkdownOptions["rehypePlugins"] = [
  () => rehypeHighlight({ ignoreMissing: true }),
  // @ts-expect-error
  rehypeRaw,
  rehypeKatex,
  rehypeMinifyWhitespace,
];

const REACT_MARKDOWN_COMPONENTS: ReactMarkdownOptions["components"] = {
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

const MemoizedReactMarkdown = memo(ReactMarkdown);

export default function DocumentMarkdownRenderer({
  children,
}: {
  children: string | undefined;
}) {
  return (
    <MemoizedReactMarkdown
      className={classNames(
        "prose",
        "prose-neutral",
        "dark:prose-invert",
        "prose-h1:font-light",
        "prose-headings:font-normal",
        "max-w-none",
        "w-full",
        !children?.trim() && "italic dark:text-neutral-600",
      )}
      remarkPlugins={REMARK_PLUGINS}
      rehypePlugins={REHYPE_PLUGINS}
      components={REACT_MARKDOWN_COMPONENTS}
    >
      {children?.trim() || "Empty cell. Click to add content."}
    </MemoizedReactMarkdown>
  );
}
