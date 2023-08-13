import React from "react";
import HeadingAnchor from "./HeadingAnchor";

export interface InfoBoxProps {
  id?: string;
  className?: string;
  title: string;
  children: React.ReactNode;
}

const InfoBox: React.FC<InfoBoxProps> = ({
  id,
  className,
  title,
  children,
}) => {
  return (
    <div
      className={`mb-4 border p-4 pb-0 dark:border-white dark:border-opacity-25 scroll-mt-4 [&>:last-child]:mb-0${
        className ? " " + className : ""
      }`}
      id={id}
    >
      <h5 className="text-base font-bold [&:hover_>_a]:text-current">
        {title}
        {id && (
          <>
            <HeadingAnchor id={id} />
          </>
        )}
      </h5>
      {children}
    </div>
  );
};

export default InfoBox;
