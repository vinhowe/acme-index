"use client";

import React, {
  PropsWithChildren,
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
} from "react";
import equal from "fast-deep-equal";
import classNames from "classnames";

interface ChangeHighlightingContextProps {
  highlightChanges: boolean;
  registerHighlightElement: (element: HTMLParagraphElement) => void;
  changeCount: number;
}

// Create context
export const ChangeHighlightingContext =
  createContext<ChangeHighlightingContextProps>({
    highlightChanges: false,
    registerHighlightElement: () => {},
    changeCount: 0,
  });

export const ChangeHighlightingContextProvider = ({
  children,
  changeCount,
}: React.PropsWithChildren<{ changeCount: number }>) => {
  const highlightedElementsRef = useRef<HTMLParagraphElement[]>([]);
  const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    highlightedElementsRef.current = [];
  }, [changeCount]);

  const registerHighlightElement = (element: HTMLParagraphElement) => {
    highlightedElementsRef.current.push(element);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(
      scrollHighlightedElementIntoView,
      0,
    );
  };

  const scrollHighlightedElementIntoView = () => {
    if (highlightedElementsRef.current.length > 0) {
      const highestElement = highlightedElementsRef.current.reduce(
        (prev, current) => {
          return prev.getBoundingClientRect().top <
            current.getBoundingClientRect().top
            ? prev
            : current;
        },
      );
      highestElement.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <ChangeHighlightingContext.Provider
      value={{
        highlightChanges: true,
        registerHighlightElement,
        changeCount,
      }}
    >
      {children}
    </ChangeHighlightingContext.Provider>
  );
};

export const ChangeHighlightingItemInnerWrapper = ({
  children,
  data,
}: PropsWithChildren<{ data: unknown }>) => {
  const { registerHighlightElement, changeCount } = useContext(
    ChangeHighlightingContext,
  );
  const [previousData, setPreviousData] = useState<unknown>(data);
  const [shouldHighlight, setShouldHighlight] = useState(false);
  const [_, setLastChangeCount] = useState(changeCount);

  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!equal(data, previousData)) {
      setShouldHighlight(true);

      // Reset shouldHighlight after 1 second
      setTimeout(() => {
        setShouldHighlight(false);
      }, 1000);
    }
    setPreviousData(data);
  }, [data, previousData, registerHighlightElement, changeCount]);

  useEffect(() => {
    if (ref.current && shouldHighlight) {
      setLastChangeCount((lastChangeCount) => {
        if (lastChangeCount !== changeCount) {
          registerHighlightElement(ref.current!);
        }
        return changeCount;
      });
    }
  }, [shouldHighlight, changeCount, registerHighlightElement]);

  return (
    <span
      className={classNames(
        shouldHighlight && "dark:text-yellow-100 text-yellow-800",
        "transition-colors duration-1000 ease-in-out",
      )}
      ref={ref}
    >
      {children}
    </span>
  );
};

export const ChangeHighlightingItemWrapper = ({
  children,
  data,
}: PropsWithChildren<{ data: unknown }>) => {
  const { highlightChanges } = useContext(ChangeHighlightingContext);

  if (!highlightChanges) {
    return <>{children}</>;
  }

  return (
    <ChangeHighlightingItemInnerWrapper data={data}>
      {children}
    </ChangeHighlightingItemInnerWrapper>
  );
};
