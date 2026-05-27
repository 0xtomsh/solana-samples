import { NftViewer } from "./nft-viewer";
import { WalletProviders } from "./wallet-providers";

export default function Home() {
  return (
    <WalletProviders>
      <NftViewer />
    </WalletProviders>
  );
}
