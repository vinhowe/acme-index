import {
  API_URL,
  getFlashcard,
  updateFlashcard,
  uploadFile,
} from "@/lib/api";
import {
  Flashcard,
} from "@acme-index/common";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import ResizableReferenceInput from "../../document/_components/ResizableReferenceInput";
import {
  EditorView,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightSpecialChars,
  highlightTrailingWhitespace,
  keymap,
  lineNumbers,
  rectangularSelection,
} from "@codemirror/view";
import { Prec } from "@codemirror/state";
import { languages } from "@codemirror/language-data";
import {
  history,
  defaultKeymap,
  historyKeymap,
  indentMore,
  indentLess,
} from "@codemirror/commands";
import { getCM, vim } from "@replit/codemirror-vim";
import ReactMarkdown from "react-markdown";
import classNames from "classnames";
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
import "@/lib/highlightjs/github-theme-switching.css";
import { extension } from "mime-types";
import Link from "next/link";
import { katexDisplay } from "@/lib/editor/codemirror/katex-view-plugin";
import { imageDisplay } from "@/lib/editor/codemirror/image-view-plugin";
import { useCodeMirror } from "@uiw/react-codemirror";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import {
  REACT_MARKDOWN_COMPONENTS,
  REHYPE_PLUGINS,
  REMARK_PLUGINS,
} from "./markdown";

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

const latexLanguage = StreamLanguage.define(stexMath);

const runIfVimNotNormal = (fn: (view: EditorView) => boolean) => {
  return (view: EditorView) => {
    const vimState = getCM(view)?.state.vim;
    if (vimState?.mode !== undefined && vimState?.mode !== "normal") {
      fn(view);
      return true;
    }

    return false;
  };
};

