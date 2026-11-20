import { useCallback, useEffect, useRef, useState } from "react";

import { GoldButton } from "@/components/enigma/GoldButton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const HOLD_MS = 1500;

export function HoldToSpinButton({
  onPress,
  onStart,
}: {
  onPress: () => void;
  onStart: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | null>(null);
  const pointer = useRef<number | null>(null);
  const start = useRef(onStart);
  const [holding, setHolding] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const cancelHold = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    pointer.current = null;
    setHolding(false);
  }, []);

  useEffect(() => {
    start.current = onStart;
  }, [onStart]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) cancelHold();
    }
    window.addEventListener("blur", cancelHold);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      window.removeEventListener("blur", cancelHold);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [cancelHold]);

  return (
    <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <GoldButton
        ref={button}
        type="button"
        className="relative touch-none select-none overflow-hidden px-2 text-base leading-tight"
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0 || pointer.current !== null || confirmOpen)
            return;
          onPress();
          pointer.current = event.pointerId;
          event.currentTarget.setPointerCapture?.(event.pointerId);
          setHolding(true);
          timer.current = window.setTimeout(() => {
            // Keep ownership of the pointer until release, even after the hold completes.
            timer.current = null;
            setHolding(false);
            start.current();
          }, HOLD_MS);
        }}
        onPointerMove={(event) => {
          if (event.pointerId !== pointer.current || timer.current === null) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            cancelHold();
        }}
        onPointerUp={(event) => {
          if (event.pointerId === pointer.current) cancelHold();
        }}
        onPointerCancel={(event) => {
          if (event.pointerId === pointer.current) cancelHold();
        }}
        onLostPointerCapture={(event) => {
          if (event.pointerId === pointer.current) cancelHold();
        }}
        onBlur={cancelHold}
        onContextMenu={(event) => event.preventDefault()}
        onClick={(event) => {
          // Keyboard and assistive technology use a separate confirmation.
          if (event.detail === 0 && pointer.current === null) setConfirmOpen(true);
        }}
      >
        {holding && (
          <span
            aria-hidden="true"
            className="absolute inset-0 origin-left bg-black/20"
            style={{ animation: `enigma-hold-fill ${HOLD_MS}ms linear both` }}
          />
        )}
        <span className="relative">Pressione e segure</span>
      </GoldButton>

      <AlertDialogContent
        className="max-w-[calc(100vw-2rem)] rounded-2xl border-border bg-card sm:max-w-md"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          button.current?.focus();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>Iniciar o sorteio?</AlertDialogTitle>
          <AlertDialogDescription>A roleta vai girar ao confirmar.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onStart}>Iniciar sorteio</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
