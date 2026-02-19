import { useMemo, useState } from "react";

type SafeImageProps = {
  src: string;
  alt: string;
  className?: string;
  draggable?: boolean;
};

const FALLBACK_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 320 320'>
      <rect width='100%' height='100%' fill='rgba(255,255,255,0.08)'/>
      <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='rgba(255,255,255,0.55)' font-family='Arial' font-size='20'>No cover</text>
    </svg>`,
  );

export function SafeImage({ src, alt, className = "", draggable = false }: SafeImageProps) {
  const [broken, setBroken] = useState(false);

  const finalSrc = useMemo(() => {
    if (broken || !src?.trim()) return FALLBACK_SVG;
    return src;
  }, [src, broken]);

  return (
    <img
      src={finalSrc}
      alt={alt}
      className={className}
      draggable={draggable}
      onError={() => setBroken(true)}
    />
  );
}
