import Script from 'next/script';
import '../styles/globals.css';
import { WalletProvider } from '../state/WalletContext';

const BRIDGE_V = '2';

export default function App({ Component, pageProps }) {
  return (
    <WalletProvider>
      {/* Same RainbowKit island as StakingPlatform-V4 (CSS via _document.js) */}
      <Script
        src={`/js/rainbow-bridge.js?v=${BRIDGE_V}`}
        strategy="afterInteractive"
        onLoad={() => {
          if (typeof window !== 'undefined') {
            console.info('[VoodooBank] rainbow-bridge script loaded');
          }
        }}
        onError={() => {
          console.error('[VoodooBank] Failed to load /js/rainbow-bridge.js');
        }}
      />
      <Component {...pageProps} />
    </WalletProvider>
  );
}
