import {
  getDocument as getDocumentApi,
  getDocumentCell as getDocumentCellApi,
  createDocumentCell as createDocumentCellApi,
  updateDocument as updateDocumentApi,
  updateDocumentCell as updateDocumentCellApi,
} from "@/lib/api";
import {
  createContext,
  useEffect,
  useReducer,
  useCallback,
  useContext,
} from "react";
import { Document, DocumentCell, Drawing } from "@acme-index/common";
import { HistoryStateType, useHistoryState } from "./useHistoryState";

export interface DocumentEditingState {
  document: Document | null;
  error: string | null;
  cells: Array<DocumentCell | null>;
  selectedCellIndex: number | null;
  editingCellIndex: number | null;
  state: "idle" | "loading" | "loaded" | "error";
}

export type CellEditingState = "editing" | "selected" | "normal";

type DocumentEditingAction =
  | {
      type: "set initial document";
      document: Document;
    }
  | {
      type: "set error";
      error: string;
    }
  | {
      type: "set editing cell";
      index: number | null;
    }
  | {
      type: "set selected cell";
      index: number | null;
    }
  | {
      type: "select adjacent cell";
      direction: "up" | "down";
    }
  | {
      type: "commit cell";
      advance: boolean;
    }
  | {
      type: "update cells";
      cells: Array<DocumentCell | null>;
    };

interface DocumentEditingContextProps {
  state: DocumentEditingState;
  history: Pick<HistoryStateType<Array<DocumentCell | null>>, "undo" | "redo">;
  createNewCell: (
    type: DocumentCell["type"],
    content?: DocumentCell["content"],
  ) => Promise<DocumentCell | null>;
  updateCell: (
    index: number,
    cell: DocumentCell,
    options?: {
      shouldSync?: boolean;
      replace?: boolean;
    },
  ) => void;
  updateDocumentCellReferences: (
    updateCells: Array<DocumentCell | null>,
    options?: {
      shouldSync?: boolean;
      replace?: boolean;
    },
  ) => void;
  // Adding cells
  appendCell: (cell: DocumentCell) => void;
  appendEmptyCell: (type: DocumentCell["type"]) => void;
  addCellRelative: (
    index: number,
    position: "above" | "below",
    cell: DocumentCell,
  ) => void;
  addEmptyCellRelative: (index: number, position: "above" | "below") => void;
  addCellRelativeToSelected: (
    position: "above" | "below",
    cell: DocumentCell,
  ) => void;
  addEmptyCellRelativeToSelected: (position: "above" | "below") => void;
  // Deleting cells
  deleteSelectedCell: () => void;
  // Selecting cells
  selectCell: (index: number) => void;
  selectCellRelativeToSelected: (direction: "up" | "down") => void;
  // Editing cells
  editCell: (index: number) => void;
  editSelectedCell: () => void;
  // Committing cells
  commitEditingCell: (advance?: boolean) => void;
  // Setting cell state
  setCellHidden: (index: number, hidden: boolean) => void;
  // Restoring deleted cells
  restoreDeletedCells: () => void;
  // Updating document state
  updateReference: (id: string) => void;
  updateTitle: (title: string, id: string) => void;
}

const initialReducerState: DocumentEditingState = {
  state: "idle",
  document: null,
  cells: [],
  error: null,
  selectedCellIndex: null,
  editingCellIndex: null,
};

