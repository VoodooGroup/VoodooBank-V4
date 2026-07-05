export default function Stats({ safesInUse, tvlUsd, tvlTokens, payout }) {
  return (
    <div className="stats">
      <div id="safesInUse" className="stat-box">
        <p>Safes in use</p>
        <h2>{safesInUse}</h2>
      </div>
      <div id="tvlUSD" className="stat-box">
        <p>Total Value Locked</p>
        <h2 id="tvlUSDValue">{tvlUsd}</h2>
      </div>
      <div id="tvlTokens" className="stat-box">
        <p>Total Tokens Locked</p>
        <h2 id="tvlTokensValue">{tvlTokens}</h2>
      </div>
      <div id="payout" className="stat-box">
        <p>Total Payout</p>
        <h2 id="payoutValue">{payout}</h2>
      </div>
    </div>
  );
}