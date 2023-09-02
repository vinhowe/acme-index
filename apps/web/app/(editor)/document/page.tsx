"use client";
import dynamic from "next/dynamic";

const DocumentPage = dynamic(() => import("./_components/DocumentPageRouter"), {
  ssr: false,
});

export default function RootDocumentPage() {
  return <DocumentPage />;
}