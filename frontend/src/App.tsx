import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Route, Switch, useLocation } from "wouter";
import { UploadPage } from "./pages/UploadPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HRPage } from "./pages/HRPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LoginPage } from "./pages/LoginPage";
import { NavBar } from "./components/NavBar";
import { SubHeader } from "./components/SubHeader";
import { ThemeProvider } from "./components/ThemeProvider";
import { SettingsDraftProvider } from "./contexts/SettingsDraftContext";
import { DateRangeProvider } from "./contexts/DateRangeContext";
import { AuthProvider } from "./auth/AuthContext";
import { AuthGate } from "./auth/AuthGate";
import { queryClient } from "./queryClient";

function AppShell() {
  const [location] = useLocation();
  const isLogin = location === "/login";
  return (
    <AuthGate>
      {!isLogin && (
        <>
          <NavBar />
          <SubHeader />
        </>
      )}
      <main className={isLogin ? "" : "pt-28"}>
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route path="/" component={DashboardPage} />
          <Route path="/upload" component={UploadPage} />
          <Route path="/hr" component={HRPage} />
          <Route path="/settings" component={SettingsPage} />
        </Switch>
      </main>
    </AuthGate>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <SettingsDraftProvider>
            <DateRangeProvider>
              <AppShell />
            </DateRangeProvider>
          </SettingsDraftProvider>
        </ThemeProvider>
      </AuthProvider>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;