const documentEditingReducer = (
  state: DocumentEditingState,
  action: DocumentEditingAction,
): DocumentEditingState => {
  switch (action.type) {
    case "set initial document":
      return {
        ...state,
        document: action.document,
        state: "loaded",
      };
    case "set error":
      return {
        ...state,
        error: action.error,
        state: "error",
      };
    case "set editing cell":
      return {
        ...state,
        editingCellIndex: action.index,
        selectedCellIndex: action.index,
      };
    case "set selected cell":
      let editingCellIndex = state.editingCellIndex;
      if (editingCellIndex !== action.index) {
        editingCellIndex = null;
      }
      return {
        ...state,
        selectedCellIndex: action.index,
        editingCellIndex: editingCellIndex,
      };
    case "select adjacent cell":
      let nextIndex;
      if (state.selectedCellIndex === null) {
        nextIndex = 0;
      } else {
        if (action.direction === "up") {
          nextIndex = state.selectedCellIndex - 1;
        } else {
          nextIndex = state.selectedCellIndex + 1;
        }
      }
      if (nextIndex < 0 || nextIndex >= state.cells.length) return state;
      return {
        ...state,
        selectedCellIndex: nextIndex,
      };
    case "commit cell":
      let editingCellId = state.editingCellIndex;
      if (editingCellId !== state.selectedCellIndex) {
        editingCellId = null;
      }
      return {
        ...state,
        editingCellIndex: null,
        selectedCellIndex: action.advance
          ? state.selectedCellIndex
          : state.editingCellIndex,
      };
    case "update cells":
      let selectedCellIndex = state.selectedCellIndex;
      if (action.cells.length > 0 && state.selectedCellIndex === null) {
        selectedCellIndex = 0;
      }
      return {
        ...state,
        cells: action.cells,
        selectedCellIndex,
      };
    default:
      return state;
  }
};

const DocumentEditingContext =
  createContext<DocumentEditingContextProps | null>(null);

interface DocumentEditingProviderProps {
  id: string;
}

export const DocumentEditingProvider: React.FC<
  React.PropsWithChildren<DocumentEditingProviderProps>
