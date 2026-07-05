import { LCW_API_KEY } from '../Contract_Files/constants';

export async function getVdoPriceUsd() {
  if (!LCW_API_KEY) {
    console.warn('LiveCoinWatch API key not configured');
    return 0;
  }

  try {
    const res = await fetch('https://api.livecoinwatch.com/coins/single', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': LCW_API_KEY,
      },
      body: JSON.stringify({ currency: 'USD', code: 'VDO', meta: true }),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    return data?.rate && !Number.isNaN(data.rate) ? Number(data.rate) : 0;
  } catch (err) {
    console.error('LiveCoinWatch error:', err);
    return 0;
  }
}