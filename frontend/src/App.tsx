import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { Route, Switch } from "wouter";
import { UploadPage } from "./pages/UploadPage";
import { DashboardPage } from "./pages/DashboardPage";
import { NavBar } from "./components/NavBar";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <NavBar />
      <main className="pt-16">
        <Switch>
          <Route path="/" component={DashboardPage} />
          <Route path="/upload" component={UploadPage} />
        </Switch>
      </main>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;
