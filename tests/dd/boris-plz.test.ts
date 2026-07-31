import { describe, it, expect } from "vitest";
import { _stateFromPlz } from "@/lib/dd/market/boris";

describe("stateFromPlz — grobe PLZ-Zuordnung", () => {
  const cases: Array<[string, string]> = [
    ["10115", "BE"], // Berlin-Mitte
    ["20095", "HH"], // Hamburg-Zentrum
    ["30159", "NI"], // Hannover
    ["40213", "NW"], // Düsseldorf
    ["50667", "NW"], // Köln
    ["55118", "RP"], // Mainz
    ["60311", "HE"], // Frankfurt
    ["66111", "SL"], // Saarbrücken
    ["70173", "BW"], // Stuttgart
    ["80331", "BY"], // München
    ["90402", "BY"], // Nürnberg
    ["99084", "TH"], // Erfurt
    ["28195", "HB"], // Bremen
  ];

  for (const [plz, expected] of cases) {
    it(`PLZ ${plz} → ${expected}`, () => {
      expect(_stateFromPlz(plz)).toBe(expected);
    });
  }

  it("null / leer → UNKNOWN", () => {
    expect(_stateFromPlz(null)).toBe("UNKNOWN");
    expect(_stateFromPlz("")).toBe("UNKNOWN");
    expect(_stateFromPlz("abc")).toBe("UNKNOWN");
  });
});
