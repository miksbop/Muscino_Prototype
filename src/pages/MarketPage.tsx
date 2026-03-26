import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { MarketListing } from "../types/market";
import { useAuth } from "../context/useAuth";
import { rarityTextClass } from "../types/rarity";
import { LoadingSpinner } from "../components/LoadingSpinner";

export function MarketPage() {
  const { user, refreshUser } = useAuth();
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingId, setBuyingId] = useState<number | null>(null);

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

  return (
    <div className="h-full bg-neutral-950 text-white overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-6">
        <h1 className="text-2xl font-semibold mb-1">Market</h1>
        <p className="text-sm text-neutral-400 mb-6">Buy songs listed by other players.</p>

        {loading ? (
          <div className="grid place-items-center py-16">
            <LoadingSpinner />
          </div>
        ) : listings.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-neutral-300">
            No active listings yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((listing) => {
              const isOwn = user?.username === listing.seller;
              const buyingThis = buyingId === listing.id;

              return (
                <div key={listing.id} className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-3">
                  <div className="w-full aspect-square rounded-lg overflow-hidden bg-black/20 border border-white/10">
                    <img src={listing.coverUrl} alt="" className="w-full h-full object-cover" draggable={false} />
                  </div>

                  <div>
                    <div className="font-semibold truncate">{listing.title}</div>
                    <div className="text-sm text-neutral-300 truncate">{listing.artist}</div>
                    <div className="text-xs text-neutral-400 mt-1">
                      {listing.genre} · <span className={rarityTextClass(listing.rarity)}>{listing.rarity}</span>
                    </div>
                    <div className="text-xs text-neutral-400 mt-1">Seller: {listing.seller}</div>
                  </div>

                  <div className="mt-auto flex items-center justify-between gap-2">
                    <div className="text-blue-300 font-semibold">{listing.price}</div>
                    <button
                      type="button"
                      disabled={isOwn || buyingId !== null}
                      onClick={() => {
                        void buyListing(listing.id);
                      }}
                      className="px-3 py-1.5 rounded-md text-sm border border-white/15 bg-white/10 hover:bg-white/15 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {isOwn ? "Your listing" : buyingThis ? "Buying..." : "Buy"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}