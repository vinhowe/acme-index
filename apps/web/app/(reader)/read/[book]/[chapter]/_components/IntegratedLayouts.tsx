"use client";

import { ChatContext } from "@/components/chat/ChatProvider";
import classNames from "classnames";
import { useContext } from "react";

export function SidebarToggleAwareBodyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    state: { isSidebarOpen },
  } = useContext(ChatContext);
  return (
    <div
      className={classNames(
        "overflow-scroll",
        isSidebarOpen ? "col-span-1" : "col-span-2",
      )}
    >
      <main className="p-8 lg:p-12 prose prose-neutral mx-auto mt-8 dark:prose-invert max-w-none">
        {children}
      </main>
    </div>
  );
}

export function SidebarToggleAwareSidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    state: { isSidebarOpen },
  } = useContext(ChatContext);
  return (
    <div
      className={classNames(
        "block fixed left-auto top-0 right-0",
        isSidebarOpen && "w-[min(25rem,_100vw)] 2xl:w-[32rem] xl:w-[28rem]",
      )}
    >
      <div
        className={classNames(
          "relative top-0 right-0 overflow-hidden",
          isSidebarOpen && "w-full h-[100dvh]",
        )}
      >
        {children}
      </div>
    </div>
  );
}
