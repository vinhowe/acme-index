"use client";
import { usePathname } from "next/navigation";
import FlashcardsPage from "./FlashcardsPage";
import { useState } from "react";
import FlashcardEditPage from "./FlashcardEditPage";

const urlRegex = /\/flashcard\/edit\/(?<id>[^?&#]*)/;

const urlId = (pathname: string) => {
  const match = urlRegex.exec(pathname);
  return match?.groups?.id || null;
};

export default function FlashcardPageRouter() {
  const id = urlId(usePathname());
  const [initialId, setInitialId] = useState<string | null>(id);

  if (!initialId) {
    return <FlashcardsPage />;
  }

  return <FlashcardEditPage id={initialId} />;
}
