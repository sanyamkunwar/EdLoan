import test from "node:test";
import assert from "node:assert/strict";
import { amortize, calculateScenario, estimateCollateralNeed, estimateMarginRequirement } from "../app.js";

test("amortize calculates zero-rate loans without interest", () => {
  const result = amortize(120000, 0, 12, 0);
  assert.equal(Math.round(result.emi), 10000);
  assert.equal(Math.round(result.totalInterest), 0);
  assert.equal(result.months, 12);
});

test("prepayment shortens repayment and reduces interest", () => {
  const base = amortize(1000000, 10, 120, 0);
  const withPrepay = amortize(1000000, 10, 120, 10000);
  assert.ok(withPrepay.months < base.months);
  assert.ok(withPrepay.totalInterest < base.totalInterest);
});

test("servicing moratorium interest avoids capitalising principal", () => {
  const scenario = {
    id: "a",
    name: "A",
    loan: 1000000,
    rate: 12,
    moratorium: 12,
    tenure: 120,
    salaryLow: 60000,
    salaryHigh: 80000,
    prepay: 0,
    fee: 0,
    serviceInterest: true
  };
  const result = calculateScenario(scenario, { worstCase: false, delayMonths: 0, salaryCut: 0, taxSlab: 20 });
  assert.equal(Math.round(result.capitalisedPrincipal), 1000000);
  assert.ok(result.upfrontCost > 0);
});

test("policy prompts change above common loan thresholds", () => {
  assert.equal(estimateCollateralNeed(700000), "Usually collateral-free if eligible");
  assert.equal(estimateCollateralNeed(800000), "Bank policy may require collateral");
  assert.equal(estimateMarginRequirement(300000), "Often nil up to Rs 4L");
});
