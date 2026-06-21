import React from "react";
import { Toaster } from "sonner";
import { useStore } from "./store/useStore";
import UploadView from "./components/UploadView";
import EntityExplorer from "./components/EntityExplorer";
import EntityInvestigation from "./components/EntityInvestigation";
import SuspiciousPanel from "./components/SuspiciousPanel";
import TransactionDetail from "./components/TransactionDetail";
import Header from "./components/Header";
import "./App.css";

function App() {
  const hasData = useStore((s) => s.transactions.length > 0);

  return (
    <div className="App h-screen w-full flex flex-col overflow-hidden bg-slate-950 text-slate-50">
      {!hasData ? (
        <UploadView />
      ) : (
        <>
          <Header />
          <div className="flex-1 flex overflow-hidden">
            <EntityExplorer />
            <EntityInvestigation />
            <SuspiciousPanel />
          </div>
          <TransactionDetail />
        </>
      )}
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: "rgb(15 23 42)",
            border: "1px solid rgb(30 41 59)",
            color: "rgb(241 245 249)",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "12px",
            borderRadius: 0,
          },
        }}
      />
    </div>
  );
}

export default App;
