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

const normalise = (value: string) => value.trim().toLowerCase().replace(/[._-]+/g, " ").replace(/\s+/g, " ");
const normaliseSkill = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9+#]/g, "");

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
  if (["wfh", "work from home", "fully remote", "remote"].includes(valueKey)) return "remote";
  if (["onsite", "on site", "office"].includes(valueKey)) return "onsite";
  if (["hybrid", "hybrid work"].includes(valueKey)) return "hybrid";
  return valueKey;
};

function uniqueNormalised(values: string[], normalizer: (value: string) => string = normalise) {
  return [...new Set(values.map(normalizer).filter(Boolean))];
}

function overlap(required: string[], actual: string[]) {
  const requiredUnique = uniqueNormalised(required, normaliseSkill);
  const available = new Set(uniqueNormalised(actual, normaliseSkill));
  const matched = requiredUnique.filter((item) => available.has(item));
  return { matched, ratio: requiredUnique.length ? matched.length / requiredUnique.length : 0, active: requiredUnique.length > 0 };
}

function fieldScore(required: string | undefined, actual: string | undefined, kind: "normal" | "seniority" | "workMode" = "normal") {
  if (!required?.trim()) return { score: 0, active: false };
  if (!actual?.trim()) return { score: 0, active: true };
  const requiredValue = kind === "seniority" ? normaliseSeniority(required) : kind === "workMode" ? normaliseWorkMode(required) : normalise(required);
  const actualValue = kind === "seniority" ? normaliseSeniority(actual) : kind === "workMode" ? normaliseWorkMode(actual) : normalise(actual);
  return { score: requiredValue === actualValue ? 1 : 0, active: true };
}

export function explainMatch(requirement: MatchRequirement, candidate: CandidateSignals) {
  const skill = overlap(requirement.skills, candidate.skills);
  const requiredExperienceYears = requirement.experienceYears;
  const experienceActive = requiredExperienceYears != null && Number.isFinite(requiredExperienceYears) && requiredExperienceYears >= 0;
  const experience = experienceActive
    ? candidate.experienceYears == null || !Number.isFinite(candidate.experienceYears)
      ? 0
      : requiredExperienceYears === 0
        ? 1
        : Math.min(Math.max(candidate.experienceYears, 0) / requiredExperienceYears, 1)
    : 0;

  const seniority = fieldScore(requirement.seniority, candidate.seniority, "seniority");
  const location = fieldScore(requirement.location, candidate.location);
  const workMode = fieldScore(requirement.workMode, candidate.workMode, "workMode");
  const industry = fieldScore(requirement.industry, candidate.industry);
  const remoteRequirement = requirement.workMode ? normaliseWorkMode(requirement.workMode) === "remote" : false;

  const weightedSignals = [
    { value: skill.ratio, weight: 40, active: skill.active },
    { value: experience, weight: 20, active: experienceActive },
    { value: seniority.score, weight: 10, active: seniority.active },
    { value: location.score, weight: 10, active: location.active && !remoteRequirement },
    { value: workMode.score, weight: 10, active: workMode.active },
    { value: industry.score, weight: 10, active: industry.active },
  ].filter((signal) => signal.active);

  const totalWeight = weightedSignals.reduce((sum, signal) => sum + signal.weight, 0);
  const weightedScore = weightedSignals.reduce((sum, signal) => sum + signal.value * signal.weight, 0);
  const score = totalWeight === 0 ? 0 : Math.round((weightedScore / totalWeight) * 100);

  return {
    score: Math.max(0, Math.min(100, score)),
    signals: { skills: skill.matched, experience, seniority: seniority.score, location: location.score, workMode: workMode.score, industry: industry.score },
  };
}
