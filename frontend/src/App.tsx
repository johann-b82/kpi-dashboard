import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Route, Switch } from "wouter";
import { UploadPage } from "./pages/UploadPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SettingsPage } from "./pages/SettingsPage";
import { NavBar } from "./components/NavBar";
import { ThemeProvider } from "./components/ThemeProvider";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NavBar />
        <main className="pt-16">
          <Switch>
            <Route path="/" component={DashboardPage} />
            <Route path="/upload" component={UploadPage} />
            <Route path="/settings" component={SettingsPage} />
          </Switch>
        </main>
      </ThemeProvider>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;
