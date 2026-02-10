// src/components/GlassPanel.tsx
import type { HTMLAttributes, ReactNode } from "react";

type GlassPanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export default function GlassPanel({
  children,
  className = "",
  ...props
}: GlassPanelProps) {
  return (
    <div
      {...props}
      className={[
        "rounded-2xl bg-neutral-900/50 border border-white/10",
        "backdrop-blur-md",
         "p-5 md:p-5",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
