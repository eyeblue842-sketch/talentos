// Date-anchored parsing of a resume's work-experience section.
//
// Resumes lay a role out in many ways ("Title | Company | Jan 2020 - Present", company on one
// line and title on the next, a date line on its own, a sentence such as "Working as a Technology
// Analyst in Infosys since Jun 2022 to till date"). The one thing every role has is its date
// range, so each date range is an anchor: the role's title / company / location are the short,
// non-bullet lines around the anchor, and everything up to the next anchor is the description.

const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const DATE_TOKEN = `(?:${MONTH}[\\s,'-]*\\d{2,4}|\\d{1,2}\\s*[/.-]\\s*\\d{4}|\\d{4}\\s*[/.-]\\s*\\d{1,2}|(?:19|20)\\d{2})`;
const OPEN_END = '(?:present|current|currently|now|still\\s*now|still\\s*working|till\\s*today|till\\s*date|till\\s*now|to\\s*date|until\\s*now|ongoing|date)';
const RANGE_RE = new RegExp(`(${DATE_TOKEN})\\s*(?:-|–|—|‑|\\bto\\b|\\buntil\\b|\\btill\\b)\\s*(${OPEN_END}|${DATE_TOKEN})`, 'i');
const SINCE_RE = new RegExp(`\\b(?:since|from)\\s+(${DATE_TOKEN})\\b(?!\\s*(?:-|–|—|to\\b))`, 'i');

