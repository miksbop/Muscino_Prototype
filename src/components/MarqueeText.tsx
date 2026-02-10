import { useEffect, useLayoutEffect, useRef, useState } from "react";

type MarqueeTextProps = {
  text: string;
  className?: string;
  speedPxPerSec?: number;
  delayMs?: number;
};

export function MarqueeText({
  text,
  className = "",
  speedPxPerSec = 28,
  delayMs = 1200, // ✅ delay before scrolling starts
}: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);

  const [needsMarquee, setNeedsMarquee] = useState(false);
  const [durationSec, setDurationSec] = useState(0);

  const measure = () => {
    const container = containerRef.current;
    const inner = textRef.current;
    if (!container || !inner) return;

    const containerW = container.clientWidth;
    const textW = inner.scrollWidth;

    const overflow = textW > containerW + 2;
    setNeedsMarquee(overflow);

    if (overflow) {
      const distance = textW + 48; // gap
      setDurationSec(distance / speedPxPerSec);
    }
  };

  useLayoutEffect(() => {
    measure();
  }, [text]);

  useEffect(() => {
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div
      ref={containerRef}
      className={[
        "relative w-full min-w-0 overflow-hidden whitespace-nowrap leading-tight",
        // ✅ Fade mask on edges (webkit + standard)
        "muscino-marquee-mask-right",
        className,
      ].join(" ")}
      style={
        needsMarquee
          ? ({
              ["--marquee-duration" as any]: `${durationSec}s`,
              ["--marquee-delay" as any]: `${delayMs}ms`,
            } as React.CSSProperties)
          : undefined
      }
    >
      <div
        className={[
          "inline-block",
          needsMarquee ? "muscino-marquee" : "",
        ].join(" ")}
      >
        <div ref={textRef} className="inline-block pr-12">
          {text}
        </div>

        {needsMarquee && (
          <div className="inline-block pr-12" aria-hidden="true">
            {text}
          </div>
        )}
      </div>
    </div>
  );
}
