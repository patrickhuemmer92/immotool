import { describe, expect, it } from "vitest";
import {
  buildSchedule,
  depreciationForCalendarYear,
  depreciationForYear,
} from "@/lib/calculations/depreciation";

describe("AfA — linear", () => {
  it("constant amount each year, ends when book value exhausted", () => {
    const sched = buildSchedule({
      method: "linear",
      basis: 100_000,
      linearRate: 0.02,
    });
    expect(sched[0].total).toBe(2000);
    expect(sched[0].bookValue).toBe(98_000);
    expect(sched[49].bookValue).toBe(0);
    // sum equals basis
    const sum = sched.reduce((acc, s) => acc + s.total, 0);
    expect(sum).toBeCloseTo(100_000, 4);
  });

  it("year-specific lookup matches schedule", () => {
    const y = depreciationForYear(
      { method: "linear", basis: 100_000, linearRate: 0.02 },
      10
    );
    expect(y.total).toBe(2000);
    expect(y.bookValue).toBe(80_000);
  });

  it("anteilig im Anschaffungsjahr (firstYearMonths < 12)", () => {
    const y = depreciationForCalendarYear(
      { method: "linear", basis: 100_000, linearRate: 0.02 },
      2024,
      2024,
      6
    );
    expect(y.total).toBe(1000); // halbes Jahr
  });
});

describe("AfA — degressive § 7 V", () => {
  it("5 % vom Restbuchwert, Buchwert sinkt geometrisch", () => {
    const sched = buildSchedule(
      {
        method: "degressive_7v",
        basis: 100_000,
        linearRate: 0.02,
        degressiveRate: 0.05,
      },
      5
    );
    expect(sched[0].total).toBe(5000);
    expect(sched[0].bookValue).toBe(95_000);
    expect(sched[1].total).toBe(4750); // 95.000 × 5 %
    expect(sched[1].bookValue).toBe(90_250);
    // Total ist > linear in den ersten Jahren
    expect(sched[0].total).toBeGreaterThan(2000);
  });
});

describe("AfA — Sonder § 7b", () => {
  it("linear + Sonder in Jahren 1..4, danach nur linear", () => {
    const p = {
      method: "sonder_7b" as const,
      basis: 100_000,
      linearRate: 0.03,
      sonderRate: 0.05,
      sonderYears: 4,
      sonderLinearRate: 0.03,
    };
    const sched = buildSchedule(p, 10);

    // Jahr 1..4: linear 3.000 + Sonder 5.000 = 8.000
    for (let i = 0; i < 4; i++) {
      expect(sched[i].linear).toBe(3000);
      expect(sched[i].sonder).toBe(5000);
      expect(sched[i].total).toBe(8000);
    }
    // Jahr 5+: nur lineare 3.000
    expect(sched[4].sonder).toBe(0);
    expect(sched[4].linear).toBe(3000);
    expect(sched[4].total).toBe(3000);
  });

  it("Bemessungsgrundlage-Limit greift NUR für die Sonder-Tranche", () => {
    const sched = buildSchedule(
      {
        method: "sonder_7b",
        basis: 200_000,
        linearRate: 0.03,
        sonderRate: 0.05,
        sonderYears: 4,
        sonderLinearRate: 0.03,
        sonder7bBasisLimit: 100_000, // Förderhöchstgrenze
      },
      4
    );
    // linear weiter auf 200k: 6.000
    expect(sched[0].linear).toBe(6000);
    // Sonder nur auf 100k: 5.000
    expect(sched[0].sonder).toBe(5000);
    expect(sched[0].total).toBe(11_000);
  });
});

describe("depreciationForCalendarYear", () => {
  it("Vor startYear → 0", () => {
    const r = depreciationForCalendarYear(
      { method: "linear", basis: 100_000, linearRate: 0.02 },
      2025,
      2024
    );
    expect(r.total).toBe(0);
  });

  it("Calendar 2027 mit start 2025 → Jahr 3", () => {
    const r = depreciationForCalendarYear(
      { method: "linear", basis: 100_000, linearRate: 0.02 },
      2025,
      2027
    );
    expect(r.year).toBe(3);
    expect(r.total).toBe(2000);
  });

  it("§7b: Calendar 2028 mit start 2025 → Jahr 4 (Sonder läuft noch)", () => {
    const r = depreciationForCalendarYear(
      {
        method: "sonder_7b",
        basis: 100_000,
        linearRate: 0.03,
        sonderRate: 0.05,
        sonderYears: 4,
        sonderLinearRate: 0.03,
      },
      2025,
      2028
    );
    expect(r.year).toBe(4);
    expect(r.total).toBe(8000);
  });

  it("§7b: Calendar 2029 mit start 2025 → Jahr 5 (Sonder vorbei)", () => {
    const r = depreciationForCalendarYear(
      {
        method: "sonder_7b",
        basis: 100_000,
        linearRate: 0.03,
        sonderRate: 0.05,
        sonderYears: 4,
        sonderLinearRate: 0.03,
      },
      2025,
      2029
    );
    expect(r.year).toBe(5);
    expect(r.sonder).toBe(0);
    expect(r.total).toBe(3000);
  });
});
