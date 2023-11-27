import "@/lib/highlightjs/github-theme-switching.css";
import {
  DragDropContext,
  Draggable,
  DropResult,
  Droppable,
  OnDragStartResponder,
} from "@hello-pangea/dnd";
import Link from "next/link";
import { useCallback } from "react";
import DocumentCellView from "./DocumentCellView";
import {
  DocumentEditingProvider,
  useDocumentEditing,
} from "@/components/document/DocumentEditingProvider";
import { useDocumentKeybinds } from "@/components/document/useDocumentKeybinds";
import { PrintAwareDocumentFrame } from "@/components/document/PrintAwareDocumentFrame";
import ResizableDocumentTitleInput from "@/components/document/ResizableDocumentTitleInput";
import ResizableReferenceInput from "../../flashcard/_components/ResizableReferenceInput";

export function DocumentView() {
  const {
    state: { document, state, error, cells, editingCellIndex },
    updateDocumentCellReferences,
    appendEmptyCell: appendCell,
    restoreDeletedCells,
    selectCell,
    updateTitle,
    updateReference,
  } = useDocumentEditing();
  useDocumentKeybinds();

  const onDragStart: OnDragStartResponder = useCallback(
    (start) => {
      if (!document) return;
      // Find the index of the cell being dragged
      const sourceIndex = start.source.index;
      selectCell(sourceIndex);
    },
    [document, selectCell],
  );

  const onDragEnd = useCallback(
    (result: DropResult) => {
      if (!document) return;
      if (!result.destination) return;

      const sourceIndex = result.source.index;
      const destinationIndex = result.destination.index;

      if (sourceIndex === destinationIndex) return;

      selectCell(destinationIndex);

      const updatedCells = [...cells];
      const [cell] = updatedCells.splice(sourceIndex, 1);
      updatedCells.splice(destinationIndex, 0, cell);

      updateDocumentCellReferences(updatedCells);
    },
    [cells, document, selectCell, updateDocumentCellReferences],
  );

  if (state === "error") {
    return <div>Error: {error}</div>;
  }

  if (state === "loading" || !document) {
    return <div>Loading...</div>;
  }

  return (
    <PrintAwareDocumentFrame>
      <div className="pt-6 px-6 flex flex-col items-start gap-6">
        <Link
          href="/document"
          className="text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-2 print:hidden"
        >
          <span className="material-symbols-rounded select-none text-sm -mb-[0.1em]">
            arrow_back
          </span>
          Documents
        </Link>
        <ResizableDocumentTitleInput
          initialValue={document.title}
          onSubmit={updateTitle}
        />
        <div className="print:hidden">
          <ResizableReferenceInput
            initialValue={document.reference}
            onSubmit={updateReference}
          />
        </div>
      </div>
      <div className="py-6 flex flex-col gap-6">
        {cells.length > 0 && (
          <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <Droppable droppableId="document">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef}>
                  {cells.map((cell, index) => (
                    <Draggable
                      key={cell?.id}
                      draggableId={cell?.id || index.toString()}
                      index={index}
                      isDragDisabled={editingCellIndex !== null}
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          style={{
                            ...provided.draggableProps.style,
                          }}
                        >
                          {cell && (
                            <DocumentCellView cell={cell} index={index} />
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
        <div className="mx-6 flex justify-center gap-4 print:hidden">
          <button
            className="py-2 px-4 bg-neutral-300 dark:bg-neutral-800 dark:text-white text-black"
            onClick={() => appendCell("text")}
            tabIndex={-1}
          >
            Add Text Cell
          </button>
          <button
            className="py-2 px-4 bg-neutral-300 dark:bg-neutral-800 dark:text-white text-black"
            onClick={() => appendCell("drawing")}
            tabIndex={-1}
          >
            Add Drawing Cell
          </button>
        </div>
        <div className="flex justify-center opacity-50 print:hidden">
          <button onClick={restoreDeletedCells} tabIndex={-1} />
        </div>
      </div>
    </PrintAwareDocumentFrame>
  );
}

export default function DocumentPage({ id }: { id: string }) {
  return (
    <DocumentEditingProvider id={id}>
      <DocumentView />
    </DocumentEditingProvider>
  );
}
