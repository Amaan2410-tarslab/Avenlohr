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

const normalise = (value: string) => value.trim().toLowerCase();

function overlap(required: string[], actual: string[]) {
  const available = new Set(actual.map(normalise));
  const matched = required.filter((item) => available.has(normalise(item)));
  return { matched, ratio: required.length ? matched.length / required.length : 1 };
}

function fieldScore(required: string | undefined, actual: string | undefined) {
  if (!required) return 1;
  if (!actual) return 0;
  return normalise(required) === normalise(actual) ? 1 : 0;
}

export function explainMatch(requirement: MatchRequirement, candidate: CandidateSignals) {
  const skill = overlap(requirement.skills, candidate.skills);
  const experience = requirement.experienceYears == null
    ? 1
    : candidate.experienceYears == null
      ? 0
      : Math.min(candidate.experienceYears / Math.max(requirement.experienceYears, 1), 1);
  const seniority = fieldScore(requirement.seniority, candidate.seniority);
  const location = fieldScore(requirement.location, candidate.location);
  const workMode = fieldScore(requirement.workMode, candidate.workMode);
  const industry = fieldScore(requirement.industry, candidate.industry);

  const score = Math.round((skill.ratio * 40 + experience * 20 + seniority * 10 + location * 10 + workMode * 10 + industry * 10));
  return {
    score,
    signals: {
      skills: skill.matched,
      experience,
      seniority,
      location,
      workMode,
      industry,
    },
  };
}
