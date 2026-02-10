import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { AppLayout } from "./layouts/AppLayout";
import { CollectionPage } from "./pages/CollectionPage";
import HomePage from "./pages/HomePage";
import { PlayPage } from "./pages/PlayPage";

import "./styles/index.css";            // Tailwind + global rules        // (TEMP) unsorted shared rules bucket
import "./styles/shared/ui.css";        // shared utilities (new drawer)
import "./styles/shared/effects.css";   // shared effects (new drawer)
import "./styles/pages/home.css";       // Home page styles
import "./styles/pages/collection.css"; // Collection page style

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: "/", element: <HomePage /> },
      { path: "/collection", element: <CollectionPage /> },
      { path: "/Play", element: <PlayPage /> },
      // market/profile later
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);
