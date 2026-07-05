export default function Rewards({ multipliers, error, loading }) {
  if (loading) {
    return (
      <div className="rewards" id="dynamicRewards">
        <p className="rewards-title">Loading live multipliers from contract...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rewards" id="dynamicRewards">
        <div className="rewards-error">Unable to load current multipliers right now...</div>
      </div>
    );
  }

  return (
    <div className="rewards" id="dynamicRewards">
      <p className="rewards-title">Current Reward Multipliers (compound interest):</p>
      <div className="rewards-list">
        <div className="reward-item">
          <span>1-year lock</span>
          <span className="reward-multiplier">x{multipliers.one}</span>
        </div>
        <div className="reward-item">
          <span>5-year lock</span>
          <span className="reward-multiplier">x{multipliers.five}</span>
        </div>
        <div className="reward-item">
          <span>10-year lock</span>
          <span className="reward-multiplier">x{multipliers.ten}</span>
        </div>
      </div>
      <p className="rewards-note">
        Longer lock periods yield higher compound multipliers.
        <br />
        This is the total return factor applied to your initial deposit after the lock ends.
      </p>
    </div>
  );
}