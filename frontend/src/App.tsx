import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Shell } from "./components/Shell";
import { ToastProvider } from "./components/Toast";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { OrgDetailPage } from "./pages/OrgDetail";
import { SponsorDetailPage } from "./pages/SponsorDetail";
import { DealDetailPage } from "./pages/DealDetail";
import { TicketsPage } from "./pages/Tickets";
import { TicketDetailPage } from "./pages/TicketDetail";
import { ClaimsPage } from "./pages/Claims";
import { ClaimDetailPage } from "./pages/ClaimDetail";
import { PortalPage } from "./pages/Portal";
import { SettingsPage } from "./pages/Settings";
import { getToken } from "./lib/api";

function PrivateRoute({ children }: { children: React.ReactNode }) {
  return getToken() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
      <Shell>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/portal/sponsor/:token" element={<PortalPage />} />
          <Route path="/portal/deal/:token" element={<PortalPage />} />
          <Route path="/portal" element={<PortalPage />} />

          <Route path="/" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
          <Route path="/org/:orgId" element={<PrivateRoute><OrgDetailPage /></PrivateRoute>} />
          <Route path="/sponsor/:sponsorId" element={<PrivateRoute><SponsorDetailPage /></PrivateRoute>} />
          <Route path="/deal/:dealId" element={<PrivateRoute><DealDetailPage /></PrivateRoute>} />
          <Route path="/tickets" element={<PrivateRoute><TicketsPage /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
          <Route path="/tickets/:ticketId" element={<PrivateRoute><TicketDetailPage /></PrivateRoute>} />
          <Route path="/claims" element={<PrivateRoute><ClaimsPage /></PrivateRoute>} />
          <Route path="/claims/:claimId" element={<PrivateRoute><ClaimDetailPage /></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
          </ToastProvider>
    </BrowserRouter>
  );
}