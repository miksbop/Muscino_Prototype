import { TopNav } from "./components/TopNav";
import { CollectionPage } from "./pages/CollectionPage";

function App() {
  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <TopNav />

      {/* Page outlet */}
      <CollectionPage />
    </div>
  );
}

export default App;
