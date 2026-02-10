//AppLayout.csx
import { Outlet } from "react-router-dom";
import { TopNav } from "../components/TopNav";

export function AppLayout() {
  return (
    <div className="h-screen flex flex-col bg-neutral-950 text-white overflow-hidden">
      <TopNav />

      {/* This becomes the “viewport” for pages */}
      <main className="flex-1 min-h-0">
        <Outlet />
      </main>
    </div>
  );
}
