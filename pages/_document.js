import { Html, Head, Main, NextScript } from 'next/document';

/** Windows-style scrollbar class (same as StakingPlatform-V4). */
export default function Document() {
  return (
    <Html lang="en" className="windows-scrollbar">
      <Head>
        <link rel="stylesheet" href="/js/rainbow-bridge.css?v=1" />
      </Head>
      <body className="windows-scrollbar">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
