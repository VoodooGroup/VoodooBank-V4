import dynamic from 'next/dynamic';
import Head from 'next/head';

const BankApp = dynamic(() => import('../components/BankApp'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a2a3a',
        color: '#fff',
        fontFamily: 'Segoe UI, Arial, sans-serif',
        fontSize: 16,
      }}
    >
      Loading Voodoo Bank…
    </div>
  ),
});

export default function Home() {
  return (
    <>
      <Head>
        <title>Voodoo Token Bank</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="icon" type="image/png" href="/favicon.png" />
      </Head>
      <div onContextMenu={(e) => e.preventDefault()}>
        <BankApp />
      </div>
    </>
  );
}