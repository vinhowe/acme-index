import { historyField } from "@codemirror/commands";
import {
  Annotation,
  EditorState,
  Extension,
  StateEffect,
} from "@codemirror/state";
import { EditorView, ViewUpdate } from "@codemirror/view";
import { UseCodeMirror, getDefaultExtensions } from "@uiw/react-codemirror";
import { useEffect, useRef, useState } from "react";

const External = Annotation.define<boolean>();

const emptyExtensions: Extension[] = [];

export function useCodeMirrorCells(
  id: string | null,
  props: Omit<UseCodeMirror, "initialState">,
) {
  const {
    value,
    selection,
    onChange,
    onCreateEditor,
    onUpdate,
    extensions = emptyExtensions,
    autoFocus,
    theme = "light",
    height = null,
    minHeight = null,
    maxHeight = null,
    width = null,
    minWidth = null,
    maxWidth = null,
    placeholder: placeholderStr = "",
    editable = true,
    readOnly = false,
    indentWithTab: defaultIndentWithTab = true,
    basicSetup: defaultBasicSetup = true,
    root,
  } = props;
  const [container, setContainer] = useState<HTMLDivElement>();
  const [view, setView] = useState<EditorView>();
  const [state, setState] = useState<EditorState>();
  const [lastId, setLastId] = useState<string | null>(null);
  const editorStateRef = useRef<EditorState>();
  const serializedEditorStatesRef = useRef<Record<string, unknown>>({});

  const defaultThemeOption = EditorView.theme({
    "&": {
      height,
      minHeight,
      maxHeight,
      width,
      minWidth,
      maxWidth,
    },
    "& .cm-scroller": {
      height: "100% !important",
    },
  });
  const updateListener = EditorView.updateListener.of((vu: ViewUpdate) => {
    if (
      // Fix echoing of the remote changes:
      // If transaction is market as remote we don't have to call `onChange` handler again
      !vu.transactions.some((tr) => tr.annotation(External))
    ) {
      if (vu.docChanged && typeof onChange === "function") {
        const doc = vu.state.doc;
        const value = doc.toString();
        onChange(value, vu);
      }
      editorStateRef.current = vu.state;
    }
  });

  const defaultExtensions = getDefaultExtensions({
    theme,
    editable,
    readOnly,
    placeholder: placeholderStr,
    indentWithTab: defaultIndentWithTab,
    basicSetup: defaultBasicSetup,
  });

  let getExtensions = [
    updateListener,
    defaultThemeOption,
    ...defaultExtensions,
  ];

  if (onUpdate && typeof onUpdate === "function") {
    getExtensions.push(EditorView.updateListener.of(onUpdate));
  }
  getExtensions = getExtensions.concat(extensions);

  useEffect(() => {
    if (container && !state) {
      const config = {
        doc: value,
        selection,
        extensions: getExtensions,
      };
      let serializedEditorState: any;
      if (id) {
        serializedEditorState = serializedEditorStatesRef.current[id];
      }
      const stateCurrent = serializedEditorState
        ? EditorState.fromJSON(serializedEditorState, config, {
            history: historyField,
          })
        : EditorState.create(config);
      setState(stateCurrent);
      if (!view) {
        const viewCurrent = new EditorView({
          state: stateCurrent,
          parent: container,
          root,
        });
        setView(viewCurrent);
        onCreateEditor && onCreateEditor(viewCurrent, stateCurrent);
      }
      setLastId(id);
    }
    if (!container && lastId) {
      serializedEditorStatesRef.current[lastId] =
        editorStateRef.current?.toJSON({ history: historyField });
      setLastId(null);
    }
    return () => {
      if (view) {
        setState(undefined);
        setView(undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container, state, id, lastId]);

  useEffect(
    () => () => {
      if (view) {
        view.destroy();
        setView(undefined);
      }
    },
    [view],
  );

  useEffect(() => {
    if (autoFocus && view) {
      view.focus();
    }
  }, [autoFocus, view]);

  useEffect(() => {
    if (view) {
      view.dispatch({ effects: StateEffect.reconfigure.of(getExtensions) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    theme,
    extensions,
    height,
    minHeight,
    maxHeight,
    width,
    minWidth,
    maxWidth,
    placeholderStr,
    editable,
    readOnly,
    defaultIndentWithTab,
    defaultBasicSetup,
    onChange,
    onUpdate,
  ]);

  useEffect(() => {
    if (value === undefined) {
      return;
    }
    const currentValue = view ? view.state.doc.toString() : "";
    if (view && value !== currentValue) {
      view.dispatch({
        changes: { from: 0, to: currentValue.length, insert: value || "" },
        annotations: [External.of(true)],
      });
    }
  }, [value, view]);

  return { setContainer };
}
