import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Route, Switch } from "wouter";
import { UploadPage } from "./pages/UploadPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HRPage } from "./pages/HRPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NavBar } from "./components/NavBar";
import { SubHeader } from "./components/SubHeader";
import { ThemeProvider } from "./components/ThemeProvider";
import { SettingsDraftProvider } from "./contexts/SettingsDraftContext";
import { DateRangeProvider } from "./contexts/DateRangeContext";
import { queryClient } from "./queryClient";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SettingsDraftProvider>
          <DateRangeProvider>
            <NavBar />
            <SubHeader />
            <main className="pt-28">
              <Switch>
                <Route path="/" component={DashboardPage} />
                <Route path="/upload" component={UploadPage} />
                <Route path="/hr" component={HRPage} />
                <Route path="/settings" component={SettingsPage} />
              </Switch>
            </main>
          </DateRangeProvider>
        </SettingsDraftProvider>
      </ThemeProvider>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;
