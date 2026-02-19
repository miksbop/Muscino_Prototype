import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

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
  delayMs = 1200,
}: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);

  const [needsMarquee, setNeedsMarquee] = useState(false);
  const [durationSec, setDurationSec] = useState(0);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const inner = textRef.current;
    if (!container || !inner) return;

    const containerW = container.clientWidth;
    const textW = inner.scrollWidth;

    const overflow = textW > containerW + 2;
    setNeedsMarquee(overflow);

    if (overflow) {
      const distance = textW + 48;
      setDurationSec(distance / speedPxPerSec);
    }
  }, [text, speedPxPerSec]);

  useEffect(() => {
    const onResize = () => {
      const container = containerRef.current;
      const inner = textRef.current;
      if (!container || !inner) return;

      const containerW = container.clientWidth;
      const textW = inner.scrollWidth;
      const overflow = textW > containerW + 2;
      setNeedsMarquee(overflow);

      if (overflow) {
        const distance = textW + 48;
        setDurationSec(distance / speedPxPerSec);
      }
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [speedPxPerSec]);

  return (
    <div
      ref={containerRef}
      className={[
        "relative w-full min-w-0 overflow-hidden whitespace-nowrap leading-tight",
        "muscino-marquee-mask-right",
        className,
      ].join(" ")}
      style={
        needsMarquee
          ? ({
              ["--marquee-duration" as const]: `${durationSec}s`,
              ["--marquee-delay" as const]: `${delayMs}ms`,
            } as CSSProperties)
          : undefined
      }
    >
      <div className={["inline-block", needsMarquee ? "muscino-marquee" : ""].join(" ")}>
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
