"use client";

import { Delete, CornerDownLeft, Eraser, ChevronUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const KEY_ROWS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
] as const;

type TouchKeyboardProps = {
  className?: string;
  onBackspace: () => void;
  onClear: () => void;
  onClose: () => void;
  onInput: (nextValue: string) => void;
  onSubmit?: () => void;
  onToggleShift: () => void;
  shift: boolean;
};

export function TouchKeyboard({
  className,
  onBackspace,
  onClear,
  onClose,
  onInput,
  onSubmit,
  onToggleShift,
  shift,
}: TouchKeyboardProps) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 shadow-[0_-20px_60px_rgba(0,0,0,0.12)] backdrop-blur",
        className
      )}
    >
      <div className="mx-auto flex h-[min(56vh,32rem)] max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="icon" onClick={onClose} className="h-12 w-12 shrink-0 rounded-2xl">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid flex-1 gap-3">
          {KEY_ROWS.map((row, rowIndex) => (
            <div
              key={row.join("")}
              className={cn(
                "grid gap-3",
                rowIndex === 2 ? "grid-cols-[1.1fr_repeat(9,minmax(0,1fr))_1.1fr]" : "",
                rowIndex === 3 ? "grid-cols-[1.35fr_repeat(7,minmax(0,1fr))_1.35fr]" : "",
                rowIndex < 2 ? "grid-cols-10" : ""
              )}
            >
              {rowIndex === 2 ? (
                <KeyboardActionButton label={shift ? "Shift On" : "Shift"} onClick={onToggleShift} icon={ChevronUp} />
              ) : null}

              {row.map((key) => {
                const displayKey = shift ? key.toUpperCase() : key;

                return (
                  <KeyboardKey
                    key={key}
                    label={displayKey}
                    onClick={() => onInput(displayKey)}
                  />
                );
              })}

              {rowIndex === 2 ? (
                <KeyboardActionButton label="Backspace" onClick={onBackspace} icon={Delete} />
              ) : null}

              {rowIndex === 3 ? (
                <KeyboardActionButton label="Clear" onClick={onClear} icon={Eraser} />
              ) : null}

              {rowIndex === 3 ? (
                <KeyboardActionButton label="Done" onClick={onSubmit ?? onClose} icon={CornerDownLeft} />
              ) : null}
            </div>
          ))}

          <div className="grid grid-cols-[1fr_2.4fr_1fr] gap-3">
            <KeyboardKey label="," onClick={() => onInput(",")} />
            <KeyboardKey label="Space" onClick={() => onInput(" ")} className="font-semibold" />
            <KeyboardKey label="." onClick={() => onInput(".")} />
          </div>
        </div>
      </div>
    </div>
  );
}

function KeyboardKey({
  className,
  label,
  onClick,
}: {
  className?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-14 rounded-2xl border border-stone-200 bg-stone-50 px-4 text-lg font-medium text-stone-900 shadow-sm transition hover:bg-stone-100 active:scale-[0.98]",
        className
      )}
    >
      {label}
    </button>
  );
}

function KeyboardActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof ChevronUp;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 text-base font-semibold text-stone-700 shadow-sm transition hover:bg-stone-100 active:scale-[0.98]"
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}
