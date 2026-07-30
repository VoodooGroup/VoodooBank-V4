import Script from 'next/script';
import Head from 'next/head';
import '../styles/globals.css';
import { WalletProvider } from '../state/WalletContext';

const BRIDGE_V = '1';

export default function App({ Component, pageProps }) {
  return (
    <WalletProvider>
      <Head>
        <link rel="stylesheet" href={`/js/rainbow-bridge.css?v=${BRIDGE_V}`} />
      </Head>
      {/* Same RainbowKit island as StakingPlatform-V4 */}
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
