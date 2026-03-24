import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import AboutPage from "./pages/AboutPage";
import DashboardPage from "./pages/DashboardPage";
import GeneratorPage from "./pages/GeneratorPage";
import TemplatesPage from "./pages/TemplatesPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />} path="/">
        <Route element={<GeneratorPage />} index />
        <Route element={<TemplatesPage />} path="templates" />
        <Route element={<DashboardPage />} path="dashboard" />
        <Route element={<AboutPage />} path="about" />
        <Route element={<Navigate to="/" replace />} path="*" />
      </Route>
    </Routes>
  );
}
