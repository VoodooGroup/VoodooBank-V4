import { Html, Head, Main, NextScript } from 'next/document';

/**
 * WordPress-equivalent of:
 *   add_filter('body_class', ...) → windows-scrollbar
 *   add_action('wp_head', our_new_scrollbar) → windows-scrollbar.css
 */
export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="stylesheet" href="/js/rainbow-bridge.css?v=1" />
        <link rel="stylesheet" href="/css/windows-scrollbar.css?v=1" />
      </Head>
      <body className="windows-scrollbar">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
