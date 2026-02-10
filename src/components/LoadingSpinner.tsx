type LoadingSpinnerProps = {
  label?: string;
  size?: number; // px
};

export function LoadingSpinner({ label = "Loading", size = 44 }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className="rounded-full border border-white/15 border-t-white/70 animate-spin motion-reduce:animate-none"
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
      {/* Screen-reader accessible label (and optional visible label if you want) */}
      <span className="sr-only" role="status" aria-live="polite">
        {label}
      </span>
    </div>
  );
}
