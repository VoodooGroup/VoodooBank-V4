export function computeMultiplier(rate, duration) {
  const rateBn = typeof rate === 'bigint' ? rate : BigInt(rate);
  const precision = 10n ** 18n;
  let factorScaled = precision;

  for (let i = 0; i < duration; i++) {
    factorScaled = (factorScaled * (precision + rateBn)) / precision;
  }

  return (Number(factorScaled) / 1e18).toFixed(2);
}