> = ({ id, children }) => {
  const [state, dispatch] = useReducer(
    documentEditingReducer,
    initialReducerState,
  );
  const { selectedCellIndex, document } = state;

  const history = useHistoryState<Array<DocumentCell | null>>([]);

  const {
    state: cells,
    clearHistory: clearCellsHistory,
    setWithoutHistory: replaceCellsHistory,
    set: pushCellsHistory,
    undo,
    redo,
  } = history;

  const updateCell = useCallback(
    (
      index: number,
      cell: DocumentCell,
      {
        shouldSync = true,
        replace = false,
      }: {
        shouldSync?: boolean;
        replace?: boolean;
      } = {},
    ) => {
      if (!document?.id) return;

      if (shouldSync) {
        updateDocumentCellApi(document.id, cell.id, cell);
        // Also update the document updated timestamp (empty body to patch)
        updateDocumentApi(document.id, {});
      }
      const updatedCells = [...cells];
      updatedCells[index] = cell;
      dispatch({
        type: "update cells",
        cells: updatedCells,
      });
      (replace ? replaceCellsHistory : pushCellsHistory)(updatedCells);
    },
    [cells, document?.id, pushCellsHistory, replaceCellsHistory],
  );

  const updateDocumentCellReferences = useCallback(
    async (
      updatedCells: Array<DocumentCell | null>,
      {
        shouldSync = true,
        replace = false,
      }: {
        shouldSync?: boolean;
        replace?: boolean;
      } = {},
    ) => {
      if (!document?.id) {
        return;
      }

      if (shouldSync) {
        updateDocumentApi(document.id, {
          cells: updatedCells.map((cell) => cell?.id || null),
        });
      }
      (replace ? replaceCellsHistory : pushCellsHistory)(updatedCells);
      dispatch({
        type: "update cells",
        cells: updatedCells,
      });
    },
    [document?.id, pushCellsHistory, replaceCellsHistory],
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const document = await getDocumentApi(id);
        if (!document) {
          dispatch({
            type: "set error",
            error: "Document not found",
          });
          return;
        }

        // Load each cell with getDocumentCell
        const cells = await Promise.all(
          document.cells.map(async (cellId) =>
            cellId ? getDocumentCellApi(document.id, cellId) : null,
          ),
        );

        clearCellsHistory();
        dispatch({
          type: "set initial document",
          document: document,
        });
        updateDocumentCellReferences(cells, {
          shouldSync: false,
          replace: true,
        });
      } catch (error) {
        dispatch({
          type: "set error",
          error: (error as Error).message,
        });
      }
    };

    fetchData();
  }, [
    clearCellsHistory,
    id,
    replaceCellsHistory,
    updateDocumentCellReferences,
  ]);

  // TODO: This should be moved to an API method or something
  const createNewCell = useCallback(
    async (type: DocumentCell["type"], content?: DocumentCell["content"]) => {
      if (!document) {
        return null;
      }

      let initialCell: Pick<DocumentCell, "type" | "content">;
      if (!content) {
        if (type === "text") {
          initialCell = {
            type: "text",
            content: "",
          };
        } else {
          initialCell = {
            type: "drawing",
            content: {
              strokes: [],
              bounds: [
                [0, 0],
                [0, 0],
              ],
            } as Drawing,
          };
        }
      } else {
        initialCell = {
          type,
          content,
        };
      }

      // idk what to do about this
      // @ts-expect-error
      return await createDocumentCellApi(document.id, initialCell);
    },
    [document],
  );

  const selectCell = useCallback((index: number) => {
    dispatch({
      type: "set selected cell",
      index: index,
    });
  }, []);

  const editCell = useCallback(
    (index: number) => {
      const currentCell = cells[index];
      if (!currentCell) return;

      if (currentCell.type === "drawing") {
        // If we're not on iPad, don't allow editing drawing cells
        if (
          // @ts-expect-error
          typeof window.webkit?.messageHandlers?.drawingMode === "undefined"
        ) {
          return;
        }
      }

      dispatch({
        type: "set editing cell",
        index: index,
      });
    },
    [cells],
  );

  const appendCell = useCallback(
    (cell: DocumentCell) => {
      updateDocumentCellReferences([...cells, cell]);
    },
    [cells, updateDocumentCellReferences],
  );

  const appendEmptyCell = useCallback(
    async (type: DocumentCell["type"]) => {
      const newCell = await createNewCell(type);
      if (!newCell) return;
      appendCell(newCell);
    },
    [appendCell, createNewCell],
  );

  const addCellRelative = useCallback(
    async (index: number, position: "above" | "below", cell: DocumentCell) => {
      if (!document) {
        return;
      }
      const updatedCells = [...cells];

      let newIndex;
      if (position === "above") {
        newIndex = index;
      } else {
        newIndex = index + 1;
      }

      updatedCells.splice(newIndex, 0, cell);

      updateDocumentCellReferences(updatedCells);
    },
    [cells, document, updateDocumentCellReferences],
  );

  const addEmptyCellRelative = useCallback(
    async (index: number, position: "above" | "below") => {
      if (!document) {
        return;
      }
      const newCell = await createNewCell("text");
      if (!newCell) return;

      addCellRelative(index, position, newCell);
    },
    [addCellRelative, createNewCell, document],
  );

  const commitEditingCell = useCallback(
    (advance: boolean = false) => {
      if (!document?.id || selectedCellIndex === null) return;
      if (advance) {
        const nextIndex = selectedCellIndex + 1;
        if (nextIndex === cells.length) {
          appendEmptyCell("text");
        }
      }
      dispatch({
        type: "commit cell",
        advance,
      });
    },
    [appendEmptyCell, cells.length, document?.id, selectedCellIndex],
  );

  const deleteSelectedCell = useCallback(() => {
    if (selectedCellIndex === null) return;

    // Remove the cell from the array by splice
    const updatedCells = [...cells];
    updatedCells.splice(selectedCellIndex, 1);

    updateDocumentCellReferences(updatedCells);

    if (updatedCells.length) {
      // Select next cell if it exists, otherwise select previous cell
      const nextIndex =
        selectedCellIndex < updatedCells.length
          ? selectedCellIndex
          : selectedCellIndex - 1;
      dispatch({
        type: "set selected cell",
        index: nextIndex,
      });
    } else {
      dispatch({
        type: "set selected cell",
        index: null,
      });
    }
  }, [cells, selectedCellIndex, updateDocumentCellReferences]);

  const addCellRelativeToSelected = useCallback(
    async (position: "above" | "below", cell: DocumentCell) => {
      if (selectedCellIndex === null) return;

      const updatedCells = [...cells];

      let newIndex;
      if (position === "above") {
        newIndex = selectedCellIndex;
      } else {
        newIndex = selectedCellIndex + 1;
      }

      updatedCells.splice(newIndex, 0, cell);

      updateDocumentCellReferences(updatedCells);
      dispatch({
        type: "set selected cell",
        index: newIndex,
      });
    },
    [cells, selectedCellIndex, updateDocumentCellReferences],
  );

  const addEmptyCellRelativeToSelected = useCallback(
    async (position: "above" | "below") => {
      if (selectedCellIndex === null) return;

      const newCell = await createNewCell("text");
      if (!newCell) return;

      addCellRelativeToSelected(position, newCell);
    },
    [addCellRelativeToSelected, createNewCell, selectedCellIndex],
  );

  const editSelectedCell = useCallback(() => {
    if (selectedCellIndex === null) return;
    editCell(selectedCellIndex);
  }, [editCell, selectedCellIndex]);

  const selectCellRelativeToSelected = useCallback(
    (direction: "up" | "down") => {
      dispatch({
        type: "select adjacent cell",
        direction,
      });
    },
    [],
  );

  const setCellHidden = useCallback(
    (index: number, hidden: boolean) => {
      if (!document) {
        return;
      }
      const cell = cells[index];
      if (!cell) {
        return;
      }

      updateCell(index, { ...cell, hidden });
    },
    [document, cells, updateCell],
  );

  const restoreDeletedCells = useCallback(async () => {
    if (!document) {
      return;
    }
    const deletedCellIds = document.deletedCells;

    if (!deletedCellIds) {
      return;
    }

    // Fetch the deleted cells
    const deletedCells = await Promise.all(
      deletedCellIds.map((cellId) =>
        cellId ? getDocumentCellApi(document.id, cellId) : null,
      ),
    );

    updateDocumentCellReferences([...cells, ...(deletedCells || [])]);
  }, [document, updateDocumentCellReferences, cells]);

  const updateReference = useCallback(
    async (id: string) => {
      if (!document) {
        return;
      }
      try {
        const updatedDocument = await updateDocumentApi(document.id, {
          reference: id,
        });
        dispatch({
          type: "set initial document",
          document: updatedDocument,
        });
      } catch (error) {
        dispatch({
          type: "set error",
          error: (error as Error).message,
        });
      }
    },
    [document],
  );

  const updateTitle = useCallback(
    async (title: string, id: string) => {
      if (!document) {
        return;
      }
      try {
        const updatedDocument = await updateDocumentApi(document.id, {
          title,
          id,
        });
        dispatch({
          type: "set initial document",
          document: updatedDocument,
        });
        window.history.replaceState(
          null,
          "",
          `/document/${updatedDocument.id}`,
        );
      } catch (error) {
        dispatch({
          type: "set error",
          error: (error as Error).message,
        });
      }
    },
    [document],
  );

  return (
    <DocumentEditingContext.Provider
      value={{
        state: { ...state, cells },
        history: { undo, redo },
        // Cell editing
        createNewCell,
        updateCell,
        updateDocumentCellReferences,
        // Adding cells
        appendCell,
        appendEmptyCell,
        addCellRelative,
        addEmptyCellRelative,
        addCellRelativeToSelected,
        addEmptyCellRelativeToSelected,
        // Deleting cells
        deleteSelectedCell,
        // Selecting cells
        selectCell,
        selectCellRelativeToSelected,
        // Editing cells
        editCell,
        editSelectedCell,
        // Committing cells
        commitEditingCell,
        // Setting cell state
        setCellHidden,
        // Restoring deleted cells
        restoreDeletedCells,
        // Updating document state
        updateReference,
        updateTitle,
      }}
    >
      {children}
    </DocumentEditingContext.Provider>
  );
};

export const useDocumentEditing = () => {
  const context = useContext(DocumentEditingContext);
  if (context === null) {
    throw new Error(
      "useDocumentEditing must be used within a DocumentEditingProvider",
    );
  }
  return context;
};
