import { Route, Routes } from "react-router-dom";
import { RoutesListPage } from "@/pages/dashboard/RoutesListPage";
import { CreateRoutePage } from "@/pages/routes/CreateRoutePage";
import { RouteDetailPage } from "@/pages/routes/RouteDetailPage";
import { NotFoundPage } from "@/pages/not-found/NotFoundPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RoutesListPage />} />
      <Route path="/rute/baru" element={<CreateRoutePage />} />
      <Route path="/rute/:routeId" element={<RouteDetailPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
