import { describe, expect, it } from "vitest";
import { explainMatch } from "./matching";

describe("explainMatch", () => {
  it("scores a fully aligned candidate at 100", () => {
    const result = explainMatch(
      { skills: ["React", "TypeScript"], experienceYears: 5, seniority: "senior", location: "Hyderabad", workMode: "hybrid", industry: "technology" },
      { skills: ["React", "TypeScript"], experienceYears: 7, seniority: "senior", location: "Hyderabad", workMode: "hybrid", industry: "technology" },
    );
    expect(result.score).toBe(100);
    expect(result.signals.skills).toEqual(["react", "typescript"]);
  });

  it("identifies missing skills without treating omitted criteria as failures", () => {
    const result = explainMatch(
      { skills: ["React", "TypeScript", "AWS"] },
      { skills: ["React"] },
    );
    expect(result.score).toBeLessThan(100);
    expect(result.signals.skills).toEqual(["react"]);
  });

  it("does not award free points when required signals are missing", () => {
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

  it("returns zero when a job has no structured matching requirements", () => {
    const result = explainMatch(
      { skills: [] },
      { skills: ["React"], experienceYears: 10, seniority: "senior", location: "Hyderabad", workMode: "remote", industry: "technology" },
    );
    expect(result.score).toBe(0);
  });

  it("deduplicates required skills and normalizes common aliases", () => {
    const result = explainMatch(
      { skills: ["Node.js", "nodejs", "React"] , seniority: "Sr", workMode: "work from home", location: "Hyderabad" },
      { skills: ["nodejs", "react"], seniority: "senior", workMode: "remote", location: "Hyderabad" },
    );
    expect(result.score).toBe(100);
    expect(result.signals.skills).toEqual(["node js", "react"]);
    expect(result.signals.seniority).toBe(1);
    expect(result.signals.workMode).toBe(1);
  });
});
