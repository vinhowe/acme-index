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
import {
  createPortalMethod,
  destroyPortalMethod,
} from "./react-portal-extension";
import classNames from "classnames";
import { ReactNode, useCallback, useState } from "react";
import { ocrMathImage } from "@/lib/api";

type ImageWidgetParams = {
  url: string;
};

type ImageComponentParams = ImageWidgetParams & {
  view: EditorView;
};

const ImageComponent = ({ url, view }: ImageComponentParams) => {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const ocrImage = useCallback(() => {
    const fetchImageToBlob = async (url: string) => {
      const imageResponse = await fetch(url, {
        headers: {
          "Content-Type": "image/png",
        },
      });
      const blob = await imageResponse.blob();

      try {
        setState("loading");
        const ocrResponse = await ocrMathImage(blob);
        setState("idle");

        const cursor = view.state.selection.main.head;
        const transaction = view.state.update({
          changes: {
            from: cursor,
            insert: ocrResponse,
          },
        });
        view.dispatch(transaction);
      } catch (error) {
        setState("error");
        console.error(error);
      }
    };

    fetchImageToBlob(url);
  }, [url, view]);

  return (
    <div className="inline-block relative" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} className="block h-auto" alt="inline image" />
      <button
        role="button"
        className={classNames(
          "material-symbols-rounded",
          "select-none",
          "bottom-2",
          "right-2",
          "absolute",
          state !== "error"
            ? "text-black bg-neutral-200"
            : "text-red-900 bg-red-200",
          "text-lg",
          "aspect-square",
          "w-9",
          state === "idle" ? "opacity-60" : "opacity-100",
          "hover:opacity-100",
          "rounded-full",
          state === "loading" && "animate-spin",
        )}
        onClick={() => ocrImage()}
      >
        <span className="aspect-square">
          {state === "error" ? "error" : "document_scanner"}
        </span>
      </button>
    </div>
  );
};

class ImageWidget extends WidgetType {
  readonly url;
  private destroyPortal;

  constructor({ url }: ImageWidgetParams) {
    super();
    this.url = url;
    this.destroyPortal = () => {};
  }

  eq(imageWidget: ImageWidget) {
    return imageWidget.url === this.url;
  }

  toDOM(view: EditorView) {
    const createPortal = view.state.facet(createPortalMethod);
    const dom = document.createElement("div");
    dom.setAttribute("aria-hidden", "true");
    dom.setAttribute("data-image-url", this.url);
    const node = <ImageComponent url={this.url} view={view} />;
    createPortal(node, dom, this.url);
    this.destroyPortal = () => {
      const destroyPortal = view.state.facet(destroyPortalMethod);
      destroyPortal(this.url);
    };
    return dom;
  }

  updateDOM(dom: HTMLElement, view: EditorView): boolean {
    const oldUrl = dom.getAttribute("data-image-url");
    if (!oldUrl) {
      return false;
    }

    const destroyPortal = view.state.facet(destroyPortalMethod);
    destroyPortal(oldUrl);

    const createPortal = view.state.facet(createPortalMethod);
    const node = <ImageComponent url={this.url} view={view} />;
    createPortal(node, dom, this.url);

    dom.setAttribute("data-image-url", this.url);

    return true;
  }

  destroy(dom: HTMLElement): void {
    this.destroyPortal();
    super.destroy(dom);
  }
}

export const imageDisplay = (): Extension => {
  const decorate = (state: EditorState) => {
    const widgets: Range<Decoration>[] = [];

    syntaxTree(state).iterate({
      enter: ({ type, from, to: linkTo, node }) => {
        if (type.name === "Image") {
          const urlChild = node.getChild("URL");
          if (!urlChild) {
            return;
          }
          const { from, to } = urlChild;
          const url = state.sliceDoc(from, to);
          widgets.push(
            Decoration.widget({
              widget: new ImageWidget({ url }),
              side: 1,
            }).range(linkTo),
          );
        }
      },
    });

    return widgets.length > 0 ? RangeSet.of(widgets) : Decoration.none;
  };

  const imageTheme = EditorView.baseTheme({});

  const imageField = StateField.define<DecorationSet>({
    create(state) {
      return decorate(state);
    },
    update(images, transaction) {
      if (transaction.docChanged) {
        return decorate(transaction.state);
      }

      return images.map(transaction.changes);
    },
    provide(field) {
      return EditorView.decorations.from(field);
    },
  });

  return [imageTheme, imageField];
};
