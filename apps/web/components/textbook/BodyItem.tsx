import React from "react";
import Result from "./Result";
import Proof from "./Proof";
import PageBreak from "./PageBreak";
import InlineBody from "./InlineBody";
import Figure from "./Figure";
import Equation from "./Equation";
import Exercise from "./Exercise";
import type { BodyItem as BodyItemType } from "@acme-index/common";
import HeadingAnchor from "./HeadingAnchor";
import classNames from "classnames";
import Algorithm from "./Algorithm";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "@/lib/highlightjs/github-theme-switching.css";

export interface BodyItemsProps {
  bodyItems: BodyItemType[];
  nearestId?: string;
}

export interface BodyItemProps {
  bodyItem: BodyItemType;
  nearestId?: string;
}

export const BodyItems: React.FC<BodyItemsProps> = ({
  bodyItems,
  nearestId,
}) => {
  return (
    <div className="overflow-x-clip">
      {bodyItems.map((item, itemIndex) => {
        return (
          <BodyItem bodyItem={item} nearestId={nearestId} key={itemIndex} />
        );
      })}
    </div>
  );
};

const BodyItem: React.FC<BodyItemProps> = ({ bodyItem, nearestId }) => {
  nearestId = "id" in bodyItem ? (bodyItem.id as string) : nearestId;

  switch (bodyItem.type) {
    case "text":
      return (
        <p className="text-justify">
          <InlineBody items={bodyItem.body} />
        </p>
      );
    case "standalone_heading":
      const HeadingTag = `h${bodyItem.level}` as keyof JSX.IntrinsicElements;
      return (
        <HeadingTag
          className={classNames(
            "text-justify",
            HeadingTag == "h4" && "text-xl font-normal",
            HeadingTag == "h5" && "text-lg font-medium",
            HeadingTag == "h6" && "text-base font-bold",
          )}
        >
          {bodyItem.body}
        </HeadingTag>
      );
    case "exercise":
      return (
        <Exercise exercise={bodyItem}>
          <BodyItems
            bodyItems={bodyItem.body}
            nearestId={`exercise-${bodyItem.id}`}
          />
        </Exercise>
      );
    case "list":
      return (
        <ol type={bodyItem.list_type === "roman" ? "i" : "a"}>
          {bodyItem.body.map((item, itemIndex) => {
            if (item.type === "list_item") {
              const id = `${nearestId}-${item?.roman || item?.letter}`;
              return (
                <li
                  key={itemIndex}
                  value={item.number}
                  className="text-justify [&:hover_.anchor-link]:text-current scroll-mt-4"
                  id={id}
                >
                  {nearestId && (
                    <div className="absolute left-0.5">
                      <HeadingAnchor id={id} />
                    </div>
                  )}
                  {item.body.map((bodyItem, bodyItemIndex) => {
                    return <BodyItem bodyItem={bodyItem} key={bodyItemIndex} />;
                  })}
                </li>
              );
            } else if (item.type === "pagebreak") {
              return <PageBreak key={itemIndex} page={item.page} />;
            } else {
              return null;
            }
          })}
        </ol>
      );
    case "fence":
      return (
        <ReactMarkdown
          rehypePlugins={[rehypeHighlight]}
          components={{
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
          }}
        >
          {`\`\`\`${bodyItem.info ?? ""}\n${bodyItem.body}\n\`\`\``}
        </ReactMarkdown>
      );
    case "equation":
      return (
        <Equation equation={bodyItem}>
          <BodyItems
            bodyItems={bodyItem.body}
            nearestId={`equation-${bodyItem.id}`}
          />
        </Equation>
      );
    case "algorithm":
      return (
        <Algorithm algorithm={bodyItem}>
          <BodyItems
            bodyItems={bodyItem.body}
            nearestId={`algorithm-${bodyItem.id}`}
          />
        </Algorithm>
      );
    case "result":
      return (
        <Result result={bodyItem}>
          <BodyItems
            bodyItems={bodyItem.body}
            nearestId={`result-${bodyItem.id}`}
          />
        </Result>
      );
    case "figure":
      return (
        <Figure figure={bodyItem}>
          <BodyItems bodyItems={bodyItem.body} nearestId={nearestId} />
        </Figure>
      );
    case "proof":
      return (
        <Proof proof={bodyItem}>
          <BodyItems
            bodyItems={bodyItem.body}
            nearestId={`proof-${bodyItem.of}`}
          />
        </Proof>
      );
    case "pagebreak":
      return <PageBreak page={bodyItem.page} />;
  }
};

export default BodyItem;
