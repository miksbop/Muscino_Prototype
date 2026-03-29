import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { api } from "../services/api";
import type { MarketListing } from "../types/market";
import { useAuth } from "../context/useAuth";
import { rarityRgb, rarityTextClass } from "../types/rarity";
import { LoadingSpinner } from "../components/LoadingSpinner";
import { MarqueeText } from "../components/MarqueeText";
import GlassPanel from "../components/GlassPanel";

type SortDirection = "asc" | "desc";

const DEFAULT_AVATAR =
  "https://avatars.fastly.steamstatic.com/dafbf49a3013de1a9528e06e796f49b8a8bdfef2_full.jpg";
const ROWS_PER_PAGE = 6;
const BASE_MARKET_WIDTH = 1680;
const BASE_MARKET_HEIGHT = 920;
const VIEWPORT_GUTTER_X = 64;
const VIEWPORT_GUTTER_Y = 72;

export function MarketPage() {
  const { user, refreshUser } = useAuth();
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [costSortDirection, setCostSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [fitScale, setFitScale] = useState(1);
  const [runEntryAnimation, setRunEntryAnimation] = useState(true);

  const loadListings = async () => {
    setLoading(true);
    try {
      const data = await api.getMarketListings();
      setListings(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadListings();
  }, []);

  useEffect(() => {
    const computeScale = () => {
      const navHeight = 56;
      const availableWidth = window.innerWidth - VIEWPORT_GUTTER_X;
      const availableHeight = window.innerHeight - navHeight - VIEWPORT_GUTTER_Y;
      const scaleX = availableWidth / BASE_MARKET_WIDTH;
      const scaleY = availableHeight / BASE_MARKET_HEIGHT;

      setFitScale(Math.min(scaleX, scaleY, 1));
    };

    computeScale();
    window.addEventListener("resize", computeScale);
    return () => window.removeEventListener("resize", computeScale);
  }, []);

  useEffect(() => {
    if (loading) return;

    const timeout = window.setTimeout(() => {
      setRunEntryAnimation(false);
    }, 850);

    return () => window.clearTimeout(timeout);
  }, [loading]);

  const buyListing = async (listingId: number) => {
    if (buyingId !== null) return;
    try {
      setBuyingId(listingId);
      await api.buyMarketListing(listingId);
      await Promise.all([refreshUser(), loadListings()]);
      window.alert("Purchase complete.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to complete purchase.";
      window.alert(message);
    } finally {
      setBuyingId(null);
    }
  };

  const genreOptions = useMemo(() => {
    const genres = [...new Set(listings.map((listing) => listing.genre))].sort((a, b) => a.localeCompare(b));
    return ["all", ...genres];
  }, [listings]);

  const filteredListings = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return listings
      .filter((listing) => {
        if (genreFilter === "all") return true;
        return listing.genre === genreFilter;
      })
      .filter((listing) => {
        if (!normalizedSearch) return true;
        const haystack = `${listing.title} ${listing.artist} ${listing.seller} ${listing.genre}`.toLowerCase();
        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => (costSortDirection === "asc" ? a.price - b.price : b.price - a.price));
  }, [listings, genreFilter, search, costSortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredListings.length / ROWS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
  }, [genreFilter, search, costSortDirection]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedListings = useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredListings.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [filteredListings, currentPage]);

  const paginationPages = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, idx) => idx + 1);
    }

    const pages = new Set<number>([1, 2, totalPages - 1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    return [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  }, [currentPage, totalPages]);

  const fillerRows = Math.max(0, ROWS_PER_PAGE - pagedListings.length);

  const rowGridClass =
    "grid grid-cols-[112px_minmax(0,2.3fr)_minmax(0,1.85fr)_minmax(0,1.35fr)_120px_144px] items-center gap-x-6";

  return (
    <div className="flex h-full items-center justify-center overflow-hidden bg-neutral-950 px-8 py-8 text-white">
      <div
        className="relative"
        style={{
          width: `${BASE_MARKET_WIDTH * fitScale}px`,
          height: `${BASE_MARKET_HEIGHT * fitScale}px`,
        }}
      >
        <div className="market-side-label tracking-wide"></div>
        <div
          className="origin-top-left"
          style={{
            width: `${BASE_MARKET_WIDTH}px`,
            height: `${BASE_MARKET_HEIGHT}px`,
            transform: `scale(${fitScale})`,
          }}
        >
          <div className="market-page-unscaled relative h-full w-full">
            <GlassPanel
              className="h-full min-h-0 flex flex-col p-4 rarity-rotating-border rarity-rim-sweep rarity-bg-wash"
              style={{ ["--rarity-rgb" as const]: "255 255 255" } as CSSProperties}
            >
              {loading ? (
                <div className="h-full grid place-items-center">
                  <LoadingSpinner />
                </div>
              ) : filteredListings.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-neutral-300">No matching listings found.</div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 px-3 pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2 text-sm text-neutral-300">
                      <label htmlFor="genre-filter">Genre:</label>
                      <select
                        id="genre-filter"
                        value={genreFilter}
                        onChange={(event) => {
                          setGenreFilter(event.target.value);
                        }}
                        className="rounded-md border border-white/20 bg-neutral-900 px-2 py-1"
                      >
                        {genreOptions.map((genre) => (
                          <option key={genre} value={genre}>
                            {genre === "all" ? "All" : genre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <input
                      type="search"
                      value={search}
                      onChange={(event) => {
                        setSearch(event.target.value);
                      }}
                      placeholder="Search..."
                      className="w-[26rem] max-w-[42%] rounded-md border border-white/20 bg-neutral-900 px-3 py-1.5 text-sm"
                    />
                  </div>

                  <div className={`${rowGridClass} text-neutral-400 text-sm px-3 py-3 border-b border-white/10`}>
                    <div>Cover</div>
                    <div>Song Name</div>
                    <div>Artist</div>
                    <div>Listed By</div>
                    <button
                      type="button"
                      onClick={() => {
                        setCostSortDirection((current) => (current === "asc" ? "desc" : "asc"));
                      }}
                      className="text-left hover:text-white"
                    >
                      Cost {costSortDirection === "asc" ? "↑" : "↓"}
                    </button>
                    <div />
                  </div>

                  <div className="flex-1 min-h-0 grid grid-rows-6 gap-3 py-3">
                    {pagedListings.map((listing, index) => {
                      const isOwn = user?.username === listing.seller;
                      const buyingThis = buyingId === listing.id;

                      return (
                        <div
                          key={listing.id}
                          className={`${rowGridClass} market-listing-row h-full min-h-0 rounded-lg bg-black/30 px-4 py-4 ${
                            runEntryAnimation ? "market-listing-row--drop-in" : ""
                          }`}
                          style={{
                            ["--rarity-rgb" as const]: rarityRgb(listing.rarity),
                            animationDelay: `${index * 75}ms`,
                          } as CSSProperties}
                        >
                          <div className="flex items-center justify-center">
                            <img
                              src={listing.coverUrl}
                              alt=""
                              className="rarity-thin-border w-20 h-20 rounded-md object-contain bg-black/40"
                              style={{ ["--rarity-rgb" as const]: rarityRgb(listing.rarity) } as CSSProperties}
                              draggable={false}
                            />
                          </div>

                          <div className="min-w-0 pr-2">
                            <div className="font-semibold text-[1.08rem] leading-tight truncate">{listing.title}</div>
                            <div className="text-[0.98rem] text-neutral-400 truncate mt-0.5">
                              {listing.genre} · <span className={rarityTextClass(listing.rarity)}>{listing.rarity}</span>
                            </div>
                          </div>

                          <div className="min-w-0">
                            <MarqueeText text={listing.artist} className="text-[1.1rem] text-neutral-200" speedPxPerSec={24} delayMs={900} />
                          </div>

                          <div className="flex items-center gap-2.5 min-w-0">
                            <img
                              src={listing.sellerAvatarUrl || DEFAULT_AVATAR}
                              alt={`${listing.seller} avatar`}
                              className="w-12 h-12 rounded-md border border-white/20 object-cover"
                              draggable={false}
                            />
                            <span className="text-[1.06rem] text-neutral-200 truncate">{listing.seller}</span>
                          </div>

                          <div className="text-blue-300 font-semibold tabular-nums text-[1.1rem] truncate">{listing.price}</div>

                          <div className="flex justify-start">
                            <button
                              type="button"
                              disabled={isOwn || buyingId !== null}
                              onClick={() => {
                                void buyListing(listing.id);
                              }}
                              className="px-4 py-2.5 rounded-md text-[1rem] border border-white/15 bg-white/10 hover:bg-white/15 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                              {isOwn ? "Your listing" : buyingThis ? "Buying..." : "Purchase"}
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {Array.from({ length: fillerRows }).map((_, idx) => (
                      <div key={`filler-${idx}`} className={`${rowGridClass} rounded-lg border border-white/0 px-4 py-4 opacity-0`} aria-hidden="true" />
                    ))}
                  </div>

                  <div className="mt-2 border-t border-white/10 pt-3 px-3 flex items-center justify-between text-sm text-neutral-300">
                    <div>
                      Showing {(currentPage - 1) * ROWS_PER_PAGE + (pagedListings.length ? 1 : 0)}-
                      {(currentPage - 1) * ROWS_PER_PAGE + pagedListings.length} of {filteredListings.length}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        disabled={currentPage === 1}
                        className="px-2.5 py-1 rounded border border-white/15 disabled:opacity-50"
                      >
                        Prev
                      </button>

                      {paginationPages.map((page, idx) => {
                        const previous = paginationPages[idx - 1];
                        const showGap = previous !== undefined && page - previous > 1;

                        return (
                          <span key={`page-${page}`} className="flex items-center gap-1.5">
                            {showGap ? <span className="px-1 text-neutral-500">…</span> : null}
                            <button
                              type="button"
                              onClick={() => setCurrentPage(page)}
                              className={`px-2.5 py-1 rounded border ${
                                page === currentPage
                                  ? "border-white/40 bg-white/15 text-white"
                                  : "border-white/15 text-neutral-300 hover:text-white"
                              }`}
                            >
                              {page}
                            </button>
                          </span>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                        disabled={currentPage === totalPages}
                        className="px-2.5 py-1 rounded border border-white/15 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </GlassPanel>
          </div>
        </div>
      </div>
    </div>
  );
}