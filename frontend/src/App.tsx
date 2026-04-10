import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-white">
        <p className="p-8 text-center text-slate-500">
          Frontend scaffold loaded. Upload UI coming in Plan 04.
        </p>
      </div>
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}

export default App;
