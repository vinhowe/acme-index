"use client";
import { useEffect, useState, useCallback } from "react";

import { Document } from "@acme-index/common";

import { getDocuments } from "@/lib/api";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[] | null>(null);

  useEffect(() => {
    getDocuments().then((documents) => {
      setDocuments(documents);
    });
  }, []);

  return (
    <div className="flex flex-col items-start w-full p-6">
      <div className="mb-6 flex w-full items-baseline justify-between">
        <h1 className="text-4xl font-light tracking-tight mb-6">Documents</h1>
        <div className="flex gap-2">
          <button
            type="button"
            className="text-green-600 dark:text-green-500 flex items-center gap-1 px-2.5 py-1.5 rounded-md"
            onClick={() => {
              window.location.href = "/auth/login";
            }}
          >
            <span className="material-icons select-none text-xl -mb-[0.1rem]">
              login
            </span>
            Sign in
          </button>
          <button
            type="button"
            className="text-white bg-green-600 dark:text-black dark:bg-green-500 flex items-center gap-1 px-2.5 py-1.5 rounded-md"
            onClick={() => {
              // Navigate to /document/new using browser api
              window.location.href = "/document/new";
            }}
          >
            <span className="material-icons select-none text-xl -mb-[0.05rem]">
              add
            </span>
            Create a document
          </button>
        </div>
      </div>
      <div className="text-base flex flex-col items-start gap-4">
        {documents?.map((document) => (
          <a
            key={document.id}
            href={`/document/${document.id}`}
            className="hover:underline"
          >
            <div className="text-lg leading-5">
              {document.title || "(no title)"}{" "}
              {document.reference && (
                <span className="font-button text-base dark:text-neutral-400 text-neutral-600">
                  ({document.reference})
                </span>
              )}
            </div>
            <span className="font-button dark:text-neutral-400 text-neutral-600 text-sm">
              {document.id}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
