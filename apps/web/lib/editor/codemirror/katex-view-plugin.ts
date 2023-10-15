import { syntaxTree } from "@codemirror/language";
import {
  EditorState,
  Extension,
  Range,
  RangeSet,
  StateField,
} from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
} from "@codemirror/view";
import katex from "katex"; // Make sure to import KaTeX

interface KaTeXWidgetParams {
  latex: string;
  display: boolean;
}

const katexWorker = new Worker(new URL("./katex-worker.ts", import.meta.url));

// Create a promise-based mechanism to get the result
const renderLatex = (
  latex: string,
  { displayMode = false }: { displayMode: boolean },
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const id = Date.now().toString(); // A simple way to identify messages
    katexWorker.onmessage = (e) => {
      if (e.data.id === id) {
        if (e.data.error) {
          reject();
        } else {
          resolve(e.data.rendered);
        }
      }
    };

    katexWorker.postMessage({ id, latex, displayMode });
  });
};

class KaTeXWidget extends WidgetType {
  readonly latex;
  readonly display;
  constructor({ latex, display }: KaTeXWidgetParams) {
    super();
    this.latex = latex;
    this.display = display;
  }

  eq(kaTeXWidget: KaTeXWidget) {
    return kaTeXWidget.latex === this.latex;
  }

  toDOM() {
    const container = document.createElement("div");
    container.setAttribute("aria-hidden", "true");
    container.className = this.display ? "block" : "inline-block mx-1 p-1";

    try {
      // The initial render is done synchronously
      let renderedKatex = katex.renderToString(this.latex, {
        displayMode: this.display,
        throwOnError: false,
      });
      container.innerHTML = renderedKatex;
    } catch (error) {
      console.log(error);
      // Ignore these because they will happen all the time
    }

    container.style.backgroundColor = this.display
      ? ""
      : "color-mix(in srgb, currentColor 8%, transparent)";
    container.style.borderRadius = "0.25rem";

    return container;
  }

  updateDOM(dom: HTMLElement, _view: EditorView): boolean {
    try {
      // All subsequent updates will be done via the worker
      renderLatex(this.latex, { displayMode: this.display }).then(
        (rendered) => {
          dom.innerHTML = rendered;
        },
      );
    } catch (error) {
      // Ignore these because they will happen all the time
    }
    return true;
  }
}

export const katexDisplay = (): Extension => {
  const decorate = (state: EditorState) => {
    const widgets: Range<Decoration>[] = [];

    syntaxTree(state).iterate({
      enter: ({ type, from, to }) => {
        if (
          type.name === "BlockMathDollar" ||
          type.name === "BlockMathBracket" ||
          type.name === "InlineMathDollar" ||
          type.name === "InlineMathBracket"
        ) {
          let latexString = state.doc.sliceString(from, to);
          let display;
          if (
            type.name === "BlockMathDollar" ||
            type.name === "BlockMathBracket"
          ) {
            latexString = latexString.slice(2, -2);
            display = true;
          } else if (
            type.name === "InlineMathDollar" ||
            type.name === "InlineMathBracket"
          ) {
            latexString = latexString.slice(1, -1);
            display = false;
          }
          widgets.push(
            Decoration.widget({
              widget: new KaTeXWidget({
                latex: latexString,
                display: display || false,
              }),
              side: -1,
            }).range(to),
          );
        }
      },
    });

    return widgets.length > 0 ? RangeSet.of(widgets) : Decoration.none;
  };

  const katexTheme = EditorView.baseTheme({
    ".cm-katex-container": {},
  });

  const katexField = StateField.define<DecorationSet>({
    create(state) {
      return decorate(state);
    },
    update(katexs, transaction) {
      if (transaction.docChanged) {
        return decorate(transaction.state);
      }

      return katexs.map(transaction.changes);
    },
    provide(field) {
      return EditorView.decorations.from(field);
    },
  });

  return [katexTheme, katexField];
};
