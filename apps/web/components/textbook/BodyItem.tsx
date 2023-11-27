import React, { memo } from "react";
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
import { VirtualizedItemWrapper } from "./VirtualizedItemWrapper";
import Table from "./Table";
import equal from "fast-deep-equal";
import { ChangeHighlightingItemWrapper } from "./ChangeHighlightingItemWrapper";

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
          <ChangeHighlightingItemWrapper key={itemIndex} data={item}>
            <MemoBodyItem bodyItem={item} nearestId={nearestId} />
          </ChangeHighlightingItemWrapper>
        );
      })}
    </div>
  );
};

const BodyItem: React.FC<BodyItemProps> = ({ bodyItem, nearestId }) => {
  nearestId = "id" in bodyItem ? (bodyItem.id as string) : nearestId;

  switch (bodyItem.type) {
    case "text":
      const body = <InlineBody items={bodyItem.body} />;
      return <VirtualizedItemWrapper>{body}</VirtualizedItemWrapper>;
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
          <MemoBodyItems
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
                    return (
                      <ChangeHighlightingItemWrapper
                        key={bodyItemIndex}
                        data={bodyItem}
                      >
                        <MemoBodyItem bodyItem={bodyItem} />
                      </ChangeHighlightingItemWrapper>
                    );
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
          <MemoBodyItems
            bodyItems={bodyItem.body}
            nearestId={`equation-${bodyItem.id}`}
          />
        </Equation>
      );
    case "algorithm":
      return (
        <Algorithm algorithm={bodyItem}>
          <MemoBodyItems
            bodyItems={bodyItem.body}
            nearestId={`algorithm-${bodyItem.id}`}
          />
        </Algorithm>
      );
    case "table":
      return (
        <Table table={bodyItem}>
          <MemoBodyItems
            bodyItems={bodyItem.body}
            nearestId={`table-${bodyItem.id}`}
          />
        </Table>
      );
    case "result":
      return (
        <Result result={bodyItem}>
          <MemoBodyItems
            bodyItems={bodyItem.body}
            nearestId={`result-${bodyItem.id}`}
          />
        </Result>
      );
    case "figure":
      return (
        <Figure figure={bodyItem}>
          <MemoBodyItems bodyItems={bodyItem.body} nearestId={nearestId} />
        </Figure>
      );
    case "proof":
      return (
        <Proof proof={bodyItem}>
          <MemoBodyItems
            bodyItems={bodyItem.body}
            nearestId={`proof-${bodyItem.of}`}
          />
        </Proof>
      );
    case "pagebreak":
      return <PageBreak page={bodyItem.page} />;
  }
};

export const MemoBodyItem = memo(BodyItem, (prev, next) => {
  return (
    equal(prev.bodyItem, next.bodyItem) && prev.nearestId === next.nearestId
  );
});
export const MemoBodyItems = memo(BodyItems, (prev, next) => {
  return (
    equal(prev.bodyItems, next.bodyItems) && prev.nearestId === next.nearestId
  );
});

export default BodyItem;
