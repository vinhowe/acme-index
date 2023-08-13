import React from "react";

export interface PageBreakProps {
  page: number;
  inline?: boolean;
}

const PageBreak: React.FC<PageBreakProps> = ({ page, inline = false }) => {
  return (
    <span className="absolute right-0 w-full select-none">
      <a
        className="absolute font-mono no-underline opacity-40 -right-4 md:-right-6 scroll-mt-4"
        style={
          inline
            ? { transform: "translate(50%, -50%)" }
            : { transform: "translateX(50%)" }
        }
        id={`p${page}`}
        href={`#p${page}`}
      >
        {page}
      </a>
    </span>
  );
};

export default PageBreak;
