import { lazy, Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Route, Switch } from "wouter";
import { Loader2 } from "lucide-react";
import { UploadPage } from "./pages/UploadPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HRPage } from "./pages/HRPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NavBar } from "./components/NavBar";

const DocsPage = lazy(() => import("./pages/DocsPage"));
import { SubHeader } from "./components/SubHeader";
import { ThemeProvider } from "./components/ThemeProvider";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { SettingsDraftProvider } from "./contexts/SettingsDraftContext";
import { DateRangeProvider } from "./contexts/DateRangeContext";
import { queryClient } from "./queryClient";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SettingsDraftProvider>
          <DateRangeProvider>
            <ProtectedRoute>
              <NavBar />
              <SubHeader />
              <main className="pt-28">
                <Switch>
                  <Route path="/" component={DashboardPage} />
                  <Route path="/upload" component={UploadPage} />
                  <Route path="/hr" component={HRPage} />
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
            </ProtectedRoute>
          </DateRangeProvider>
        </SettingsDraftProvider>
      </ThemeProvider>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;
