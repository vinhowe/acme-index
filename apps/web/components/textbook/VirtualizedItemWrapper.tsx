"use client";

import React, {
  PropsWithChildren,
  cloneElement,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export interface BatchItemVisibilityAction {
  type: "set visible";
  payload: boolean;
}

interface BatchItemVirtualizationContextProps {
  visible: boolean;
}

// Create context
export const BatchItemVirtualizationContext =
  createContext<BatchItemVirtualizationContextProps>({
    visible: true,
  });

export const BatchItemVirtualizationProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const [visible, setVisible] = useState(true);
  const childRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (childRef.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            setVisible(entry.isIntersecting);
          });
        },
        { rootMargin: "800px" },
      );
      observer.observe(childRef.current);

      return () => {
        observer.disconnect();
      };
    }
  }, [children]);

  const firstChild = React.Children.toArray(children)[0];
  const enhancedFirstChild = cloneElement(firstChild as React.ReactElement, {
    ref: (node: HTMLElement) => (childRef.current = node),
  });

  return (
    <BatchItemVirtualizationContext.Provider value={{ visible }}>
      {enhancedFirstChild}
      {React.Children.toArray(children).slice(1)}
    </BatchItemVirtualizationContext.Provider>
  );
};

export const VirtualizedItemWrapper: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const { visible } = useContext(BatchItemVirtualizationContext);
  const sizeRef = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const setupRef = (node: HTMLElement | null) => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }
    if (node) {
      const observer = new ResizeObserver((entries) => {
        for (let entry of entries) {
          const { width, height } = entry.contentRect;
          if (width === 0 && height === 0) continue;
          sizeRef.current = { width, height };
        }
      });

      observer.observe(node);
      resizeObserverRef.current = observer;
    }
  };

  const firstChild = React.Children.toArray(children)[0];
  const enhancedFirstChild = cloneElement(firstChild as React.ReactElement, {
    ref: setupRef,
  });

  return visible ? (
    enhancedFirstChild
  ) : (
    <p
      className={"dark:bg-neutral-900 bg-neutral-200 flex flex-col w-full"}
      style={{
        height: `${sizeRef.current.height}px`,
      }}
    ></p>
  );
};
