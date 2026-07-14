export function buildKeywordMatch(jobSkills = [], candidateSkills = []) {
  const normalizedJobSkills = jobSkills.map((skill) => skill.toLowerCase());
  const normalizedCandidateSkills = candidateSkills.map((skill) => skill.toLowerCase());
  const matches = normalizedJobSkills.filter((skill) => normalizedCandidateSkills.includes(skill));
  if (!normalizedJobSkills.length) return 0;
  return Math.round((matches.length / normalizedJobSkills.length) * 100);
}
