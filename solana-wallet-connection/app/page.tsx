import { WalletDashboard } from "./wallet-dashboard";
import { WalletProviders } from "./wallet-providers";

export default function Home() {
  return (
    <WalletProviders>
      <WalletDashboard />
    </WalletProviders>
  );
}
