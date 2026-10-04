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

export function explainMatch(requirement: MatchRequirement, candidate: CandidateSignals) {
  const skill = overlap(requirement.skills, candidate.skills);
  const experience = requirement.experienceYears == null || candidate.experienceYears == null
    ? 1
    : Math.min(candidate.experienceYears / Math.max(requirement.experienceYears, 1), 1);
  const seniority = !requirement.seniority || !candidate.seniority
    ? 1
    : normalise(requirement.seniority) === normalise(candidate.seniority) ? 1 : 0;
  const location = !requirement.location || !candidate.location
    ? 1
    : normalise(requirement.location) === normalise(candidate.location) ? 1 : 0;
  const workMode = !requirement.workMode || !candidate.workMode
    ? 1
    : normalise(requirement.workMode) === normalise(candidate.workMode) ? 1 : 0;
  const industry = !requirement.industry || !candidate.industry
    ? 1
    : normalise(requirement.industry) === normalise(candidate.industry) ? 1 : 0;

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
