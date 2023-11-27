"use client";
import dynamic from "next/dynamic";

const FlashcardPage = dynamic(
  () => import("./_components/FlashcardPageRouter"),
  {
    ssr: false,
  },
);

export default function RootFlashcardPage() {
  return <FlashcardPage />;
}
