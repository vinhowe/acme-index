"use client";

import React, {
  PropsWithChildren,
  RefCallback,
  cloneElement,
  createContext,
  useCallback,
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

const useEnhancedFirstChild = (
  children: React.ReactNode,
  ref: RefCallback<unknown>,
) => {
  const [enhancedFirstChild, setEnhancedFirstChild] =
    useState<React.ReactElement>(() => {
      const firstChild = React.Children.toArray(children)[0];
      const enhancedFirstChild = cloneElement(
        firstChild as React.ReactElement,
        {
          ref,
        },
      );
      return enhancedFirstChild;
    });

  useEffect(() => {
    const firstChild = React.Children.toArray(children)[0];
    const enhancedFirstChild = cloneElement(firstChild as React.ReactElement, {
      ref,
    });
    setEnhancedFirstChild(enhancedFirstChild);
  }, [children, ref]);

  return enhancedFirstChild;
};

export const BatchItemVirtualizationProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const [visible, setVisible] = useState(true);
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);

  const setupRef = useCallback((node: HTMLElement | null) => {
    if (intersectionObserverRef.current) {
      intersectionObserverRef.current.disconnect();
    }
    if (node) {
      const observer = new IntersectionObserver(
        (entries) => {
          setVisible(entries.some((entry) => entry.isIntersecting));
        },
        { rootMargin: "1200px" },
      );
      observer.observe(node);

      intersectionObserverRef.current = observer;
    }
  }, []);

  const enhancedFirstChild = useEnhancedFirstChild(children, setupRef);

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
  const [laggingVisible, setLaggingVisible] = useState<boolean>(true);
  const sizeRef = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const idleCallbackRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const setupRef = useCallback((node: HTMLElement | null) => {
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
  }, []);

  const enhancedFirstChild = useEnhancedFirstChild(children, setupRef);

  useEffect(() => {
    if (idleCallbackRef.current) {
      cancelIdleCallback(idleCallbackRef.current);
    }
    idleCallbackRef.current = requestIdleCallback(() => {
      setLaggingVisible(visible);
      idleCallbackRef.current = null;
    }, { timeout: 1000 });
  }, [visible]);

  return laggingVisible ? (
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
