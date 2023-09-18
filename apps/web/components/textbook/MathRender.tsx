import React, { Fragment } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import { renderMathInString } from "@/lib/katex-utils";

interface MathRenderProps {
  body: string;
}

const captureWhitespace = (str: string) => {
  const leadingWhitespace = str.match(/^\s+/);
  const trailingWhitespace = str.match(/\s+$/);
  return {
    leading: leadingWhitespace ? leadingWhitespace[0] : "",
    trailing: trailingWhitespace ? trailingWhitespace[0] : "",
  };
};

const MathRender: React.FC<MathRenderProps> = ({ body }) => {
  const { leading, trailing } = captureWhitespace(body);

  return (
    <>
      {leading}
      {renderMathInString(body).map((item, index) => {
        if (item.type === "math") {
          return (
            <span key={index} dangerouslySetInnerHTML={{ __html: item.data }} />
          );
        } else {
          const { leading, trailing } = captureWhitespace(item.data);
          return (
            <Fragment key={index}>
              {leading}
              <ReactMarkdown
                // @ts-expect-error
                rehypePlugins={[rehypeRaw]}
                components={{
                  p: ({ children }) => {
                    return <>{children}</>;
                  },
                }}
              >
                {item.data}
              </ReactMarkdown>
              {trailing}
            </Fragment>
          );
        }
      })}
      {trailing}
    </>
  );
};

export default MathRender;
