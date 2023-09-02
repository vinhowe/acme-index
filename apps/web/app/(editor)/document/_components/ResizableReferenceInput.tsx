import classNames from "classnames";
import React, { useRef, useState, useEffect, useCallback } from "react";

const PLACEHOLDER = "No reference (click to add)";

export default function ResizableReferenceInput({
  onSubmit,
  initialValue = "",
  initialSelected = false,
}: {
  onSubmit?: (id: string) => void;
  initialValue?: string;
  initialSelected?: boolean;
}) {
  const [value, setValue] = useState<string>(initialValue);
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selected, setSelected] = useState<boolean>(initialSelected);

  const updateWidth = useCallback(() => {
    if (spanRef.current && inputRef.current) {
      inputRef.current.style.width = `${spanRef.current.offsetWidth}px`;
    }
  }, []);

  const finishEditing = useCallback(() => {
    setSelected(false);
    onSubmit?.(value);
  }, [onSubmit, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        finishEditing();
      }
    },
    [finishEditing],
  );

  useEffect(() => {
    updateWidth();
  }, [value, selected, updateWidth]);

  useEffect(() => {
    if (selected) {
      inputRef.current?.focus();
    }
  }, [selected]);

  return (
    <div className="relative -mx-1.5 -my-0.5">
      {selected && (
        <input
          ref={inputRef}
          type="text"
          value={value}
          placeholder={PLACEHOLDER}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => finishEditing()}
          onKeyDown={handleKeyDown}
          autoFocus
          className="text-base focus:outline-none absolute font-button rounded-lg focus:ring-2 ring-blue-500 dark:ring-blue-600 px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-800"
        />
      )}
      <span
        ref={spanRef}
        className={classNames(
          "text-base font-button whitespace-nowrap px-1.5 py-0.5 select-none cursor-pointer inline-block",
          !value && "dark:text-neutral-400",
        )}
        role="button"
        onClick={() => setSelected(true)}
        dangerouslySetInnerHTML={{
          __html: value ? selected ? (value.replaceAll(" ", "&nbsp;") || PLACEHOLDER) : `Reference: ${value}` : PLACEHOLDER,
        }}
      ></span>
    </div>
  );
}
