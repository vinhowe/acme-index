"use client";
import { usePathname } from "next/navigation";
import DocumentsPage from "./DocumentsPage";
import { getDocument, createDocument, updateDocument } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";
import ResizableDocumentTitleInput from "./ResizableDocumentTItleInput";
import ResizableReferenceInput from "./ResizableReferenceInput";
import { Document } from "@acme-index/common";
import DocumentPage from "./DocumentPage";

const urlRegex = /\/document\/(?<id>[^?&#]*)/;

const urlId = (pathname: string) => {
  const match = urlRegex.exec(pathname);
  return match?.groups?.id || null;
};

function NewDocumentPage() {
  const handleCreateDocument = useCallback((title: string, id: string) => {
    createDocument(id, title)
      .then((document) => {
        window.location.href = `/document/${document.id}`;
      })
      .catch((error) => {
        console.error(error);
      });
  }, []);

  return (
    <div className="mx-auto w-[210mm] bg-[#fafafa] dark:bg-[#0a0a0a] relative">
      <div className="p-6 flex flex-col items-start gap-4">
        <ResizableDocumentTitleInput
          initialSelected={true}
          onSubmit={handleCreateDocument}
        />
      </div>
    </div>
  );
}

export default function DocumentPageRouter() {
  const id = urlId(usePathname());
  const [initialId, setInitialId] = useState<string | null>(id);

  if (!initialId) {
    return <DocumentsPage />;
  }

  if (initialId === "new") {
    return <NewDocumentPage />;
  }

  return <DocumentPage id={initialId} />;
}