const BULLET_RE = /^\s*[•●○▪■◦➢➤►▶✓✔·*+>\-–—]\s+/;
const TITLE_WORD_RE = /\b(engineer|developer|architect|manager|lead|specialist|analyst|consultant|designer|administrator|admin|coordinator|recruiter|director|intern|internship|trainee|officer|model builder|programmer|tester|scientist|executive|associate|head|owner|president|vp|sde|devops|technician|writer|strategist|advisor|representative|accountant|supervisor|assistant|representative|founder|freelancer|contractor|professional|generalist|planner|expert|developer\/[a-z]+|swe|qa|agent|clerk|fellow|tutor|teacher|nurse|operator|sales|marketer|buyer|auditor|recruiter|counsellor|counselor)\b/i;
const COMPANY_WORD_RE = /\b(labs?|technologies|technology|solutions?|systems|consulting|consultancy|services?|bank|corp|corporation|inc|llc|ltd|limited|pvt|private|company|group|software|tech|digital|industries|enterprises|global|partners|studio|works|university|institute|infotech|infosystems|networks|analytics|capital|finance|insurance|healthcare|pharma|media|ventures)\b/i;
const STRONG_COMPANY_RE = /(inc|llc|ltd|limited|pvt|private|corp|corporation|company|bank|university|institute|solutions?|services?|systems|labs?|group|enterprises|consultancy|technologies)/i;
const TECH_LIST_RE = /\b(react(?:\.js)?|angular|vue|node(?:\.js)?|asp\.net|\.net|jquery|javascript|typescript|python|java|sql|mysql|aws|azure|docker|kubernetes|html|css|django|flask|spring)\b/i;
const NON_HEADER_RE = /^(responsibilities|roles?\s*(?:and|&)\s*responsibilities|summary|technologies|technology|environment|tools|tech|tech stack|stack|project|projects|domain|client|key achievements|achievements|description|skills)\s*:/i;
const SENTENCE_ROLE_RE = /\b(?:working|worked|employed|serving|served|currently\s+working)?\s*as\s+(?:an?\s+)?([A-Za-z][A-Za-z/&.\- ]{2,60}?)\s+(?:in|at|with|for)\s+([A-Z][A-Za-z0-9&.,'() \-]{1,60}?)(?=\s*(?:,|\.|since|from|for\b|\d|$))/;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/^[\s|,;:•\-–—·]+|[\s|,;:•\-–—·]+$/g, '').trim();
}

// "06/2021" -> "Jun 2021"; already-textual dates are only tidied.
function normaliseDate(raw) {
  const text = clean(raw);
  if (!text) return null;
  let match = text.match(/^(\d{1,2})\s*[/.-]\s*((?:19|20)\d{2})$/);
  if (match && Number(match[1]) >= 1 && Number(match[1]) <= 12) return `${MONTH_NAMES[Number(match[1]) - 1]} ${match[2]}`;
  match = text.match(/^((?:19|20)\d{2})\s*[/.-]\s*(\d{1,2})$/);
  if (match && Number(match[2]) >= 1 && Number(match[2]) <= 12) return `${MONTH_NAMES[Number(match[2]) - 1]} ${match[1]}`;
  return text.replace(/\s+/g, ' ');
}

function isOpenEnd(value) {
  return new RegExp(`^${OPEN_END}$`, 'i').test(clean(value).replace(/\.$/, ''));
}

function findRange(line) {
  const match = RANGE_RE.exec(line);
  if (match) {
    return { index: match.index, length: match[0].length, start: match[1], end: match[2], current: isOpenEnd(match[2]) };
  }
  const since = SINCE_RE.exec(line);
  if (since && /\b(present|till|current|working|currently)\b/i.test(line)) {
    return { index: since.index, length: since[0].length, start: since[1], end: 'Present', current: true };
  }
  return null;
}

function isBullet(line) {
  return BULLET_RE.test(line);
}

function looksLikeTitle(text) {
  const value = clean(text);
  if (!value || value.length > 90) return false;
  return TITLE_WORD_RE.test(value) || /(developer|engineer|analyst|consultant|architect|manager|administrator|designer)$/i.test(value);
}

function looksLikeCompany(text) {
  const value = clean(text);
  if (!value || value.length > 80) return false;
  if (/@|https?:|www\./i.test(value) || /\+?\d[\d\s()-]{7,}/.test(value)) return false;
  if (value.split(/\s+/).length > 9) return false;
  if (/[.!?]$/.test(value) && value.split(/\s+/).length > 4 && !/\b(ltd|inc|pvt|corp|co|llc|limited|pte|plc)\.$/i.test(value)) return false;
  // a sentence ("Mentored junior developers ..."), a labelled value ("From : 24") or a technology list is not a company
  if (/^[A-Z][a-z]+(?:ed|ing)\s+\w+\s+\w+/.test(value) && value.split(/\s+/).length >= 4) return false;
  if (/^(from|to|period|duration|since|till|date|role|project|client)\b\s*:?/i.test(value) && value.split(/\s+/).length <= 3) return false;
  if (/:\s*\d+\s*$/.test(value)) return false;
  if (TECH_LIST_RE.test(value) && /[,/]/.test(value)) return false;
  return true;
}

const KNOWN_PLACES = new Set(['chennai','bangalore','bengaluru','hyderabad','pune','mumbai','delhi','new delhi','noida','gurgaon','gurugram','kolkata','ahmedabad','jaipur','kochi','cochin','coimbatore','madurai','trichy','tiruchirappalli','chandigarh','indore','bhopal','lucknow','nagpur','surat','vadodara','thane','navi mumbai','visakhapatnam','vizag','vijayawada','mysore','mysuru','mangalore','trivandrum','thiruvananthapuram','bhubaneswar','patna','ranchi','dehradun','ghaziabad','faridabad','nashik','remote','hybrid','onsite','london','dubai','singapore','sydney','melbourne','toronto','vancouver','berlin','munich','amsterdam','dublin','paris','warsaw','bucharest','lisbon','madrid','barcelona','new york','san francisco','seattle','austin','boston','chicago','atlanta','dallas','houston','lagos','nairobi','cairo','karachi','lahore','dhaka','colombo','kathmandu','manila','jakarta','kuala lumpur','bangkok','tokyo','india','usa','uk','germany','canada','australia','nigeria','poland','romania','singapore','auckland','wellington','christchurch','new zealand','pakistan','islamabad','rawalpindi','columbus','denver','phoenix','charlotte','minneapolis','detroit','philadelphia','pittsburgh','san jose','san diego','los angeles','washington','miami','orlando','tampa','raleigh','plano','irving','frisco','whitefield','electronic city','hinjewadi','hinjawadi','gachibowli','hitech city','madhapur','sector 62','manyata','ocean city','cluj-napoca','krakow','prague','vienna','zurich','stockholm','oslo','helsinki','copenhagen','brussels','milan','rome','istanbul','riyadh','jeddah','doha','abu dhabi','muscat','manama','kuwait','johannesburg','cape town','accra','tel aviv','hong kong','shanghai','beijing','seoul','taipei','hanoi','ho chi minh','netherlands','france','spain','italy','ireland','sweden','norway','finland','denmark','belgium','switzerland','austria','portugal','uae','saudi arabia','qatar','south africa','china','japan','korea','vietnam','philippines','malaysia','indonesia','thailand','bangladesh','sri lanka','nepal','karnataka','maharashtra','tamil nadu','telangana','andhra pradesh','kerala','gujarat','rajasthan','uttar pradesh','madhya pradesh','west bengal','odisha','haryana','punjab','goa','texas','california','florida','ohio','virginia','georgia','illinois','michigan','new jersey','north carolina','washington dc','dc']);

export function isKnownPlaceName(text) {
  const value = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!value) return false;
  if (KNOWN_PLACES.has(value)) return true;
  const words = value.split(' ');
  // "Greater Noida India" / "Pune Maharashtra": every word-group is a known place
  for (let split = 1; split < words.length; split += 1) {
    if (KNOWN_PLACES.has(words.slice(split).join(' ')) && (KNOWN_PLACES.has(words.slice(0, split).join(' ')) || /^(greater|new|navi|old|south|north|east|west)$/i.test(words[0]))) return true;
  }
  return false;
}

