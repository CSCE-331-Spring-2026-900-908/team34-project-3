"use client";

import { useEffect, useRef, useState } from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { TouchKeyboard } from "@/components/touch-keyboard";

type TouchscreenInputProps = Omit<InputProps, "onChange" | "value"> & {
  onKeyboardOpenChange?: (open: boolean) => void;
  onValueChange: (value: string) => void;
  value: string;
};

export function TouchscreenInput({
  onBlur,
  onFocus,
  onKeyboardOpenChange,
  onValueChange,
  value,
  ...props
}: TouchscreenInputProps) {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [shift, setShift] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    onKeyboardOpenChange?.(isKeyboardOpen);
  }, [isKeyboardOpen, onKeyboardOpenChange]);

  useEffect(() => {
    if (!isKeyboardOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (containerRef.current?.contains(target)) {
        return;
      }

      setIsKeyboardOpen(false);
      setShift(false);
    }

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isKeyboardOpen]);

  function openKeyboard() {
    setIsKeyboardOpen(true);
  }

  function appendValue(nextChunk: string) {
    onValueChange(`${value}${nextChunk}`);

    if (shift) {
      setShift(false);
    }
  }

  function handleBackspace() {
    onValueChange(value.slice(0, -1));
  }

  function handleClear() {
    onValueChange("");
  }

  return (
    <div ref={containerRef}>
      <Input
        {...props}
        ref={inputRef}
        value={value}
        inputMode="none"
        autoComplete="off"
        onChange={(event) => onValueChange(event.target.value)}
        onFocus={(event) => {
          openKeyboard();
          onFocus?.(event);
        }}
        onClick={openKeyboard}
        onBlur={onBlur}
      />

      {isKeyboardOpen ? (
        <TouchKeyboard
          shift={shift}
          onInput={appendValue}
          onBackspace={handleBackspace}
          onClear={handleClear}
          onToggleShift={() => setShift((current) => !current)}
          onClose={() => {
            setIsKeyboardOpen(false);
            setShift(false);
          }}
          onSubmit={() => {
            setIsKeyboardOpen(false);
            setShift(false);
            inputRef.current?.blur();
          }}
        />
      ) : null}
    </div>
  );
}
