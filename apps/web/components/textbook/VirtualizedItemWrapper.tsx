"use client";

import { PropsWithChildren, useEffect, useRef, useState } from "react";

export const VirtualizedItemWrapper: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [showingChildren, setShowingChildren] = useState(true);
  useEffect(() => {
    const div = divRef.current;
    if (div) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              div.style.height = ``;
              div.style.width = ``;
              setShowingChildren(true);
            } else {
              const boundingRect = div.getBoundingClientRect();
              const height = div.offsetHeight;
              const width = boundingRect.width;
              div.style.height = `${height}px`;
              div.style.width = `${width}px`;
              setShowingChildren(false);
            }
          });
        },
        { rootMargin: "500px" },
      );
      observer.observe(divRef.current);
      return () => {
        observer.disconnect();
      };
    }
  }, [children]);
  return (
    <div className="flex flex-col" ref={divRef}>
      {showingChildren && children}
    </div>
  );
};
