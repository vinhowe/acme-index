import { useEffect, useRef } from "react";
import { useDocumentEditing } from "./DocumentEditingProvider";

const SPECIAL_KEY_MAP = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  Enter: "⏎",
};

export const useDocumentKeybinds = () => {
  const {
    state: { editingCellIndex },
    history: { undo, redo },
    addEmptyCellRelativeToSelected: addCellRelativeToSelected,
    selectCellRelativeToSelected,
    deleteSelectedCell,
    commitEditingCell,
    editSelectedCell,
  } = useDocumentEditing();

  const commandBufferRef = useRef<string>("");

  useEffect(() => {
    const COMMANDS: { [key: string]: () => void } = {
      "↓": () => selectCellRelativeToSelected("down"),
      j: () => selectCellRelativeToSelected("down"),
      "↑": () => selectCellRelativeToSelected("up"),
      k: () => selectCellRelativeToSelected("up"),
      "⏎": () => editSelectedCell(),
      a: () => addCellRelativeToSelected("above"),
      b: () => addCellRelativeToSelected("below"),
      dd: () => deleteSelectedCell(),
      "⇧⏎": () => commitEditingCell(true),
      "⌘z": () => undo(),
      "⌘⇧z": () => redo(),
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingCellIndex !== null) return;

      let keyString: string = "";

      if (e.metaKey) {
        keyString += "⌘";
      }

      if (e.shiftKey) {
        keyString += "⇧";
      }

      if (SPECIAL_KEY_MAP.hasOwnProperty(e.code)) {
        keyString += SPECIAL_KEY_MAP[e.code as keyof typeof SPECIAL_KEY_MAP];
      } else {
        keyString += e.key;
      }

      const newBuffer = commandBufferRef.current + keyString;

      if (e.code === "Escape") {
        commandBufferRef.current = "";
      } else if (COMMANDS.hasOwnProperty(newBuffer)) {
        COMMANDS[newBuffer as keyof typeof COMMANDS]();
        e.preventDefault();
        commandBufferRef.current = "";
      } else if (isPotentialCommand(newBuffer)) {
        commandBufferRef.current = newBuffer;
        e.preventDefault();
      } else {
        commandBufferRef.current = "";
      }
    };

    const isPotentialCommand = (input: string): boolean => {
      return Object.keys(COMMANDS).some((command) => command.startsWith(input));
    };

    // Attach the event listener
    window.addEventListener("keydown", handleKeyDown);

    // Cleanup: remove the event listener on unmount
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    addCellRelativeToSelected,
    commitEditingCell,
    deleteSelectedCell,
    editSelectedCell,
    editingCellIndex,
    redo,
    selectCellRelativeToSelected,
    undo,
  ]);
};
