import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Route, Switch } from "wouter";
import { UploadPage } from "./pages/UploadPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NavBar } from "./components/NavBar";
import { ThemeProvider } from "./components/ThemeProvider";
import { SettingsDraftProvider } from "./contexts/SettingsDraftContext";
import { queryClient } from "./queryClient";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SettingsDraftProvider>
          <NavBar />
          <main className="pt-16">
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/upload" component={UploadPage} />
              <Route path="/settings" component={SettingsPage} />
            </Switch>
          </main>
        </SettingsDraftProvider>
      </ThemeProvider>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;
