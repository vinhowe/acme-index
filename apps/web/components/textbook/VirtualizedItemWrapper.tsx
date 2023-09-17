"use client";

import { PropsWithChildren, useEffect, useRef, useState } from "react";

export const VirtualizedItemWrapper: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [showingChildren, setShowingChildren] = useState(false);
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
              if (boundingRect.width === 0 || boundingRect.height === 0) {
                return;
              }
              const height = div.offsetHeight;
              const width = boundingRect.width;
              div.style.height = `${height}px`;
              div.style.width = `${width}px`;
              setShowingChildren(false);
            }
          });
        },
        { rootMargin: "800px" },
      );
      observer.observe(divRef.current);
      return () => {
        observer.disconnect();
      };
    }
  }, [children]);
  return (
    <p
      className={classNames(
        !showingChildren && "dark:bg-neutral-900 bg-neutral-200 flex flex-col",
      )}
      ref={divRef}
    >
      {showingChildren && children}
    </p>
  );
};
