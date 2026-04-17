import { lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Route, Switch, useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { UploadPage } from "./pages/UploadPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HRPage } from "./pages/HRPage";
import { SensorsPage } from "./pages/SensorsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LoginPage } from "./pages/LoginPage";
import { LauncherPage } from "./pages/LauncherPage";
import { NavBar } from "./components/NavBar";

const DocsPage = lazy(() => import("./pages/DocsPage"));
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
  const isLauncher = location === "/";
  return (
    <AuthGate>
      {!isLogin && (
        <>
          <NavBar />
          <SubHeader />
        </>
      )}
      <main className={isLogin ? "" : isLauncher ? "pt-16" : "pt-28"}>
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route path="/sales" component={DashboardPage} />
          <Route path="/" component={LauncherPage} />
          <Route path="/upload" component={UploadPage} />
          <Route path="/hr" component={HRPage} />
          <Route path="/sensors" component={SensorsPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/docs/:section/:slug">
            <Suspense fallback={
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading documentation" />
              </div>
            }>
              <DocsPage />
            </Suspense>
          </Route>
          <Route path="/docs">
            <Suspense fallback={
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" aria-label="Loading documentation" />
              </div>
            }>
              <DocsPage />
            </Suspense>
          </Route>
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
