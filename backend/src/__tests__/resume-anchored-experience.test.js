import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDeterministicResumeParse } from '../services/resumeImportUtils.js';
import { parseAnchoredExperience } from '../services/resumeExperienceParser.js';
import { buildDbWhere } from '../services/search/searchUtils.js';

const roles = (lines) => parseAnchoredExperience(lines).map((entry) => [entry.title, entry.company, entry.startDate, entry.endDate, entry.currentlyWorking]);

test('title and company on one line with a pipe, date on the next line', () => {
  assert.deepEqual(roles([
    'Senior Software Engineer | HCLTech',
    'Feb 2026 – Present',
    '• Designed ETL workflows using IBM DataStage.',
    'Software Engineer | HCLTech',
    'Apr 2022 – Feb 2026',
  ]), [
    ['Senior Software Engineer', 'HCLTech', 'Feb 2026', null, true],
    ['Software Engineer', 'HCLTech', 'Apr 2022', 'Feb 2026', false],
  ]);
});

test('date line first, then title, then a single-word company', () => {
  assert.deepEqual(roles([
    'Dec 2023 - Present',
    'Strategic Alliance Manager',
    'PaySprint',
    '- Cultivated relationships with 40+ bank CXOs.',
  ]), [['Strategic Alliance Manager', 'PaySprint', 'Dec 2023', null, true]]);
});

test('company and date on one line, title and place on the next', () => {
  const [entry] = parseAnchoredExperience([
    'Damco Solutions May 2024 - Present',
    'Data Engineer Noida, India',
    '• Built a centralized ingestion platform.',
  ]);
  assert.equal(entry.company, 'Damco Solutions');
  assert.equal(entry.title, 'Data Engineer');
  assert.equal(entry.location, 'Noida, India');
});

test('numeric dates, "till now" and a trailing place on the company', () => {
  const [entry] = parseAnchoredExperience(['Tata Consultancy Services, Kolkata, India | Frontend Developer', '06/2021 – Till Now']);
  assert.equal(entry.company, 'Tata Consultancy Services');
  assert.equal(entry.location, 'Kolkata, India');
  assert.equal(entry.title, 'Frontend Developer');
  assert.equal(entry.startDate, 'Jun 2021');
  assert.equal(entry.currentlyWorking, true);
});

test('bullets and sentences are never taken as a role header', () => {
  assert.deepEqual(parseAnchoredExperience([
    '• Built secure RESTful and GraphQL APIs enabling seamless integration between customer portals, ERP, and billing systems.',
    '• Reduced load times by 22% through performance analysis.',
  ]), []);
});

test('a sentence role ("working as X in Y since ...") still yields a role', () => {
  const [entry] = parseAnchoredExperience(['➢ Working as a Technology Analyst in Infosys, Chennai since Jun 2022 to till date.']);
  assert.equal(entry.title, 'Technology Analyst');
  assert.equal(entry.company, 'Infosys');
  assert.equal(entry.currentlyWorking, true);
});

test('current employer, designation, location and total experience come out of a company-first resume', () => {
  const { candidate } = buildDeterministicResumeParse([
    'Asha Verma',
    'asha@example.com | +91 98765 43210 | Pune, Maharashtra',
    'EXPERIENCE',
    'Zoho Corporation Mar 2021 - Present',
    'Backend Engineer',
    '• Built billing services.',
    'Freshworks Jan 2018 - Feb 2021',
    'Software Engineer',
    '• Maintained APIs.',
  ].join('\n'), 'asha.pdf');
  assert.equal(candidate.currentEmployer.value, 'Zoho Corporation');
  assert.equal(candidate.currentDesignation.value, 'Backend Engineer');
  assert.equal(candidate.location.value, 'Pune, Maharashtra');
  assert.ok(candidate.totalExperience.value >= 8);
});

test('a "Portfolio" word in the contact line does not cut the experience section', () => {
  const { candidate } = buildDeterministicResumeParse([
    'Ayush K',
    'PROFESSIONAL EXPERIENCE:',
    'ayush@example.com | GitHub | LinkedIn | Portfolio',
    'Tata Consultancy Services, Kolkata, India | Frontend Developer',
    'Jun 2021 – Aug 2024',
    '• Built web apps in React.',
  ].join('\n'), 'ayush.pdf');
  assert.equal(candidate.currentDesignation.value, 'Frontend Developer');
});

test('database keyword search also matches the skills lists', () => {
  const where = buildDbWhere({ keyword: 'python' });
  const clauses = where.OR.filter((clause) => clause.skills?.hasSome);
  assert.equal(clauses.length, 1);
  assert.ok(clauses[0].skills.hasSome.includes('Python'));
  for (const column of ['frameworks', 'tools', 'databases', 'cloudPlatforms', 'functionalSkills']) {
    assert.ok(where.OR.some((clause) => clause[column]?.hasSome), column);
  }
});

test('comma separated keywords are each matched as skills', () => {
  const where = buildDbWhere({ keyword: 'Python, Docker' });
  const variants = where.OR.find((clause) => clause.skills?.hasSome).skills.hasSome;
  assert.ok(variants.includes('Python') && variants.includes('Docker'));
});