function isKnownPlace(text) {
  return clean(text).toLowerCase().split(/\s*,\s*/).every((part) => KNOWN_PLACES.has(part) || part.length === 0);
}

function looksLikePlace(text) {
  const value = clean(text);
  if (!value || value.length > 60 || /\d/.test(value)) return false;
  if (TITLE_WORD_RE.test(value) || COMPANY_WORD_RE.test(value)) return false;
  if (isKnownPlace(value)) return true;
  const parts = value.split(/\s*,\s*/);
  if (parts.length < 2 || parts.length > 3) return false;
  return parts.every((part) => /^[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3}$/.test(part) || /^(remote|hybrid|onsite|on-site)$/i.test(part));
}

// A short header-ish line: not a bullet, not a sentence, not a labelled description line.
function isHeaderCandidate(line) {
  const value = clean(line);
  if (!value || isBullet(line) || NON_HEADER_RE.test(value)) return false;
  if (value.length > 110 || value.split(/\s+/).length > 14) return false;
  if (/@|https?:\/\//i.test(value)) return false;
  if (/[.;]$/.test(value) && value.split(/\s+/).length > 6) return false;
  return true;
}

function splitParts(text) {
  const parts = String(text || '')
    .split(/\s*[|·•]\s*|\s+[–—-]\s+|\s*[–—]\s*|\s+@\s+|\s+at\s+|\s{3,}/i)
    .map(clean)
    .filter(Boolean);
  // "Senior Frontend Engineer, Filmmakers Mart" -> title and company
  return parts.flatMap((part) => {
    const comma = part.match(/^([^,]+?),\s*(.+)$/);
    if (comma && looksLikeTitle(comma[1]) && !looksLikeTitle(comma[2]) && !isKnownPlace(comma[2])) return [clean(comma[1]), clean(comma[2])];
    return [part];
  });
}

function dropRange(line, range) {
  return clean(`${line.slice(0, range.index)} ${line.slice(range.index + range.length)}`)
    .replace(/[()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickTitleCompany(candidateTexts) {
  let title = null;
  let company = null;
  let location = null;
  for (const text of candidateTexts) {
    for (const rawPart of splitParts(text)) {
      let part = rawPart;
      const labelled = part.match(/^(role|designation|position|title|job title|company|employer|organi[sz]ation|client|project|location)\s*:\s*-?\s*(.+)$/i);
      let label = null;
      if (labelled) {
        label = labelled[1].toLowerCase();
        part = clean(labelled[2]);
      }
      if (!part || /^(full[\s-]?time|part[\s-]?time|contract|permanent|internship|freelance|remote|hybrid|onsite)$/i.test(part)) continue;
      if (label === 'location') { location = location || part; continue; }
      if (label === 'client' || label === 'project') continue;
      if (label && /(company|employer|organi)/.test(label)) { if (!company && looksLikeCompany(part)) company = part; continue; }
      if (label && /(role|designation|position|title)/.test(label)) { if (!title && looksLikeCompany(part)) title = part; continue; }
      const colon = part.match(/^([^:]{3,60}):\s*(.{2,60})$/);
      if (!label && colon && looksLikeTitle(colon[1]) && !looksLikeTitle(colon[2])) {
        if (!title) title = clean(colon[1]);
        if (!company && looksLikeCompany(colon[2])) company = clean(colon[2]);
        continue;
      }
      const glued = part.match(/^(.+?\b(?:technologies|solutions|labs|limited|ltd|pvt|inc|llc|corp|infotech)(?:\s+(?:AS|AG|GmbH|AB|BV|SA|NV))?)\s+(\S.*)$/i);
      if (glued && looksLikeTitle(glued[2]) && !looksLikeTitle(glued[1]) && !title && !company) {
        company = clean(glued[1]);
        title = clean(glued[2]);
        continue;
      }
      const isTitle = looksLikeTitle(part) && !(STRONG_COMPANY_RE.test(part) && !/(engineer|developer|manager|analyst|consultant|lead|architect)/i.test(part));
      if (!title && isTitle) {
        title = part;
      } else if (looksLikePlace(part) && isKnownPlace(part)) {
        location = location || part;
      } else if (!company && looksLikeCompany(part) && !isTitle) {
        company = part;
      } else if (!location && looksLikePlace(part)) {
        location = part;
      }
    }
  }
  // "Data Engineer Noida, India" / "Data Engineer - Pune" -> the trailing place is the location
  if (title) {
    const trailing = title.match(/^(.*?(?:engineer|developer|analyst|consultant|architect|manager|lead|specialist|administrator|designer|executive|associate|officer|director|intern|tester))\s*[,(-]?\s*([A-Z][A-Za-z .]+(?:,\s*[A-Z][A-Za-z .]+)?)\)?$/i);
    if (trailing && isKnownPlace(trailing[2])) {
      title = clean(trailing[1]);
      location = location || clean(trailing[2]);
    }
  }
  // "Tata Consultancy Services, Kolkata, India" / "Zapcom Solutions Pvt. Ltd., Whitefield, Bangalore" -> company plus its place
  if (company && company.includes(',')) {
    const [head, ...rest] = company.split(/\s*,\s*/);
    const tail = rest.join(', ');
    const placeLike = rest.length > 0 && rest.length <= 3 && rest.every((part) => /^[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,2}$/.test(part) && !COMPANY_WORD_RE.test(part) && !TITLE_WORD_RE.test(part));
    if (clean(head) && placeLike && (isKnownPlace(rest[rest.length - 1]) || isKnownPlace(rest[0]) || rest.length >= 2)) {
      company = clean(head);
      location = location || clean(tail);
    }
  }
  return { title, company, location };
}

export function parseAnchoredExperience(lines = []) {
  const rows = (Array.isArray(lines) ? lines : []).map((line) => String(line || '').replace(/ /g, ' ').trim());
  const anchors = [];
  rows.forEach((line, index) => {
    if (!line) return;
    const range = findRange(line);
    if (!range) return;
    // a dated line inside a long sentence / bullet is body text, unless it reads as "working as X in Y since ..."
    if (line.length > 220) return;
    if ((isBullet(line) || line.split(/\s+/).length > 16) && !SENTENCE_ROLE_RE.test(line)) return;
    anchors.push({ index, range });
  });
  if (!anchors.length) return [];

  const claimed = new Set();
  const entries = [];

  anchors.forEach((anchor, anchorIndex) => {
    const { index, range } = anchor;
    const line = rows[index];
    const previousAnchor = anchors[anchorIndex - 1];
    const nextAnchor = anchors[anchorIndex + 1];
    const headerTexts = [];
    const headerLines = [index];

    const sentence = (isBullet(line) || line.split(/\s+/).length > 10) ? line.match(SENTENCE_ROLE_RE) : null;
    if (sentence) {
      headerTexts.push(`${clean(sentence[1])} | ${clean(sentence[2])}`);
    } else {
      const own = dropRange(line, range);
      if (own) headerTexts.push(own);
    }

    // lines just above the anchor that belong to this role's header (stop at the previous role's body)
    const floor = previousAnchor ? previousAnchor.index + 1 : 0;
    let cursor = index - 1;
    let above = 0;
    let blanks = 0;
    const aboveTexts = [];
    while (cursor >= floor && above < 3 && blanks < 4) {
      const candidate = rows[cursor];
      if (!candidate) { cursor -= 1; blanks += 1; continue; }
      if (claimed.has(cursor) || !isHeaderCandidate(candidate) || findRange(candidate)) break;
      aboveTexts.unshift(candidate);
      headerLines.push(cursor);
      above += 1;
      cursor -= 1;
    }
    // read the header top-down: lines above the date first, the date line's own text last
    headerTexts.unshift(...aboveTexts);
    if (headerTexts.length > aboveTexts.length) headerTexts.push(headerTexts.splice(aboveTexts.length, 1)[0]);

    let picked = pickTitleCompany(headerTexts);

    // lines just below the anchor, when the header is still incomplete (date line first, then company/title)
    if (!picked.title || !picked.company) {
      const ceiling = nextAnchor ? nextAnchor.index - 1 : rows.length - 1;
      let below = index + 1;
      let taken = 0;
      while (below <= ceiling && taken < 2 && (!picked.title || !picked.company)) {
        const candidate = rows[below];
        if (!candidate) { below += 1; continue; }
        if (!isHeaderCandidate(candidate) || findRange(candidate)) break;
        // a following line only counts when it adds the missing half, not when it starts the description
        const extra = pickTitleCompany([candidate]);
        if ((!picked.title && extra.title) || (!picked.company && extra.company && !isBullet(candidate))) {
          picked = {
            title: picked.title || extra.title,
            company: picked.company || extra.company,
            location: picked.location || extra.location,
          };
          headerLines.push(below);
          taken += 1;
          below += 1;
          continue;
        }
        break;
      }
    }

    headerLines.forEach((row) => claimed.add(row));
    if (!picked.title && !picked.company) return;

    const bodyStart = Math.max(...headerLines.filter((row) => row >= index), index) + 1;
    const bodyEnd = nextAnchor ? Math.min(nextAnchor.index, ...[nextAnchor.index]) : rows.length;
    const body = [];
    for (let row = bodyStart; row < bodyEnd; row += 1) {
      const text = rows[row];
      if (!text || claimed.has(row)) continue;
      // trailing header lines of the next role (title/company printed above its date line) are not description
      if (nextAnchor && row >= nextAnchor.index - 2 && isHeaderCandidate(text) && !isBullet(text)) continue;
      body.push(text.replace(BULLET_RE, ''));
    }

    // labelled lines ("Project: ...", "Domain: ...", "Technologies: ...") are fields, not description
    let project = null;
    let domain = null;
    const technologies = [];
    const descriptionBody = [];
    for (const text of body) {
      const labelled = text.match(/^(project|domain|technologies|technology|tools|tech|tech stack|stack|environment)\s*:\s*(.*)$/i);
      if (!labelled) {
        descriptionBody.push(text);
        continue;
      }
      const key = labelled[1].toLowerCase();
      const value = clean(labelled[2]);
      if (key === 'project') project = project || value || null;
      else if (key === 'domain') domain = domain || value || null;
      else technologies.push(...value.split(/\s*[,;|]\s*/).map(clean).filter(Boolean));
    }

    const startDate = normaliseDate(range.start);
    const endDate = range.current ? null : normaliseDate(range.end);
    const summary = clean(descriptionBody.join(' ')).slice(0, 1500);
    entries.push({
      company: picked.company || null,
      employer: picked.company || null,
      designation: picked.title || null,
      title: picked.title || null,
      jobTitle: picked.title || null,
      employmentType: null,
      startDate,
      endDate,
      currentlyWorking: Boolean(range.current),
      isCurrent: Boolean(range.current),
      duration: clean(line.slice(range.index, range.index + range.length)) || null,
      location: picked.location || null,
      project,
      domain,
      responsibilities: summary ? [summary] : [],
      technologies,
      skills: technologies,
      summary,
      description: summary,
    });
  });

  return entries;
}
