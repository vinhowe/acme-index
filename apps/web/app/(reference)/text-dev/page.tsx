"use client";
import dynamic from "next/dynamic";

const TextPage = dynamic(() => import("./_components/TextDevPage"), {
  ssr: false,
});

export default function RootDocumentPage() {
  return <TextPage />;
}
