import {
  API_URL,
  createDocumentCell,
  getDocument,
  getDocumentCell,
  updateDocument,
  updateDocumentCell,
  uploadFile,
} from "@/lib/api";
import {
  Document,
  DocumentCell,
  DocumentDrawingCell,
  Drawing,
  Rect,
} from "@acme-index/common";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ResizableDocumentTitleInput from "./ResizableDocumentTItleInput";
import ResizableReferenceInput from "./ResizableReferenceInput";
import {
  EditorView,
  KeyBinding,
  ViewUpdate,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightSpecialChars,
  highlightTrailingWhitespace,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import { EditorState, Prec } from "@codemirror/state";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import { Vim, getCM, vim } from "@replit/codemirror-vim";
import CodeMirror, { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import {
  Lab_to_XYZ,
  XYZ_to_Lab,
  XYZ_to_lin_P3,
  gam_P3,
  lin_P3,
  lin_P3_to_XYZ,
  offsetDrawing,
} from "@/lib/editor/drawing-utils";
import ReactMarkdown from "react-markdown";
import classNames from "classnames";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { commonmarkLanguage, markdown } from "@codemirror/lang-markdown";
import { parseMathIPython } from "@/lib/editor/codemirror/ipython-md";
import {
  StreamLanguage,
  bracketMatching,
  codeFolding,
  foldGutter,
} from "@codemirror/language";
import { stexMath } from "@codemirror/legacy-modes/mode/stex";
import {
  acceptCompletion,
  autocompletion,
  clearSnippet,
  closeBrackets,
  closeCompletion,
  hasNextSnippetField,
  hasPrevSnippetField,
  moveCompletionSelection,
  nextSnippetField,
  prevSnippetField,
  snippetCompletion,
  snippetKeymap,
  startCompletion,
} from "@codemirror/autocomplete";
import { search, searchKeymap } from "@codemirror/search";
import rehypeKatex from "rehype-katex";
import rehypeMinifyWhitespace from "rehype-minify-whitespace";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import wikiLinkPlugin from "@/lib/textbook/link-parsing/remark-plugin";
import rehypeRaw from "rehype-raw";
import rehypeHighlight from "rehype-highlight";
import "@/lib/highlightjs/github-theme-switching.css";
import { extension } from "mime-types";
import Link from "next/link";
import { katexDisplay } from "@/lib/editor/codemirror/katex-view-plugin";

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

const SPECIAL_KEY_MAP = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  Enter: "⏎",
};

const commitCell = (view: EditorView) => {
  const event = new Event("commitCell", { bubbles: true });
  view.dom.dispatchEvent(event);
  return true;
};

const commitCellAndContinue = (view: EditorView) => {
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
  run: commitCellAndContinue,
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

function SVGDrawing({ drawing, viewBox }: { drawing: Drawing; viewBox: Rect }) {
  const [minX, minY] = viewBox[0];
  const [width, height] = viewBox[1];

  const uniqueColors = new Set<string>();

  const generateClassName = (r: number, g: number, b: number, a: number) => {
    const safeString = `${r}_${g}_${b}_${a}`;
    return `color_${safeString.replace(/\./g, "p")}`; // replace '.' with 'p'
  };

  // Collect unique colors
  drawing.strokes.forEach((stroke) => {
    const { red, green, blue, alpha } = stroke.ink.color;
    const colorStr = `${red}_${green}_${blue}_${Math.round(alpha * 100)}`;
    uniqueColors.add(colorStr);
  });

  // Generate the CSS
  let css = "";
  let cssDark = "";

  uniqueColors.forEach((colorStr) => {
    const [red, green, blue, alpha] = colorStr.split("_").map(Number);
    const normalizedAlpha = Number(alpha) / 100;

    const className = generateClassName(red, green, blue, normalizedAlpha);
    css += `.${className} { stroke: color(display-p3 ${red} ${green} ${blue} / ${
      normalizedAlpha * 100
    }%); }\n`;

    let invertedRed, invertedGreen, invertedBlue;
    if (red === green && green === blue) {
      invertedRed = 1 - red;
      invertedGreen = 1 - green;
      invertedBlue = 1 - blue;
    } else {
      const [l, a, b] = XYZ_to_Lab(lin_P3_to_XYZ(lin_P3([red, green, blue])));
      const invertedLabColors = [100 - l, a, b] as [number, number, number];
      [invertedRed, invertedGreen, invertedBlue] = gam_P3(
        XYZ_to_lin_P3(Lab_to_XYZ(invertedLabColors)),
      );
    }
    cssDark += `.${className} { stroke: color(display-p3 ${invertedRed} ${invertedGreen} ${invertedBlue} / ${
      normalizedAlpha * 100
    }%); }\n`;
  });

  const fullCss = `
    ${css}
    @media (prefers-color-scheme: dark) {
      ${cssDark}
    }
  `;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: "100%", height: "100%" }}
      viewBox={`${minX} ${minY} ${width} ${height}`}
    >
      <style>{fullCss}</style>
      {drawing.strokes.map((stroke, index) => {
        const controlPoints = stroke.path.controlPoints.map(
          (cp) => cp.location,
        );
        let pathData = `M${controlPoints[0][0]},${controlPoints[0][1]} `;

        // Average instead:
        let strokeWidth = 0;
        for (let i = 0; i < stroke.path.controlPoints.length; i++) {
          strokeWidth += stroke.path.controlPoints[i].size[1];
        }
        strokeWidth /=
          stroke.path.controlPoints.length * window.devicePixelRatio;

        for (let i = 1; i < controlPoints.length - 2; i += 3) {
          const cp1 = controlPoints[i];
          const cp2 = controlPoints[i + 1];
          const end = controlPoints[i + 2];
          pathData += `C${cp1[0]},${cp1[1]} ${cp2[0]},${cp2[1]} ${end[0]},${end[1]} `;
        }

        const { red, green, blue, alpha } = stroke.ink.color;
        const normalizedAlpha = Math.round(alpha * 100) / 100;
        const className = generateClassName(red, green, blue, normalizedAlpha);

        return (
          <path
            key={index}
            d={pathData}
            fill="none"
            className={className}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function DrawingViewer({
  selected = false,
  drawing,
}: {
  selected?: boolean;
  drawing?: Drawing;
}) {
  const [width, setWidth] = useState<number>(0);

  const setupPatternRef = useCallback((node: SVGElement | null) => {
    if (node) {
      const observer = new ResizeObserver(() => {
        const boundingRect = node.getBoundingClientRect();
        setWidth(boundingRect.width);
      });

      observer.observe(node);

      // Cleanup logic:
      return () => {
        observer.unobserve(node);
      };
    }
  }, []);

  const height = drawing ? drawing.bounds[1][1] + drawing.bounds[0][1] + 20 : 0;
  const patternSize = Math.max((width - 1) / 30, 5);

  return (
    <div className="relative">
      <svg
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full"
        style={{
          height: `${Math.max((width - 1) * (4 / 30), height)}px`,
        }}
        ref={setupPatternRef}
      >
        <defs>
          <pattern
            id="drawing-grid"
            width={patternSize}
            height={patternSize}
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx={(width - 1) / 60}
              cy={(width - 1) / 60}
              r="1"
              className={classNames(
                selected
                  ? "dark:fill-neutral-500 fill-neutral-600"
                  : "dark:fill-neutral-700 fill-neutral-400",
              )}
              opacity="1"
            ></circle>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#drawing-grid)"></rect>
      </svg>
      {/* {!selected && drawing && svgContent && (
        <div
          dangerouslySetInnerHTML={{ __html: svgContent }}
          className="absolute w-full pointer-events-none"
          style={{
            top: `${drawing.bounds[0][1]}px`,
          }}
        />
      )} */}
      {!selected && drawing && (
        <div
          className="absolute w-full pointer-events-none"
          style={{
            top: `${drawing.bounds[0][1]}px`,
          }}
        >
          <SVGDrawing
            drawing={drawing}
            viewBox={[
              [0, drawing.bounds[0][1]],
              [width, drawing.bounds[1][1]],
            ]}
          />
        </div>
      )}
    </div>
  );
}

export default function DocumentPage({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const [document, setDocument] = useState<Document | null>(null);

  const [cells, setCells] = useState<Array<DocumentCell | null>>([]);
  const [editingCellIndex, setEditingCellIndex] = useState<number | null>(null);
  const [selectedCellIndex, setSelectedCellIndex] = useState<number | null>(
    null,
  );
  const [minHeight, setMinHeight] = useState<number>(0);

  const editingTopRefs = useRef<Map<number, number>>(new Map());
  const editorRefs = useRef<Map<number, ReactCodeMirrorRef>>(new Map());
  const editorValueRefs = useRef<Map<number, string>>(new Map());
  const commandBufferRef = useRef<string>("");
  const isDrawingRef = useRef<boolean>(false);
  const documentBoundsRef = useRef<Rect>([
    [0, 0],
    [0, 0],
  ]);

  const EXTENSIONS = useMemo(() => {
    const latexLanguage = StreamLanguage.define(stexMath);
    return [
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
          return binding.key !== "Ctrl-k" && binding.mac !== "Ctrl-k";
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
      markdown({
        extensions: [parseMathIPython(latexLanguage.parser)],
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
  }, []);

  useEffect(() => {
    getDocument(id)
      .then((document) => {
        if (!document) {
          setError("Document not found");
          return;
        }
        setDocument(document);

        // Load each cell with getDocumentCell
        const cells = document.cells.map((cellId) =>
          cellId ? getDocumentCell(document.id, cellId) : null,
        );
        Promise.all(cells)
          .then((cells) => {
            setCells(cells);
            setStatus("loaded");
          })
          .catch((error) => {
            setError(error.message);
          });
      })
      .catch((error) => {
        setStatus("error");
        setError(error.message);
      });
  }, [id]);

  const handleUpdateReference = useCallback(
    (id: string) => {
      if (!document) {
        return;
      }
      updateDocument(document.id, { reference: id })
        .then((document) => {
          setDocument(document);
        })
        .catch((error) => {
          setError(error.message);
        });
    },
    [setError, document],
  );

  const handleUpdateDocumentCells = useCallback(
    async (
      updateCells:
        | ((cells: Array<DocumentCell | null>) => Array<DocumentCell | null>)
        | Array<DocumentCell | null>,
    ) => {
      if (!document) {
        return;
      }

      // Update the cells state
      setCells((cells) => {
        const updatedCells =
          updateCells instanceof Function ? updateCells(cells) : updateCells;
        updateDocument(document.id, {
          cells: updatedCells.map((cell) => cell?.id || null),
        });
        return updatedCells;
      });
    },
    [document],
  );

  const handleUpdateTitle = useCallback(
    (title: string, id: string) => {
      if (!document) {
        return;
      }
      updateDocument(document.id, { title, id })
        .then((document) => {
          setDocument(document);
          window.history.replaceState(null, "", `/document/${document.id}`);
        })
        .catch((error) => {
          setError(error.message);
        });
    },
    [setError, document],
  );

  const createNewCell = useCallback(
    async (type: DocumentCell["type"]) => {
      if (!document) {
        return;
      }

      let initialContent: Pick<DocumentCell, "type" | "content">;
      if (type === "text") {
        initialContent = {
          type: "text",
          content: "",
        };
      } else {
        initialContent = {
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

      // idk what to do about this
      // @ts-expect-error
      return await createDocumentCell(document.id, initialContent);
    },
    [document],
  );

  const updateDeviceDrawingState = useCallback(
    (cellIndex: number, currentCell: DocumentCell | null) => {
      if (cellIndex === null) return;
      const editingTop = editingTopRefs.current.get(cellIndex);
      if (!editingTop) return;

      if (!isDrawingRef.current && currentCell?.type === "drawing") {
        // Tell iPad to start drawing
        const drawing = currentCell.content;
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
      } else if (
        (isDrawingRef.current && !currentCell) ||
        currentCell?.type !== "drawing"
      ) {
        // @ts-expect-error
        window.webkit?.messageHandlers?.drawingMode?.postMessage(
          JSON.stringify({
            status: "stop",
          }),
        );
        isDrawingRef.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    if (editingCellIndex === null) return;
    updateDeviceDrawingState(editingCellIndex, cells[editingCellIndex]);
  }, [editingCellIndex, cells, updateDeviceDrawingState]);

  const handleAppendCell = useCallback(
    async (type: DocumentCell["type"]) => {
      const newCell = await createNewCell(type);
      if (!newCell) return;

      if (cells.length === 0) {
        setSelectedCellIndex(0);
      }

      handleUpdateDocumentCells((prevCells) => [...prevCells, newCell]);
    },
    [cells.length, createNewCell, handleUpdateDocumentCells],
  );

  const handleUpdateDocumentCell = useCallback(
    (index: number) => {
      if (!document?.id) return;
      setCells((cells) => {
        const updatedCells = [...cells];
        const cell = updatedCells[index];
        let valueChanged = false;
        let updatedCell: DocumentCell | null;
        if (cell?.type === "text") {
          const editorValueRef = editorValueRefs.current.get(index);
          if (editorValueRef) {
            updatedCell = {
              ...cell,
              content: editorValueRef,
            };
            updatedCells[index] = updatedCell;
            valueChanged = true;
          } else {
            updatedCell = cell;
          }
        } else {
          // Drawing just uses content from cell
          updatedCell = cell;
        }
        if (updatedCell) {
          updateDocumentCell(document.id, updatedCell.id, updatedCell);
          // Also update the document updated timestamp (empty body to patch)
          updateDocument(document.id, {});
        }
        return updatedCells;
      });
    },
    [document?.id, editorValueRefs],
  );

  const handleCommitAndMoveToNextCell = useCallback(() => {
    if (!document?.id || selectedCellIndex === null) return;

    handleUpdateDocumentCell(selectedCellIndex);

    const nextIndex = selectedCellIndex + 1;

    if (nextIndex === cells.length) {
      handleAppendCell("text");
    }
    setSelectedCellIndex(nextIndex);
    setEditingCellIndex(null); // Commit the current cell
  }, [
    document?.id,
    selectedCellIndex,
    handleUpdateDocumentCell,
    cells.length,
    handleAppendCell,
  ]);

  const handleCommitCell = useCallback(() => {
    if (!document?.id || selectedCellIndex === null) return;

    handleUpdateDocumentCell(selectedCellIndex);

    setEditingCellIndex(null);
  }, [document?.id, selectedCellIndex, handleUpdateDocumentCell]);

  useEffect(() => {
    (window as any).handleDrawingUpdate = (message: DrawingMessage) => {
      if (!document?.id || editingCellIndex === null) return;
      const editingTop = editingTopRefs.current.get(editingCellIndex);
      if (!editingTop) return;

      const cell = cells[editingCellIndex];
      if (!cell || cell.type !== "drawing") return;

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

        // updateDocumentCell(document.id, updatedCell.id, updatedCell);
        setCells((cells) => {
          const updatedCells = [...cells];
          updatedCells[editingCellIndex] = updatedCell;
          return updatedCells;
        });
      } else if (message.status === "stop") {
        isDrawingRef.current = false;
        handleCommitCell();
      }
    };

    // Paste event handler
    const handlePaste = (event: ClipboardEvent) => {
      if (!document?.id) return;

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

      uploadFile(file)
        .then(async ({ id }) => {
          if (!id) return;
          const imageExtension = extension((file as File).type);
          const imageMarkdown = `![${id}.${imageExtension}](${API_URL}/file/${id}.${imageExtension})`;
          const editingCell =
            editingCellIndex !== null ? cells[editingCellIndex] : null;
          if (editingCellIndex !== null && editingCell?.type === "text") {
            const editorRef = editorRefs.current.get(editingCellIndex);
            if (!editorRef) return;
            const editorView = editorRef.view;
            if (!editorView) return;
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
            const newCell = await createDocumentCell(document.id, {
              type: "text",
              content: imageMarkdown,
            });
            if (!newCell) return;
            handleUpdateDocumentCells((prevCells) => {
              const updatedCells = [...prevCells];
              updatedCells.splice(selectedCellIndex ?? 0 + 1, 0, newCell);
              return updatedCells;
            });
          }
        })
        .catch((error) => {
          console.error(error);
        });
    };

    window.addEventListener("paste", handlePaste);

    return () => {
      (window as any).handleDrawingUpdate = undefined;
      window.removeEventListener("paste", handlePaste);
    };
  }, [
    cells,
    selectedCellIndex,
    editingCellIndex,
    handleCommitCell,
    document?.id,
    handleUpdateDocumentCells,
  ]);

  const setupContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      const observer = new ResizeObserver(() => {
        const boundingRect = node.getBoundingClientRect();
        const rectInfo = [
          [boundingRect.left, boundingRect.top],
          [boundingRect.width, boundingRect.height],
        ] as Rect;
        // @ts-expect-error
        window.webkit?.messageHandlers?.documentBounds?.postMessage(rectInfo);
        documentBoundsRef.current = rectInfo;
      });

      observer.observe(node);

      // Cleanup logic:
      return () => {
        observer.unobserve(node);
      };
    }
  }, []);

  const setupEditorRef = useCallback(
    (newRefs: ReactCodeMirrorRef | null) => {
      if (editingCellIndex === null) return;
      if (
        // !editorRefs.current.get(editingCellIndex) &&
        newRefs?.editor &&
        newRefs?.state &&
        newRefs?.view
      ) {
        newRefs.editor.addEventListener("commitCell", handleCommitCell);
        newRefs.editor.addEventListener(
          "commitCellAndContinue",
          handleCommitAndMoveToNextCell,
        );
        editorRefs.current.set(editingCellIndex, newRefs);
      } else if (editorRefs.current.get(editingCellIndex) && !newRefs) {
        editorRefs.current.delete(editingCellIndex);
      }
    },
    [editingCellIndex, handleCommitAndMoveToNextCell, handleCommitCell],
  );

  const markdownContainerRefCallback = (
    node: HTMLDivElement | null,
    index: number,
  ) => {
    if (!node) {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (selectedCellIndex !== index) return;
      setMinHeight(node.getBoundingClientRect().height);
    });

    observer.observe(node);

    // Cleanup logic:
    return () => {
      observer.unobserve(node);
    };
  };

  const editingTopRefCallback = useCallback(
    (node: HTMLDivElement | null, index: number) => {
      if (!node) {
        return;
      }

      const observer = new ResizeObserver(() => {
        if (isDrawingRef.current) return;
        editingTopRefs.current.set(
          index,
          node.getBoundingClientRect().top - documentBoundsRef.current[0][1],
        );
        if (editingCellIndex !== null) {
          updateDeviceDrawingState(editingCellIndex, cells[editingCellIndex]);
        }
      });

      observer.observe(node);
      // Cleanup logic:
      return () => {
        observer.unobserve(node);
      };
    },
    [editingCellIndex, cells, updateDeviceDrawingState],
  );

  const handleEditorChange = useCallback(
    async (value: string, _viewUpdate: ViewUpdate, index: number) => {
      if (!document) return;
      editorValueRefs.current.set(index, value);
    },
    [document],
  );

  const handleSelectCell = (index: number) => {
    if (editingCellIndex !== index) {
      if (editingCellIndex !== null) {
        handleUpdateDocumentCell(editingCellIndex);
      }
      setEditingCellIndex(null);
    }
    setSelectedCellIndex(index);
  };

  const handleEditCell = (index: number) => {
    const currentCell = cells[index];
    if (!currentCell) return;

    if (currentCell.type === "drawing") {
      // If we're not on iPad, don't allow editing drawing cells
      // @ts-expect-error
      if (typeof window.webkit?.messageHandlers?.drawingMode === "undefined") {
        return false;
      }
    }

    setEditingCellIndex(index);
    setSelectedCellIndex(index);
    return true;
  };

  useEffect(() => {
    const COMMANDS: { [key: string]: () => void } = {
      "↓": () => selectCell("down"),
      j: () => selectCell("down"),
      "↑": () => selectCell("up"),
      k: () => selectCell("up"),
      "⏎": () => editSelectedCell(),
      a: () => addCell("above"),
      b: () => addCell("below"),
      dd: () => deleteSelectedCell(),
      "⇧⏎": handleCommitAndMoveToNextCell,
      // ... any other Vim-like commands
    };

    function selectCell(direction: "up" | "down") {
      if (selectedCellIndex === null) return;
      const nextIndex =
        direction === "down" ? selectedCellIndex + 1 : selectedCellIndex - 1;

      if (nextIndex >= 0 && nextIndex < cells.length) {
        setSelectedCellIndex(nextIndex);
      }
    }

    function editSelectedCell() {
      if (selectedCellIndex === null) return;

      setEditingCellIndex(selectedCellIndex);
    }

    async function addCell(position: "above" | "below") {
      if (selectedCellIndex === null) return;

      const updatedCells = [...cells];

      let newIndex;
      if (position === "above") {
        newIndex = selectedCellIndex;
      } else {
        newIndex = selectedCellIndex + 1;
      }

      const newCell = await createNewCell("text");
      if (!newCell) return;
      updatedCells.splice(newIndex, 0, newCell);

      handleUpdateDocumentCells(updatedCells);
      setSelectedCellIndex(newIndex);
    }

    function deleteSelectedCell() {
      if (selectedCellIndex === null) return;

      // Remove the cell from the array by splice
      const updatedCells = [...cells];
      const [currentCell] = updatedCells.splice(selectedCellIndex, 1);
      handleUpdateDocumentCells(updatedCells);
      if (updatedCells.length) {
        // Select next cell if it exists, otherwise select previous cell
        const nextIndex =
          selectedCellIndex < updatedCells.length
            ? selectedCellIndex
            : selectedCellIndex - 1;
        setSelectedCellIndex(nextIndex);
      } else {
        setSelectedCellIndex(null);
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingCellIndex !== null) return;

      let keyString: string = "";

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
        commandBufferRef.current = "";
      } else if (isPotentialCommand(newBuffer)) {
        commandBufferRef.current = newBuffer;
      } else {
        commandBufferRef.current = "";
      }
    };

    const isPotentialCommand = (input: string): boolean => {
      return Object.keys(COMMANDS).some((command) => command.startsWith(input));
    };

    // const currentRef = containerRef.current;

    // Attach the event listener
    window.addEventListener("keydown", handleKeyDown);

    // Cleanup: remove the event listener on unmount
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    selectedCellIndex,
    editingCellIndex,
    cells,
    commandBufferRef,
    handleCommitAndMoveToNextCell,
    handleUpdateDocumentCells,
    createNewCell,
  ]);

  if (status === "error") {
    return <div>Error: {error}</div>;
  }

  if (status === "loading" || !document) {
    return <div>Loading...</div>;
  }

  return (
    <div
      ref={setupContainerRef}
      className="w-[min(210mm,_100%)] print:w-full bg-[#fafafa] dark:bg-[#0a0a0a] relative print:bg-inherit"
    >
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
          onSubmit={handleUpdateTitle}
        />
        <div className="print:hidden">
          <ResizableReferenceInput
            initialValue={document.reference}
            onSubmit={handleUpdateReference}
          />
        </div>
      </div>
      <div className="py-6 flex flex-col gap-6">
        {cells.length > 0 && (
          <div>
            {cells.map((cell, index) => (
              <div
                key={index}
                style={
                  editingCellIndex === index
                    ? {
                        minHeight: `calc(${minHeight}px + 2px)`,
                      }
                    : {}
                }
              >
                <div
                  className={`border border-solid ${
                    selectedCellIndex === index
                      ? "dark:bg-neutral-900 bg-neutral-100 border-neutral-400 print:bg-inherit print:border-transparent"
                      : "border-transparent"
                  }`}
                  onClick={() => handleSelectCell(index)}
                  onDoubleClick={(event) => handleEditCell(index)}
                >
                  {editingCellIndex === index ? (
                    <div>
                      <div
                        ref={(node) => editingTopRefCallback(node, index)}
                      ></div>
                      {!cell || cell?.type === "text" ? (
                        <CodeMirror
                          value={cell?.content || ""}
                          autoFocus
                          className="text-sm w-full"
                          onChange={(value, viewUpdate) =>
                            handleEditorChange(value, viewUpdate, index)
                          }
                          // theme={githubDark}
                          theme={
                            window.matchMedia("(prefers-color-scheme: dark)")
                              .matches
                              ? vscodeDark
                              : "light"
                          }
                          basicSetup={false}
                          extensions={EXTENSIONS}
                          ref={setupEditorRef}
                        />
                      ) : (
                        <div className="-m-px">
                          <DrawingViewer selected drawing={cell.content} />
                        </div>
                      )}
                    </div>
                  ) : !cell || cell?.type === "text" ? (
                    <div
                      className="px-6 py-4"
                      ref={(node) => markdownContainerRefCallback(node, index)}
                    >
                      <ReactMarkdown
                        className={classNames(
                          "prose",
                          "prose-neutral",
                          "dark:prose-invert",
                          "prose-h1:font-light",
                          "prose-headings:font-normal",
                          "max-w-none",
                          "w-full",
                          !cell?.content?.trim() &&
                            "italic dark:text-neutral-600",
                        )}
                        remarkPlugins={[remarkGfm, remarkMath, wikiLinkPlugin]}
                        rehypePlugins={[
                          rehypeHighlight,
                          // @ts-expect-error
                          rehypeRaw,
                          rehypeKatex,
                          rehypeMinifyWhitespace,
                        ]}
                        components={{
                          code: ({
                            node,
                            inline,
                            className,
                            children,
                            ...props
                          }) => {
                            const match = /language-(\w+)/.exec(
                              className || "",
                            );
                            return !inline && match ? (
                              <div>
                                <pre className={classNames(className, "mb-4")}>
                                  <code className={match[1]} {...props}>
                                    {children}
                                  </code>
                                </pre>
                              </div>
                            ) : (
                              <code className={className} {...props}>
                                {children}
                              </code>
                            );
                          },
                          pre: ({ children }) => {
                            return <>{children}</>;
                          },
                          img: ({ node, src, alt, title, ...props }) => {
                            return (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={src}
                                alt={alt}
                                title={title}
                                {...props}
                                className="mx-auto max-h-72"
                              />
                            );
                          },
                        }}
                      >
                        {cell?.content?.trim() ||
                          "Empty cell. Click to add content."}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <DrawingViewer drawing={cell.content} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mx-6 flex justify-center gap-4 print:hidden">
          <button
            className="py-2 px-4 bg-blue-500 dark:bg-blue-800 text-white"
            onClick={() => handleAppendCell("text")}
          >
            Add Text Cell
          </button>
          <button
            className="py-2 px-4 bg-blue-500 dark:bg-blue-800 text-white"
            onClick={() => handleAppendCell("drawing")}
          >
            Add Drawing Cell
          </button>
        </div>
      </div>
    </div>
  );
}
