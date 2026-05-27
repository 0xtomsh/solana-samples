import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@solana/wallet-adapter-react-ui/styles.css";
import "./styles.css";
import { TransactionHistoryApp } from "./transaction-history-app";
import { WalletProviders } from "./wallet-providers";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WalletProviders>
      <TransactionHistoryApp />
    </WalletProviders>
  </StrictMode>
);
