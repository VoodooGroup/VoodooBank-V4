import { LCW_API_KEY, VOODOO_TOKEN } from '../Contract_Files/constants';

const DEX_API = 'https://api.dexscreener.com/latest/dex/tokens';
const CACHE_MS = 60_000;

let cache = { at: 0, price: 0 };

/**
 * Best PulseChain pair for VDO by liquidity (same approach as Voodoo wallet).
 */
async function priceFromDexScreener() {
  const res = await fetch(`${DEX_API}/${VOODOO_TOKEN}`);
  if (!res.ok) throw new Error(`DexScreener HTTP ${res.status}`);

  const json = await res.json();
  const pairs = Array.isArray(json?.pairs) ? json.pairs : [];
  const best = pairs
    .filter(
      (p) =>
        String(p.chainId || '').toLowerCase() === 'pulsechain'
        && p.baseToken?.address?.toLowerCase() === VOODOO_TOKEN.toLowerCase()
        && p.priceUsd != null
        && !Number.isNaN(Number(p.priceUsd)),
    )
    .sort((a, b) => (Number(b.liquidity?.usd) || 0) - (Number(a.liquidity?.usd) || 0))[0];

  if (!best) {
    // Fallback: any chain pair for this token
    const any = pairs
      .filter((p) => p.priceUsd != null && !Number.isNaN(Number(p.priceUsd)))
      .sort((a, b) => (Number(b.liquidity?.usd) || 0) - (Number(a.liquidity?.usd) || 0))[0];
    return any ? Number(any.priceUsd) : 0;
  }

  return Number(best.priceUsd) || 0;
}

async function priceFromLiveCoinWatch() {
  if (!LCW_API_KEY) return 0;

  const res = await fetch('https://api.livecoinwatch.com/coins/single', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': LCW_API_KEY,
    },
    body: JSON.stringify({ currency: 'USD', code: 'VDO', meta: true }),
  });

  if (!res.ok) throw new Error(`LiveCoinWatch HTTP ${res.status}`);

  const data = await res.json();
  return data?.rate && !Number.isNaN(Number(data.rate)) ? Number(data.rate) : 0;
}

/**
 * Live VDO/USD price for TVL.
 * 1) DexScreener (no API key — reliable on PulseChain)
 * 2) LiveCoinWatch if NEXT_PUBLIC_LCW_API_KEY is set
 */
export async function getVdoPriceUsd() {
  if (Date.now() - cache.at < CACHE_MS && cache.price > 0) {
    return cache.price;
  }

  let price = 0;

  try {
    price = await priceFromDexScreener();
  } catch (err) {
    console.warn('[Bank] DexScreener price failed:', err?.message || err);
  }

  if (!(price > 0)) {
    try {
      price = await priceFromLiveCoinWatch();
    } catch (err) {
      console.warn('[Bank] LiveCoinWatch price failed:', err?.message || err);
    }
  }

  if (price > 0) {
    cache = { at: Date.now(), price };
  } else {
    console.warn('[Bank] VDO price unavailable — TVL USD will show $0');
  }

  return price;
}
