"use client";
import { usePathname } from "next/navigation";
import DocumentsPage from "./DocumentsPage";
import { createDocument } from "@/lib/api";
import { useCallback, useState } from "react";
import DocumentPage from "./DocumentPage";
import ResizableDocumentTitleInput from "@/components/document/ResizableDocumentTitleInput";
import { PrintAwareDocumentFrame } from "@/components/document/PrintAwareDocumentFrame";

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
    <PrintAwareDocumentFrame>
      <div className="p-6 flex flex-col items-start gap-4">
        <ResizableDocumentTitleInput
          initialSelected={true}
          onSubmit={handleCreateDocument}
        />
      </div>
    </PrintAwareDocumentFrame>
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
