import { HERO_IMAGE_URL } from '../Contract_Files/constants';
import Rewards from './Rewards';

export default function Hero({ multipliers, rewardsError, rewardsLoading, onLockUp }) {
  return (
    <div className="hero">
      <div className="hero-text">
        <small>Earn rewards while locking up</small>
        <h1>Store Your Voodoo Tokens in a Safe Deposit Box and Earn Interest Over Time</h1>
        <p>
          The Voodoo Bank is exclusively made for long-term holders. Lock your Voodoo tokens in a
          safe deposit box and earn interest over time. The longer you lock, the higher the reward.
          Choose from 60 safe deposit boxes. Select a lock period of 1, 5, or 10 years and claim
          your rewards when the period ends!
        </p>
        <Rewards multipliers={multipliers} error={rewardsError} loading={rewardsLoading} />
        <button className="lock-button" data-target="safes1-15" onClick={() => onLockUp('safes1-15')}>
          Lock Up Now
        </button>
      </div>
      <img className="hero-image" src={HERO_IMAGE_URL} alt="Voodoo Banker" />
    </div>
  );
}