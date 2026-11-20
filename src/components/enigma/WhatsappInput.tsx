import type { ChangeEvent } from "react";
import { digits, maskWhatsapp } from "@/lib/enigma/partners";
import { fieldClass } from "./fields";

export function WhatsappInput({
  value,
  onValueChange,
}: {
  value: string;
  onValueChange: (value: string) => void;
}) {
  function change(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const raw = input.value;
    const caret = input.selectionStart ?? raw.length;
    let position = digits(raw.slice(0, caret)).length;
    const inputType = (event.nativeEvent as InputEvent).inputType;
    let next = raw;
    // Backspace and Delete should pass through the parentheses, space and hyphen.
    const original = digits(value);
    if (raw.length < value.length && digits(raw) === original) {
      const index =
        inputType === "deleteContentBackward"
          ? position - 1
          : inputType === "deleteContentForward"
            ? position
            : -1;
      const prefixLength = value.startsWith("+55") ? 2 : 0;
      if (index >= prefixLength && index < original.length) {
        next =
          (raw.trimStart().startsWith("+") ? "+" : "(") +
          original.slice(0, index) +
          original.slice(index + 1);
        position = index;
      }
    }
    const formatted = maskWhatsapp(next);
    let cursor = 0;
    for (let seen = 0; cursor < formatted.length && seen < position; cursor++) {
      if (/\d/.test(formatted[cursor] ?? "")) seen++;
    }
    if (caret === raw.length) cursor = formatted.length;
    input.value = formatted;
    input.setSelectionRange(cursor, cursor);
    onValueChange(formatted);
  }

  return (
    <input
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      placeholder="(43) 99999-0000"
      value={value}
      onChange={change}
      className={fieldClass}
    />
  );
}
