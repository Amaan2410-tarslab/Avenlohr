export type MatchRequirement = {
  skills: string[];
  experienceYears?: number;
  seniority?: string;
  location?: string;
  workMode?: string;
  industry?: string;
};

export type CandidateSignals = {
  skills: string[];
  experienceYears?: number;
  seniority?: string;
  location?: string;
  workMode?: string;
  industry?: string;
};

const normalise = (value: string) =>
  value.trim().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");

const normaliseSeniority = (value: string) => {
  const valueKey = normalise(value);
  if (["sr", "senior", "senior level"].includes(valueKey)) return "senior";
  if (["jr", "junior", "junior level"].includes(valueKey)) return "junior";
  if (["mid", "mid level", "middle"].includes(valueKey)) return "mid";
  if (["lead", "lead level"].includes(valueKey)) return "lead";
  return valueKey;
};

const normaliseWorkMode = (value: string) => {
  const valueKey = normalise(value);
  if (["wfh", "work from home", "fully remote"].includes(valueKey)) return "remote";
  if (["onsite", "on site", "office"].includes(valueKey)) return "onsite";
  return valueKey;
};

function uniqueNormalised(values: string[]) {
  return [...new Set(values.map(normalise).filter(Boolean))];
}

function overlap(required: string[], actual: string[]) {
  const requiredUnique = uniqueNormalised(required);
  const available = new Set(uniqueNormalised(actual));
  const matched = requiredUnique.filter((item) => available.has(item));
  return {
    matched,
    ratio: requiredUnique.length ? matched.length / requiredUnique.length : 0,
    active: requiredUnique.length > 0,
  };
}

function fieldScore(required: string | undefined, actual: string | undefined, kind: "normal" | "seniority" | "workMode" = "normal") {
  if (!required?.trim()) return { score: 0, active: false };
  if (!actual?.trim()) return { score: 0, active: true };
  const requiredValue = kind === "seniority"
    ? normaliseSeniority(required)
    : kind === "workMode"
      ? normaliseWorkMode(required)
      : normalise(required);
  const actualValue = kind === "seniority"
    ? normaliseSeniority(actual)
    : kind === "workMode"
      ? normaliseWorkMode(actual)
      : normalise(actual);
  return { score: requiredValue === actualValue ? 1 : 0, active: true };
}

export function explainMatch(requirement: MatchRequirement, candidate: CandidateSignals) {
  const skill = overlap(requirement.skills, candidate.skills);
  const experienceActive = requirement.experienceYears != null && requirement.experienceYears >= 0;
  const experience = experienceActive
    ? candidate.experienceYears == null
      ? 0
      : Math.min(Math.max(candidate.experienceYears, 0) / Math.max(requirement.experienceYears, 1), 1)
    : 0;

  const seniority = fieldScore(requirement.seniority, candidate.seniority, "seniority");
  const location = fieldScore(requirement.location, candidate.location);
  const workMode = fieldScore(requirement.workMode, candidate.workMode, "workMode");
  const industry = fieldScore(requirement.industry, candidate.industry);

  // A missing requirement contributes no weight. This prevents empty skill arrays
  // or other omitted fields from handing a candidate free points. If a job has no
  // structured requirements at all, its match score is 0 until requirements exist.
  const weightedSignals = [
    { value: skill.ratio, weight: 40, active: skill.active },
    { value: experience, weight: 20, active: experienceActive },
    { value: seniority.score, weight: 10, active: seniority.active },
    { value: location.score, weight: 10, active: location.active && normaliseWorkMode(requirement.workMode ?? "") !== "remote" },
    { value: workMode.score, weight: 10, active: workMode.active },
    { value: industry.score, weight: 10, active: industry.active },
  ].filter((signal) => signal.active);

  const totalWeight = weightedSignals.reduce((sum, signal) => sum + signal.weight, 0);
  const weightedScore = weightedSignals.reduce((sum, signal) => sum + signal.value * signal.weight, 0);
  const score = totalWeight === 0 ? 0 : Math.round((weightedScore / totalWeight) * 100);

  return {
    score: Math.max(0, Math.min(100, score)),
    signals: {
      skills: skill.matched,
      experience,
      seniority: seniority.score,
      location: location.score,
      workMode: workMode.score,
      industry: industry.score,
    },
  };
}
