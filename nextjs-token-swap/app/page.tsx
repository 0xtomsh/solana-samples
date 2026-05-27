import { TokenSwap } from "./token-swap";
import { WalletProviders } from "./wallet-providers";

export default function Home() {
  return (
    <WalletProviders>
      <TokenSwap />
    </WalletProviders>
  );
}
