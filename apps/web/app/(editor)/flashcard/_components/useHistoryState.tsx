import { useCallback, useState } from "react";

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useHistoryState<T>(
  initialState: T,
  maxHistoryLength: number = Infinity,
) {
  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const set = useCallback(
    (newState: T | ((prevState: T) => T)) => {
      setState((currentState) => {
        const resolvedState =
          typeof newState === "function"
            ? (newState as (prevState: T) => T)(currentState.present)
            : newState;

        const newPast = [...currentState.past, currentState.present];

        while (newPast.length > maxHistoryLength) {
          newPast.shift();
        }

        return {
          past: newPast,
          present: resolvedState,
          future: [],
        };
      });
    },
    [maxHistoryLength],
  );

  const setWithoutHistory = useCallback(
    (newState: T | ((prevState: T) => T)) => {
      setState((currentState) => {
        const resolvedState =
          typeof newState === "function"
            ? (newState as (prevState: T) => T)(currentState.present)
            : newState;

        return {
          past: currentState.past,
          present: resolvedState,
          future: currentState.future,
        };
      });
    },
    [],
  );

  const undo = useCallback(() => {
    setState((currentState) => {
      if (currentState.past.length === 0) return currentState;

      const newPast = [...currentState.past];
      const previousState = newPast.pop() as T;

      return {
        past: newPast,
        present: previousState,
        future: [currentState.present, ...currentState.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setState((currentState) => {
      if (currentState.future.length === 0) return currentState;

      const newFuture = [...currentState.future];
      const nextState = newFuture.shift() as T;

      return {
        past: [...currentState.past, currentState.present],
        present: nextState,
        future: newFuture,
      };
    });
  }, []);

  const clearHistory = useCallback(() => {
    setState((currentState) => ({
      past: [],
      present: currentState.present,
      future: [],
    }));
  }, []);

  return {
    state: state.present,
    set,
    setWithoutHistory,
    undo,
    redo,
    clearHistory,
  };
}
