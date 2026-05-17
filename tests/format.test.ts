import { describe, it, expect } from "vitest";
import { parseDecimal } from "@/lib/format";

describe("parseDecimal", () => {
  it("returns null for empty/invalid", () => {
    expect(parseDecimal("")).toBe(null);
    expect(parseDecimal(null)).toBe(null);
    expect(parseDecimal(undefined)).toBe(null);
    expect(parseDecimal("abc")).toBe(null);
  });

  it("parses plain integers", () => {
    expect(parseDecimal("42")).toBe(42);
    expect(parseDecimal("1234")).toBe(1234);
  });

  it("parses German decimal (comma)", () => {
    expect(parseDecimal("0,5")).toBe(0.5);
    expect(parseDecimal("22,5")).toBe(22.5);
    expect(parseDecimal("1234,56")).toBe(1234.56);
  });

  it("parses English decimal (single dot, non-3-digit suffix)", () => {
    expect(parseDecimal("0.5")).toBe(0.5);
    expect(parseDecimal("1.5")).toBe(1.5);
    expect(parseDecimal("22.5")).toBe(22.5);
    expect(parseDecimal("0.123")).toBe(0.123);
  });

  it("treats single dot + 3 digits as German thousand separator", () => {
    expect(parseDecimal("90.000")).toBe(90000);
    expect(parseDecimal("1.500")).toBe(1500);
    expect(parseDecimal("999.000")).toBe(999000);
  });

  it("handles multiple dots as thousand separators", () => {
    expect(parseDecimal("1.234.567")).toBe(1234567);
    expect(parseDecimal("12.345.678")).toBe(12345678);
  });

  it("handles German thousand + decimal", () => {
    expect(parseDecimal("1.234,56")).toBe(1234.56);
    expect(parseDecimal("90.000,50")).toBe(90000.5);
  });

  it("handles English thousand + decimal", () => {
    expect(parseDecimal("1,234.56")).toBe(1234.56);
    expect(parseDecimal("90,000.50")).toBe(90000.5);
  });

  it("strips currency / percent / whitespace", () => {
    expect(parseDecimal("1.234,56 €")).toBe(1234.56);
    expect(parseDecimal(" 2,5 % ")).toBe(2.5);
  });
});
