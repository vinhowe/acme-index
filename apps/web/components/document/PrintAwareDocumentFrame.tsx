import { Rect } from "@acme-index/common";
import { createContext, useCallback, useContext, useRef } from "react";

export type PrintAwareFrameContextProps = {
  documentBoundsRef: React.MutableRefObject<Rect>;
};

const PrintAwareFrameContext = createContext<PrintAwareFrameContextProps>({
  documentBoundsRef: {
    current: [
      [0, 0],
      [0, 0],
    ],
  },
});

export function PrintAwareDocumentFrame({
  children,
}: React.PropsWithChildren<{}>) {
  const documentBoundsRef = useRef<Rect>([
    [0, 0],
    [0, 0],
  ]);

  const setupContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const observer = new ResizeObserver(() => {
        const boundingRect = node.getBoundingClientRect();
        const rectInfo = [
          [boundingRect.left, boundingRect.top],
          [boundingRect.width, boundingRect.height],
        ] as Rect;
        // @ts-expect-error
        window.webkit?.messageHandlers?.documentBounds?.postMessage(rectInfo);
        documentBoundsRef.current = rectInfo;
        if (window.matchMedia("print").matches) {
          node.style.transform = `scale(${
            window.innerWidth / boundingRect.width
          })`;
          node.style.transformOrigin = "top left";
        }
      });

      observer.observe(node);

      // Cleanup logic:
      return () => {
        observer.unobserve(node);
      };
    }
  }, []);

  return (
    <PrintAwareFrameContext.Provider value={{ documentBoundsRef }}>
      <div
        ref={setupContainerRef}
        className="w-[min(210mm,_100%)] print:w-[210mm] bg-[#fafafa] dark:bg-[#0a0a0a] relative print:bg-inherit"
      >
        {children}
      </div>
    </PrintAwareFrameContext.Provider>
  );
}

export function usePrintAwareFrame() {
  return useContext(PrintAwareFrameContext);
}
