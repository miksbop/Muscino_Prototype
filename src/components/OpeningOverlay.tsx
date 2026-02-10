import GlassPanel from "./GlassPanel";
import type { OwnedSong } from "../types/song";
import { SafeImage } from "./SafeImage";

type Props = {
  open: boolean;
  state: "rolling" | "revealed";
  rolledSong?: OwnedSong | null;
  onClose: () => void;
};

export function OpeningOverlay({ open, state, rolledSong, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="muscino-opening-overlay" role="dialog" aria-modal="true">
      <div className="muscino-opening-backdrop" onClick={onClose} />

      <div className="muscino-opening-center">
        <GlassPanel className="muscino-opening-panel">
          {state === "rolling" ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="text-3xl md:text-4xl font-medium text-white/90">
                Opening…
              </div>

              <div className="muscino-opening-spinner" aria-hidden="true" />

              <div className="text-white/60 text-sm">
                Rolling a song from this sleeve
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="text-3xl md:text-4xl font-medium text-white/90">
                Sleeve Opened!
              </div>

              <div className="muscino-opening-card">
                <SafeImage
                  src={rolledSong?.coverUrl || ""}
                  alt=""
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              </div>

              <div className="text-center">
                <div className="text-2xl md:text-3xl text-blue-300 font-medium">
                  {rolledSong?.title ?? "Unknown"}
                </div>
                <div className="text-white/70 text-lg">
                  {rolledSong?.artist ?? ""}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white/10 border border-white/10 hover:border-white/20 transition"
                >
                  Close
                </button>

                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-blue-500/70 border border-blue-300/20 hover:bg-blue-500/80 transition"
                >
                  Save to Collection
                </button>
              </div>

              <div className="text-xs text-white/45 pt-1">
                (Already injected into inventory via mock API)
              </div>
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
