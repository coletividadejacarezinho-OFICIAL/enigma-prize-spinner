import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** The one main action on each screen. */
export const GoldButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "btn-gold flex h-14 w-full items-center justify-center gap-2 rounded-2xl px-5 font-display text-xl font-extrabold transition-transform active:scale-[0.98] disabled:opacity-50 disabled:shadow-none [&_svg]:h-6 [&_svg]:w-6",
        className,
      )}
      {...props}
    />
  ),
);
GoldButton.displayName = "GoldButton";

export function SecondaryButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "flex h-11 w-full items-center justify-center gap-2 rounded-xl text-base font-bold text-foreground underline-offset-4 active:bg-secondary [&_svg]:h-5 [&_svg]:w-5",
        className,
      )}
      {...props}
    />
  );
}
