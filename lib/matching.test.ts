import { describe, expect, it } from "vitest";
import { explainMatch } from "./matching";

describe("explainMatch", () => {
  it("scores a fully aligned candidate at 100", () => {
    const result = explainMatch(
      { skills: ["React", "TypeScript"], experienceYears: 5, seniority: "senior", location: "Hyderabad", workMode: "hybrid", industry: "technology" },
      { skills: ["React", "TypeScript"], experienceYears: 7, seniority: "senior", location: "Hyderabad", workMode: "hybrid", industry: "technology" },
    );
    expect(result.score).toBe(100);
    expect(result.signals.skills).toEqual(["React", "TypeScript"]);
  });

  it("identifies missing skills", () => {
    const result = explainMatch(
      { skills: ["React", "TypeScript", "AWS"] },
      { skills: ["React"] },
    );
    expect(result.score).toBeLessThan(100);
    expect(result.signals.skills).toEqual(["React"]);
  });

  it("does not award full points when a required signal is missing", () => {
    const result = explainMatch(
      { skills: [], experienceYears: 5, seniority: "senior", location: "Hyderabad", workMode: "hybrid", industry: "technology" },
      { skills: [], experienceYears: undefined, seniority: undefined, location: undefined, workMode: undefined, industry: undefined },
    );
    expect(result.score).toBe(0);
    expect(result.signals.experience).toBe(0);
    expect(result.signals.seniority).toBe(0);
    expect(result.signals.location).toBe(0);
    expect(result.signals.workMode).toBe(0);
    expect(result.signals.industry).toBe(0);
  });
});
