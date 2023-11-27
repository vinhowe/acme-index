import {
  acceptCompletion,
  autocompletion,
  clearSnippet,
  closeBrackets,
  hasNextSnippetField,
  hasPrevSnippetField,
  moveCompletionSelection,
  nextSnippetField,
  prevSnippetField,
  snippetCompletion,
  snippetKeymap,
  startCompletion,
} from "@codemirror/autocomplete";
import {
  StreamLanguage,
  bracketMatching,
  codeFolding,
  foldGutter,
} from "@codemirror/language";
import { stexMath } from "@codemirror/legacy-modes/mode/stex";
import { Prec } from "@codemirror/state";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import {
  EditorView,
  KeyBinding,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightSpecialChars,
  highlightTrailingWhitespace,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import { Vim, getCM, vim } from "@replit/codemirror-vim";
import { search, searchKeymap } from "@codemirror/search";
import { katexDisplay } from "@/lib/editor/codemirror/katex-view-plugin";
import { imageDisplay } from "@/lib/editor/codemirror/image-view-plugin";
import { commonmarkLanguage, markdown } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { parseMathIPython } from "@/lib/editor/codemirror/ipython-md";
import classNames from "classnames";
import {
  ReactNode,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { DocumentCell, DocumentDrawingCell, Drawing } from "@acme-index/common";
import { DrawingViewer } from "./DrawingViewer";
import { useCodeMirror } from "@uiw/react-codemirror";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import DocumentMarkdownRenderer from "./DocumentMarkdownRenderer";
import { API_URL, uploadFile } from "@/lib/api";
import { extension } from "mime-types";
import { offsetDrawing } from "@/lib/editor/drawing-utils";
import {
  CellEditingState,
  useDocumentEditing,
} from "./DocumentEditingProvider";
import { usePrintAwareFrame } from "./PrintAwareDocumentFrame";
import {
  CreatePortalMethod,
  createPortalMethod,
  createPortalMethodConf,
  destroyPortalMethod,
  destroyPortalMethodConf,
} from "@/lib/editor/codemirror/react-portal-extension";
import { createPortal } from "react-dom";

interface SnippetDefinition {
  expansion: string;
  boost?: number;
  displayLabel?: string;
}

const LATEX_SNIPPETS: Record<string, SnippetDefinition> = {
  iff: {
    expansion: "\\iff",
    displayLabel: "\\iff",
  },
  "=>": {
    expansion: "\\Rightarrow",
    displayLabel: "\\Rightarrow",
  },
  "//": {
    expansion: "\\frac{${}}{${}}${}",
    displayLabel: "\\frac{}{}",
  },
  "!=": {
    expansion: "\\neq",
    displayLabel: "\\neq",
  },
  tag: {
    expansion: "\\tag{${}}",
    displayLabel: "\\tag{}",
  },
  "align*": {
    expansion: "\\begin{align*}\n\t${}\n\\end{align*}",
    boost: 100,
    displayLabel: "align* environment",
  },
  align: {
    expansion: "\\begin{align}\n\t${}\n\\end{align}",
    displayLabel: "align environment",
  },
  bmatrix: {
    expansion: "\\begin{bmatrix}\n\t${}\n\\end{bmatrix}",
    displayLabel: "bmatrix environment",
  },
  sum: {
    expansion: "\\sum_{${}}^{${}} ${}",
    displayLabel: "\\sum",
  },
  lim: {
    expansion: "\\lim_{${}} ${}",
    displayLabel: "\\lim",
  },
  int: {
    expansion: "\\int_{${}}^{${}} ${}",
    displayLabel: "\\int",
  },
  sqrt: {
    expansion: "\\sqrt{${}}${}",
    displayLabel: "\\sqrt",
  },
  sin: {
    expansion: "\\sin ${}",
    displayLabel: "\\sin",
  },
  cos: {
    expansion: "\\cos ${}",
    displayLabel: "\\cos",
  },
  langle: {
    expansion: "\\left\\langle ${}\\right\\rangle${}",
    displayLabel: "\\langle",
  },
  choose: {
    expansion: "{${} \\choose ${}}${}",
    displayLabel: "\\choose",
  },
  left: {
    expansion: "\\left${1}${3}\\right${2}",
    displayLabel: "\\left",
  },
  prime: {
    expansion: "${}^\\prime${}",
    displayLabel: "^\\prime",
  },
  "\\\\n": {
    expansion: "\\\\\n&= ${}",
    displayLabel: "\\\\\n&= ${}",
  },
};

const MARKDOWN_SNIPPETS: Record<string, SnippetDefinition> = {
  "align*": {
    expansion: "$$\n\\begin{align*}\n\t${}\n\\end{align*}\n$$",
    boost: 100,
    displayLabel: "align* environment",
  },
};

const commitCell = (view: EditorView) => {
  const event = new Event("commitCell", { bubbles: true });
  view.dom.dispatchEvent(event);
  return true;
};

const commitCellAndAdvance = (view: EditorView) => {
  const event = new Event("commitCellAndContinue", { bubbles: true });
  view.dom.dispatchEvent(event);
  return true;
};

const cmdEnterBinding: KeyBinding = {
  key: "Ctrl-Enter",
  run: commitCell,
};

const shiftEnterBinding: KeyBinding = {
  key: "Shift-Enter",
  // shift: commitCellAndContinue,
  run: commitCellAndAdvance,
};

const shiftEscapeBinding: KeyBinding = {
  key: "Shift-Escape",
  run: (view) => {
    const vimState = getCM(view)?.state.vim;
    if (
      !vimState ||
      vimState.mode === "normal" ||
      vimState.mode === undefined
    ) {
      return commitCell(view);
    }
    return false;
  },
};

const latexLanguage = StreamLanguage.define(stexMath);
const EXTENSIONS = ({
  createPortal,
  destroyPortal,
}: {
  createPortal: CreatePortalMethod;
  destroyPortal: (key: string) => void;
}) => {
  return [
    createPortalMethodConf.of(createPortalMethod.of(createPortal)),
    destroyPortalMethodConf.of(destroyPortalMethod.of(destroyPortal)),
    Prec.highest(
      keymap.of([
        cmdEnterBinding,
        shiftEnterBinding,
        shiftEscapeBinding,
        { key: "Ctrl-n", run: moveCompletionSelection(true) },
        { key: "Ctrl-p", run: moveCompletionSelection(false) },
        { key: "Tab", run: acceptCompletion },
        // Default completion keymap minus escape to close completion
        { key: "Ctrl-Space", run: startCompletion },
        // { key: "Escape", run: closeCompletion },
        { key: "ArrowDown", run: moveCompletionSelection(true) },
        { key: "ArrowUp", run: moveCompletionSelection(false) },
        { key: "PageDown", run: moveCompletionSelection(true, "page") },
        { key: "PageUp", run: moveCompletionSelection(false, "page") },
        // { key: "Enter", run: acceptCompletion },
      ]),
    ),
    history(),
    keymap.of([
      ...searchKeymap,
      ...historyKeymap,
      ...defaultKeymap.filter((binding) => {
        return (
          binding.key !== "Ctrl-k" &&
          binding.key !== "Ctrl-v" &&
          binding.mac !== "Ctrl-k" &&
          binding.mac !== "Ctrl-v"
        );
      }),
    ]),
    vim(),
    search(),
    drawSelection(),
    rectangularSelection(),
    lineNumbers(),
    autocompletion({
      defaultKeymap: false,
    }),
    Prec.highest(
      snippetKeymap.of([
        {
          key: "Ctrl-j",
          run: (target) =>
            nextSnippetField(target) ||
            hasNextSnippetField(target.state) ||
            hasPrevSnippetField(target.state),
        },
        {
          key: "Ctrl-k",
          run: (target) =>
            prevSnippetField(target) ||
            hasNextSnippetField(target.state) ||
            hasPrevSnippetField(target.state),
        },
        { key: "Escape", run: clearSnippet },
      ]),
    ),
    dropCursor(),
    highlightActiveLine(),
    highlightSpecialChars(),
    highlightTrailingWhitespace(),
    bracketMatching(),
    closeBrackets(),
    codeFolding(),
    foldGutter(),
    katexDisplay(),
    imageDisplay(),
    markdown({
      extensions: [parseMathIPython(latexLanguage.parser)],
      codeLanguages: languages,
    }),
    EditorView.lineWrapping,
    latexLanguage.data.of({
      autocomplete: Object.entries(LATEX_SNIPPETS).map(([key, value]) =>
        snippetCompletion(value.expansion, {
          label: key,
          boost: value.boost,
          displayLabel: value.displayLabel,
        }),
      ),
    }),
    commonmarkLanguage.data.of({
      closeBrackets: { brackets: ["(", "[", "{", "'", '"', "`", "$"] },
      autocomplete: Object.entries(MARKDOWN_SNIPPETS).map(([key, value]) =>
        snippetCompletion(value.expansion, {
          label: key,
          boost: value.boost,
          displayLabel: value.displayLabel,
        }),
      ),
    }),
  ];
};

interface DocumentCellProps {
  cell: DocumentCell;
  index: number;
}

const MemoizedDrawingViewer = memo(DrawingViewer);

const cellEmpty = (cell: DocumentCell | null) => {
  return !cell || cell?.type === "text"
    ? !cell?.content?.trim()
    : cell.content.strokes.length === 0;
};

interface BaseDrawingUpdate {
  status: "start" | "update" | "stop";
}

interface DrawingStartUpdate extends BaseDrawingUpdate {
  status: "start";
  content: Drawing | null;
}

interface DrawingUpdate extends BaseDrawingUpdate {
  status: "update";
  content: Drawing | null;
}

interface DrawingStopUpdate extends BaseDrawingUpdate {
  status: "stop";
}

type DrawingMessage = DrawingStartUpdate | DrawingUpdate | DrawingStopUpdate;

export default function DocumentCellView({ cell, index }: DocumentCellProps) {
  const {
    state: { editingCellIndex, selectedCellIndex },
    createNewCell,
    updateCell,
    commitEditingCell,
    selectCell,
    editCell,
    setCellHidden,
    addCellRelative,
  } = useDocumentEditing();
  const { documentBoundsRef } = usePrintAwareFrame();

  const state =
    editingCellIndex === index
      ? "editing"
      : selectedCellIndex === index
      ? "selected"
      : "normal";

  const [minHeight, setMinHeight] = useState<number>(0);
  const [lastState, setLastState] = useState<CellEditingState | null>(null);
  const [portals, setPortals] = useState<
    Record<
      string,
      { container: Element | DocumentFragment; children: ReactNode }
    >
  >({});

  const editingTopRef = useRef<number | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const editorValueRef = useRef<string | null>(null);

  const addPortal: CreatePortalMethod = useCallback(
    (children, container, key) => {
      if (!container) return;

      setPortals((portals) => {
        const newPortals = { ...portals };
        newPortals[key] = { container, children };
        return newPortals;
      });
    },
    [],
  );

  const destroyPortal = useCallback((key: string) => {
    setPortals((portals) => {
      const newPortals = { ...portals };
      delete newPortals[key];
      return newPortals;
    });
  }, []);

  const { setContainer, view: editorView } = useCodeMirror({
    value: (cell?.type === "text" && cell?.content) || "",
    autoFocus: true,
    className: "text-sm w-full",
    onChange: (value) => handleEditorChange(value),
    theme: window.matchMedia("(prefers-color-scheme: dark)").matches
      ? vscodeDark
      : "light",
    basicSetup: false,
    extensions: EXTENSIONS({ createPortal: addPortal, destroyPortal }),
  });

  const setupEditorContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) {
        setContainer(undefined);
        return;
      }

      node.addEventListener("commitCell", () => commitEditingCell(false));
      node.addEventListener("commitCellAndContinue", () =>
        commitEditingCell(true),
      );
      setContainer(node);
    },
    [commitEditingCell, setContainer],
  );

  const updateDeviceDrawingState = useCallback(() => {
    const editingTop = editingTopRef.current;
    if (editingTop === null) return;

    if (!isDrawingRef.current && cell?.type === "drawing") {
      // Tell iPad to start drawing
      const drawing = cell.content;
      const correctedDrawing = offsetDrawing(drawing, [
        0,
        editingTop,
      ]) as Drawing;
      // @ts-expect-error
      window.webkit?.messageHandlers?.drawingMode?.postMessage(
        JSON.stringify({
          status: "start",
          offset: [0, editingTop],
          content: correctedDrawing,
        }),
      );
      isDrawingRef.current = true;
    } else if ((isDrawingRef.current && !cell) || cell?.type !== "drawing") {
      // @ts-expect-error
      window.webkit?.messageHandlers?.drawingMode?.postMessage(
        JSON.stringify({
          status: "stop",
        }),
      );
      isDrawingRef.current = false;
    }
  }, [cell]);

  const editingTopRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) {
        return;
      }

      const observer = new ResizeObserver(() => {
        if (isDrawingRef.current) return;
        editingTopRef.current =
          node.getBoundingClientRect().top - documentBoundsRef.current[0][1];
        if (state === "editing") {
          updateDeviceDrawingState();
        }
      });

      observer.observe(node);
      // Cleanup logic:
      return () => {
        observer.unobserve(node);
      };
    },
    [documentBoundsRef, state, updateDeviceDrawingState],
  );

  const saveCellState = useCallback(() => {
    if (cell?.type === "text") {
      if (editorValueRef.current === null) return;

      updateCell(index, {
        ...cell,
        content: editorValueRef.current,
      });
      editorValueRef.current = null;
    } else {
      updateCell(index, cell);
    }
  }, [cell, index, updateCell]);

  // If state switches from editing to something else, save updates to cell
  useEffect(() => {
    if (lastState === "editing" && state !== "editing") {
      saveCellState();
    }
    setLastState(state);
  }, [lastState, saveCellState, state]);

  useEffect(() => {
    if (!["editing", "selected"].includes(state)) {
      return;
    }

    // Paste event handler
    const handlePaste = async (event: ClipboardEvent) => {
      console.log("hey");
      let items = event?.clipboardData?.items;
      if (!items) return;

      // We only handle images in this handler, allow other handlers to handle
      // text

      let file: File | null = null;

      for (let index in items) {
        let item = items[index];
        if (item.kind === "file") {
          const itemFile = item.getAsFile();
          if (!itemFile?.type?.startsWith("image/")) continue;
          file = itemFile;
          break;
        }
      }

      if (file === null) return;

      try {
        const { id } = await uploadFile(file);
        if (!id) return;
        const imageExtension = extension((file as File).type);
        const imageMarkdown = `![${id}.${imageExtension}](${API_URL}/file/${id}.${imageExtension})`;
        if (cell?.type === "text" && state === "editing") {
          if (!editorView) {
            throw new Error("Editor view not available for paste");
          }
          const cursor = editorView.state.selection.main.head;
          const transaction = editorView.state.update({
            changes: {
              from: cursor,
              to: cursor,
              insert: imageMarkdown,
            },
          });
          editorView.dispatch(transaction);
          editorView.focus();
        } else {
          // Create new cell below selected cell and insert image
          const newCell = await createNewCell("text", imageMarkdown);
          if (!newCell) return;
          addCellRelative(index, "below", newCell);
        }
      } catch (error) {
        console.error(error);
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [addCellRelative, cell?.type, createNewCell, editorView, index, state]);

  useEffect(() => {
    (window as any).handleDrawingUpdate = (message: DrawingMessage) => {
      if (state !== "editing" || cell.type !== "drawing") return;
      const editingTop = editingTopRef.current;
      if (editingTop === null) return;

      if (message.status === "start" || message.status === "update") {
        let updatedCell: DocumentDrawingCell;

        if (message.content) {
          const drawingWithOffset = offsetDrawing(message.content, [
            0,
            -editingTop,
          ]);

          updatedCell = {
            ...cell,
            content: drawingWithOffset,
          };
        } else {
          // Remove the drawing
          updatedCell = {
            ...cell,
            content: {
              strokes: [],
              bounds: [
                [0, 0],
                [0, 0],
              ],
            },
          };
        }

        updateCell(index, updatedCell, { shouldSync: false });
      } else if (message.status === "stop") {
        isDrawingRef.current = false;
        commitEditingCell(false);
      }
    };

    return () => {
      (window as any).handleDrawingUpdate = undefined;
    };
  }, [state, cell, updateCell, index, commitEditingCell]);

  useEffect(() => {
    if (state !== "editing") return;

    updateDeviceDrawingState();
  }, [state, updateDeviceDrawingState]);

  useEffect(() => {
    if (!editorView) return;

    Vim.defineEx("write", "w", () => {
      saveCellState();
    });
    Vim.defineEx("wq", null, () => {
      commitCell(editorView);
    });
    Vim.defineEx("wqa", null, () => {
      commitCell(editorView);
    });
    Vim.defineEx("q", null, () => {
      commitCell(editorView);
    });

    return () => {
      Vim.defineEx("write", "w", null);
      Vim.defineEx("wq", null, null);
      Vim.defineEx("wqa", null, null);
      Vim.defineEx("q", null, null);
    };
  }, [editorView, saveCellState]);

  const markdownContainerRefCallback = (node: HTMLDivElement | null) => {
    if (!node) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setMinHeight(node.getBoundingClientRect().height);
    });

    observer.observe(node);

    // Cleanup logic:
    return () => {
      observer.unobserve(node);
    };
  };

  const handleEditorChange = useCallback(async (value: string) => {
    editorValueRef.current = value;
  }, []);

  return (
    <div
      className={classNames(
        "border",
        (cell?.hidden || cellEmpty(cell)) && "print:hidden",
        cell?.hidden ? "border-dashed print:hidden" : "border-solid",
        ["editing", "selected"].includes(state)
          ? "dark:bg-neutral-900 bg-neutral-100 border-neutral-400 print:bg-inherit print:border-transparent"
          : "border-transparent",
      )}
      style={
        state === "editing"
          ? {
              minHeight: `calc(${minHeight}px + 2px)`,
            }
          : {}
      }
      onClick={() => selectCell(index)}
      onDoubleClick={() => editCell(index)}
    >
      {state === "editing" ? (
        <div>
          <div ref={editingTopRefCallback}></div>
          {!cell || cell?.type === "text" ? (
            <>
              <div ref={setupEditorContainerRef} key={cell?.id} />
              {Object.entries(portals).map(([key, { container, children }]) =>
                createPortal(children, container, key),
              )}
            </>
          ) : (
            <div className="w-full overflow-x-clip">
              <div className="-m-px w-[210mm] overflow-x-clip">
                <MemoizedDrawingViewer selected drawing={cell.content} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="relative">
          {!cell || cell?.type === "text" ? (
            <div
              className="px-6 py-4 overflow-x-clip"
              ref={markdownContainerRefCallback}
            >
              <DocumentMarkdownRenderer>
                {editorValueRef?.current || cell?.content}
              </DocumentMarkdownRenderer>
            </div>
          ) : (
            <div className="w-full overflow-x-clip">
              <div className="w-[210mm]">
                <MemoizedDrawingViewer drawing={cell.content} />
              </div>
            </div>
          )}
          {cell && (
            <div className="absolute top-0 right-0 left-auto p-4 opacity-50 print:hidden">
              <button
                role="button"
                onClick={() => setCellHidden(index, !cell.hidden)}
              >
                <span className="material-symbols-rounded select-none -mb-[0.1em]">
                  {cell.hidden ? "visibility_off" : "visibility"}
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
