import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { env } from "@/config/env";
import { AppRoutes } from "@/routes/AppRoutes";

const engineLabel = env.isGoogleEnabled ? "Google Maps" : "OSRM · OSM";

export default function App() {
  return (
    <BrowserRouter>
      <AppShell engineLabel={engineLabel}>
        <AppRoutes />
      </AppShell>
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{ style: { fontFamily: "inherit" } }}
      />
    </BrowserRouter>
  );
}
