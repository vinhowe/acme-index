import React from "react";
import HeadingAnchor from "./HeadingAnchor";
import { CopyContentButton } from "./CopyContentButton";

export interface InfoBoxProps {
  id?: string;
  className?: string;
  title: string;
  children: React.ReactNode;
  content?: string;
}

const InfoBox: React.FC<InfoBoxProps> = ({
  id,
  className,
  title,
  children,
  content = null,
}) => {
  return (
    <div
      className={`mb-4 border p-4 pb-0 dark:border-white dark:border-opacity-25 scroll-mt-4 [&>:last-child]:mb-0${
        className ? " " + className : ""
      }`}
      id={id}
    >
      <h5 className="flex w-full justify-between text-base font-bold [&:hover_>_a]:text-current">
        <span>
          {title}
          {id && (
            <>
              <HeadingAnchor id={id} />
            </>
          )}
        </span>
        {content && <CopyContentButton content={content} />}
      </h5>
      {children}
    </div>
  );
};

export default InfoBox;
