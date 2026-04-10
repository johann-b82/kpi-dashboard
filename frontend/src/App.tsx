import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { UploadPage } from "./pages/UploadPage";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UploadPage />
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;