const EXTENSIONS = [
  Prec.highest(
    keymap.of([
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
      {
        key: "Tab",
        run: runIfVimNotNormal(indentMore),
        shift: runIfVimNotNormal(indentLess),
      },
      {
        key: "Ctrl-Enter",
        // Swallow event so that we can use it for our own purposes
        run: () => true,
      },
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

const MemoizedReactMarkdown = memo(ReactMarkdown);

function FlashcardEditor({
  initialValue,
  onChange,
}: {
  initialValue: string;
  onChange: (value: string) => void;
  editorRef?: React.MutableRefObject<EditorView | null>;
}) {
  const [value, setValue] = useState(initialValue);

  const handleChange = useCallback(
    (value: string) => {
      onChange(value);
      setValue(value);
    },
    [onChange],
  );

  const editor = useRef<HTMLDivElement>();

  const { setContainer, view: editorView } = useCodeMirror({
    value: initialValue,
    onChange: handleChange,
    // className:
    //   "text-sm w-full flex-[3] focus-within:ring-2 focus-within:ring-blue-500 rounded-sm",
    theme: window.matchMedia("(prefers-color-scheme: dark)").matches
      ? vscodeDark
      : "light",
    basicSetup: false,
    indentWithTab: false,
    extensions: EXTENSIONS,
  });

  useEffect(() => {
    if (editor.current) {
      setContainer(editor.current);
    }
  }, [setContainer]);

  useEffect(() => {
    // Paste event handler
    const handlePaste = (event: ClipboardEvent) => {
      if (!editorView) return;
      console.log(editorView.hasFocus);
      // Check if editor is focused
      if (!editorView.hasFocus) return;

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
        })
        .catch((error) => {
          console.error(error);
        });
    };

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [editorView]);

  return (
    <div className="flex gap-4">
      <div ref={editor} className="flex-[5]" />
      <MemoizedReactMarkdown
        className={classNames(
          "prose",
          "prose-neutral",
          "dark:prose-invert",
          "prose-h1:font-light",
          "prose-headings:font-normal",
          "max-w-none",
          "w-full",
          "flex-[2]",
        )}
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={REACT_MARKDOWN_COMPONENTS}
      >
        {value || "..."}
      </MemoizedReactMarkdown>
    </div>
  );
}

export default function SimpleFlashcardEditPage({ id }: { id: string }) {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const [flashcard, setFlashcard] = useState<Flashcard | null>(null);
  const [hasChanged, setHasChanged] = useState(false);
  const [deletePressed, setDeletePressed] = useState(false);

  const setupFlashcardState = useCallback((flashcard: Flashcard) => {
    setFlashcard(flashcard);
  }, []);

  useEffect(() => {
    if (flashcard) {
      return;
    }
    getFlashcard(id)
      .then((flashcard) => {
        if (!flashcard) {
          setError("Flashcard not found");
          return;
        }
        setupFlashcardState(flashcard);
        setStatus("loaded");
      })
      .catch((error) => {
        setStatus("error");
        setError(error.message);
      });
  }, [flashcard, id, setupFlashcardState]);

  const handleUpdateReference = useCallback(
    (id: string) => {
      if (!flashcard) {
        return;
      }
      updateFlashcard(flashcard.id, { reference: id })
        .then((flashcard) => {
          setupFlashcardState(flashcard);
        })
        .catch((error) => {
          setError(error.message);
        });
    },
    [flashcard, setupFlashcardState],
  );

  const handleUpdateFlashcard = useCallback(() => {
    if (!flashcard) {
      return;
    }
    return updateFlashcard(flashcard.id, {
      content: flashcard.content as any,
    })
      .then((flashcard) => {
        console.log(flashcard);
        setupFlashcardState(flashcard);
        setHasChanged(false);
      })
      .catch((error) => {
        setError(error.message);
      });
  }, [flashcard, setupFlashcardState]);

  // const handleCreateFlashcardAndContinue = useCallback(() => {
  //   if (!flashcard) {
  //     return;
  //   }
  //   createFlashcard({
  //     type: "basic",
  //     content: {
  //       front: "",
  //       back: "",
  //     },
  //   }).then((flashcard) => {
  //     window.location.href = `/flashcard/edit/${flashcard.id}`;
  //   });
  // }, [flashcard]);

  const toggleSuspension = useCallback(() => {
    if (!flashcard) {
      return;
    }
    updateFlashcard(flashcard.id, {
      suspended: !flashcard.suspended,
    }).then((flashcard) => {
      setupFlashcardState(flashcard);
    });
  }, [flashcard, setupFlashcardState]);

  const toggleSpecial = useCallback(() => {
    if (!flashcard) {
      return;
    }
    updateFlashcard(flashcard.id, {
      special: !flashcard.special,
    }).then((flashcard) => {
      setupFlashcardState(flashcard);
    });
  }, [flashcard, setupFlashcardState]);

  const advanceDelete = useCallback(() => {
    if (deletePressed) {
      if (!flashcard) {
        return;
      }
      updateFlashcard(flashcard.id, {
        deleted: true,
      }).then(() => {
        window.location.href = "/flashcard";
      });
    } else {
      setDeletePressed(true);
      setTimeout(() => {
        setDeletePressed(false);
      }, 1000);
    }
  }, [deletePressed, flashcard]);

  if (status === "error") {
    return <div>Error: {error}</div>;
  }

  if (status === "loading" || !flashcard) {
    return <div>Loading...</div>;
  }

  return (
    <div className="w-full bg-[#fafafa] dark:bg-[#0a0a0a] relative print:bg-inherit">
      <div className="pt-6 px-6 flex flex-col items-start gap-6">
        <Link
          href="/flashcard"
          className="text-sm text-neutral-600 dark:text-neutral-400 flex items-center gap-2 print:hidden"
        >
          <span className="material-symbols-rounded select-none text-sm -mb-[0.1em]">
            arrow_back
          </span>
          Flashcards
        </Link>
        <ResizableReferenceInput
          initialValue={flashcard.reference}
          onSubmit={handleUpdateReference}
        />
      </div>
      <div className="py-6 flex flex-col gap-6">
        <div className="relative">
          <div className="px-4 py-4 overflow-x-clip flex flex-col gap-6">
            {flashcard.type === "basic" ? (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <h2 className="font-button">front</h2>
                  <div className="p-3 border border-neutral-600 rounded flex gap-4 w-full">
                    <div className="flex-1">
                      <FlashcardEditor
                        initialValue={flashcard.content.front}
                        onChange={(value) => {
                          setHasChanged(true);
                          setFlashcard((flashcard) => {
                            if (!flashcard || flashcard.type !== "basic") {
                              return flashcard;
                            }
                            return {
                              ...flashcard,
                              content: {
                                ...flashcard.content,
                                front: value,
                              },
                            };
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <h2 className="font-button">back</h2>
                  <div className="p-3 border border-neutral-600 rounded flex gap-4 w-full">
                    <div className="flex-1">
                      <FlashcardEditor
                        initialValue={flashcard.content.back}
                        onChange={(value) => {
                          setHasChanged(true);
                          setFlashcard((flashcard) => {
                            if (!flashcard || flashcard.type !== "basic") {
                              return flashcard;
                            }
                            return {
                              ...flashcard,
                              content: {
                                ...flashcard.content,
                                back: value,
                              },
                            };
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  {flashcard.content.steps.map((step, index) => (
                    <>
                      <h2 className="font-button">step {index + 1}</h2>
                      <div className="p-3 border border-neutral-600 rounded flex gap-4 w-full">
                        <div className="flex-1">
                          <div className="flex flex-col gap-2">
                            <span className="font-button">context</span>
                            <FlashcardEditor
                              initialValue={step.context || ""}
                              onChange={(value) => {
                                setHasChanged(true);
                                setFlashcard((flashcard) => {
                                  if (
                                    !flashcard ||
                                    flashcard.type !== "worked"
                                  ) {
                                    return flashcard;
                                  }
                                  return {
                                    ...flashcard,
                                    content: {
                                      ...flashcard.content,
                                      steps: flashcard.content.steps.map(
                                        (step, i) => {
                                          if (i === index) {
                                            return { ...step, context: value };
                                          }
                                          return step;
                                        },
                                      ),
                                    },
                                  };
                                });
                              }}
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <span className="font-button">step</span>
                            <FlashcardEditor
                              initialValue={step.content}
                              onChange={(value) => {
                                setHasChanged(true);
                                setFlashcard((flashcard) => {
                                  if (
                                    !flashcard ||
                                    flashcard.type !== "worked"
                                  ) {
                                    return flashcard;
                                  }
                                  return {
                                    ...flashcard,
                                    content: {
                                      ...flashcard.content,
                                      steps: flashcard.content.steps.map(
                                        (step, i) => {
                                          if (i === index) {
                                            return { ...step, content: value };
                                          }
                                          return step;
                                        },
                                      ),
                                    },
                                  };
                                });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="mx-6 flex justify-between items-start gap-4 print:hidden">
          <button
            className={classNames(
              "py-2 px-4 dark:text-white text-black",
              hasChanged
                ? "bg-green-800 opacity-100"
                : "opacity-50 bg-neutral-300 dark:bg-neutral-800",
            )}
            onClick={() => handleUpdateFlashcard()}
            tabIndex={-1}
          >
            Update
          </button>
          <div className="flex gap-4">
            <button
              // className="py-2 px-4 bg-neutral-300 dark:bg-neutral-800 dark:text-white text-black"
              className={classNames(
                "py-2 px-4 dark:text-white text-black",
                !flashcard.special
                  ? "bg-purple-950"
                  : "bg-yellow-300 dark:bg-yellow-950",
              )}
              onClick={() => toggleSpecial()}
              tabIndex={-1}
            >
              {flashcard.special ? "Make unspecial" : "Make special"}
            </button>
            <button
              // className="py-2 px-4 bg-neutral-300 dark:bg-neutral-800 dark:text-white text-black"
              className={classNames(
                "py-2 px-4 dark:text-white text-black",
                flashcard.suspended
                  ? "bg-yellow-950"
                  : "bg-neutral-300 dark:bg-neutral-800",
              )}
              onClick={() => toggleSuspension()}
              tabIndex={-1}
            >
              {flashcard.suspended ? "Unsuspend" : "Suspend"}
            </button>
            <button
              className={classNames(
                "py-2 px-4  dark:text-white text-black transition-colors duration-200",
                deletePressed ? "dark:bg-red-800" : "dark:bg-red-950",
              )}
              onClick={() => advanceDelete()}
              tabIndex={-1}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
