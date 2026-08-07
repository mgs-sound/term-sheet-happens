/**
 * Interrupt events: follow-on raises (Fund II+), bridge rounds (Partner+),
 * capital calls (GP). Event construction + the ownership math, pure.
 */

import type { RNG } from './rng.ts';
import type { InterruptEvent, PortfolioCompany } from './types.ts';
import { BRIDGE, CAPITAL_CALLS, FOLLOW_ONS } from './tuning.ts';
import { clamp01, roundM } from './util.ts';

/** Ownership from a primary check: check / post-money. */
export function ownershipFromCheck(checkM: number, preMoneyM: number): number {
  return checkM / (preMoneyM + checkM);
}

/** Pro rata cost to maintain ownership through a `raiseM` round. */
export function proRataCostM(ownership: number, raiseM: number): number {
  return roundM(ownership * raiseM);
}

/** Dilution factor applied to ownership when pro rata is declined. */
export function dilutionFactor(newPreM: number, raiseM: number): number {
  return newPreM / (newPreM + raiseM);
}

/** Build a follow-on event for a company (direction keyed to quality). */
export function makeFollowOnEvent(
  rng: RNG,
  company: PortfolioCompany,
): Extract<InterruptEvent, { kind: 'followOn' }> {
  const raiseM = roundM(
    company.initialCheckM * rng.float(FOLLOW_ONS.raiseFactorMin, FOLLOW_ONS.raiseFactorMax),
  );
  const q = company.card.quality;
  const pUp = clamp01(FOLLOW_ONS.upBase + FOLLOW_ONS.upQualitySlope * q);
  const pDown = clamp01(FOLLOW_ONS.downBase + FOLLOW_ONS.downQualitySlope * q);
  const roll = rng.next();
  const oldPostM = company.dealValuationM + company.initialCheckM;
  let factor: number;
  if (roll < pUp) {
    factor = rng.float(FOLLOW_ONS.upFactorMin, FOLLOW_ONS.upFactorMax);
  } else if (roll < pUp + pDown) {
    factor = FOLLOW_ONS.downFactor;
  } else {
    factor = FOLLOW_ONS.flatFactor;
  }
  const newPreM = roundM(oldPostM * factor);
  return {
    kind: 'followOn',
    companyId: company.companyId,
    companyName: company.card.name,
    raiseM,
    newPreM,
    proRataCostM: proRataCostM(company.ownership, raiseM),
  };
}

export function makeBridgeEvent(
  company: PortfolioCompany,
): Extract<InterruptEvent, { kind: 'bridge' }> {
  return {
    kind: 'bridge',
    companyId: company.companyId,
    companyName: company.card.name,
    costM: roundM(company.initialCheckM * BRIDGE.costFactorOfCheck),
  };
}

export function makeCapitalCallEvent(
  capitalM: number,
): Extract<InterruptEvent, { kind: 'capitalCall' }> {
  return { kind: 'capitalCall', amountM: roundM(capitalM * CAPITAL_CALLS.amountRatio) };
}
