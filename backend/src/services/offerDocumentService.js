import PDFDocument from 'pdfkit';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { getOfferTemplateById } from './offerTemplateService.js';
import { readPrivateFileNodeStream } from '../config/storage.js';

function slugToken(label) {
  return String(label || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function twoDigits(n) {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}
// Indian numbering (Lakh/Crore) integer-to-words, for {ctcInWords}.
function numberToWordsInr(value) {
  let n = Math.round(Number(value) || 0);
  if (n === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = Math.floor(n / 100); n %= 100;
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(`${ONES[hundred]} Hundred`);
  if (n) parts.push(twoDigits(n));
  return parts.join(' ').trim();
}

async function readStorageBuffer(provider, key) {
  const { stream } = await readPrivateFileNodeStream(provider, key);
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// The full merge data (candidate/job/offer + salary annexure components + words),
// shared by the pdfkit letter and the docx template merge. Component amounts are
// exposed both individually (slugified label, e.g. {hra}) and as an {annexure} loop.
function buildMergeData(offer, model) {
  const cf = (offer.customFields && typeof offer.customFields === 'object') ? offer.customFields : {};
  const [firstName, ...restName] = String(model.candidateName || '').trim().split(/\s+/);
  const lastName = restName.join(' ');
  const monthly = (v) => (v == null || v === '' ? '' : plainNumber(Number(v) / 12));
  const designation = cf.designation || model.jobTitle;
  const ctc = offer.annualCompensation;

  // Flat map keyed by BOTH Zoho field names (e.g. "Offers.CTC/annum",
  // "Candidates.First Name") and our own simple tokens (ctcAnnual, hra, …), so an
  // uploaded Zoho-format .docx merges verbatim and our text templates keep working.
  const data = {
    // --- Candidate ---
    'Candidates.First Name': firstName || model.candidateName,
    'Candidates.Last Name': lastName,
    'Candidates.Name': model.candidateName,
    'Candidates.Full Name': model.candidateName,
    'Candidates.Email': model.candidateEmail,
    candidateName: model.candidateName,
    candidateEmail: model.candidateEmail,
    // --- Company / Client ---
    'Company.Name': model.organisationName,
    'Client.Name': model.organisationName,
    companyName: model.organisationName,
    // --- Offer core ---
    'Offers.Offer ID': model.referenceNumber,
    'Offers.Designation': designation,
    'Offers.Job Title': model.jobTitle,
    'Offers.Department': model.department,
    'Offers.Location': cf.joiningLocation || model.location,
    'Offers.Work Mode': String(offer.workMode || '').replaceAll('_', ' '),
    'Offers.Reporting To': cf.reportingTo || model.reportingManagerName,
    'Offers.Expected Joining Date': model.proposedJoiningDate,
    'Offers.Offer Date': formatDate(new Date()),
    'Offers.Expiry Date': model.expiryAt,
    'Offers.Working Days': cf.workingDays || '',
    'Offers.Contract Start Date': cf.contractStartDate ? formatDate(cf.contractStartDate) : '',
    'Offers.Contract End Date': cf.contractEndDate ? formatDate(cf.contractEndDate) : '',
    'Offers.Training End Date': cf.trainingEndDate ? formatDate(cf.trainingEndDate) : '',
    'Offers.Stipend': cf.stipend != null ? plainNumber(cf.stipend) : '',
    'Offers.Per Hour': cf.perHour != null ? plainNumber(cf.perHour) : '',
    // --- Salary ---
    'Offers.Currency': offer.currency || 'INR',
    'Offers.CTC/annum': plainNumber(ctc),
    'Offers.CTC In Words': ctc != null ? numberToWordsInr(ctc) : '',
    'Offers.CTC Monthly': monthly(ctc),
    'Offers.Basic/annum': plainNumber(offer.fixedCompensation),
    'Offers.Variable/annum': plainNumber(offer.variableCompensation),
    'Offers.Joining Bonus': plainNumber(offer.joiningBonus),
    // simple aliases
    designation,
    department: model.department,
    workMode: String(offer.workMode || '').replaceAll('_', ' '),
    workLocation: cf.joiningLocation || model.location,
    reportingManager: cf.reportingTo || model.reportingManagerName,
    currency: offer.currency || 'INR',
    ctcAnnual: plainNumber(ctc),
    ctcInWords: ctc != null ? numberToWordsInr(ctc) : '',
    ctcMonthly: monthly(ctc),
    fixedAnnual: plainNumber(offer.fixedCompensation),
    variableAnnual: plainNumber(offer.variableCompensation),
    joiningBonus: plainNumber(offer.joiningBonus),
    otherCompensation: plainNumber(offer.otherCompensation),
    joiningDate: model.proposedJoiningDate,
    expiryDate: model.expiryAt,
    referenceNumber: model.referenceNumber,
    offerDate: formatDate(new Date()),
    jobTitle: model.jobTitle,
    annexure: (offer.components || []).map((c) => ({ label: c.label, amount: plainNumber(c.amount), monthly: monthly(c.amount) })),
  };
  // Each annexure component → simple token {hra}, Zoho token "Offers.HRA/annum",
  // and a monthly variant {hraMonthly} / "Offers.HRA/month".
  for (const component of offer.components || []) {
    const slug = slugToken(component.label);
    data[slug] = plainNumber(component.amount);
    data[`${slug}Monthly`] = monthly(component.amount);
    data[`Offers.${component.label}/annum`] = plainNumber(component.amount);
    data[`Offers.${component.label}/month`] = monthly(component.amount);
  }
  // Every customField (including recruiter-added "additional information" rows for
  // company-specific clauses) is exposed by its raw key, a slug, and a Zoho-style
  // «Offers.<Label>» name, so any extra info can be merged into the letter.
  for (const [k, v] of Object.entries(cf)) {
    const val = v == null ? '' : String(v);
    if (data[k] === undefined) data[k] = val;
    const slug = slugToken(k);
    if (slug && data[slug] === undefined) data[slug] = val;
    if (data[`Offers.${k}`] === undefined) data[`Offers.${k}`] = val;
  }
  return data;
}

// Merges the offer into the template's uploaded .docx and returns the docx buffer.
// Supports both Zoho-style «Module.Field» delimiters and simple {token} delimiters
// (auto-detected), with a flat parser so field names with spaces/slashes resolve.
export async function generateOfferDocxBuffer(offer) {
  const template = offer.offerTemplateId ? await getOfferTemplateById(offer.organisationId, offer.offerTemplateId).catch(() => null) : null;
  if (!template?.documentStorageKey) return null;
  const buffer = await readStorageBuffer(template.documentStorageProvider || 'local', template.documentStorageKey);
  const zip = new PizZip(buffer);
  let documentXml = '';
  try { documentXml = zip.file('word/document.xml')?.asText() || ''; } catch { documentXml = ''; }
  const useGuillemets = documentXml.includes('«');
  const model = buildOfferDocumentModel(offer);
  const data = buildMergeData(offer, model);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: useGuillemets ? { start: '«', end: '»' } : { start: '{', end: '}' },
    // Flat lookup of the exact tag string (handles "Offers.CTC In Words", "Offers.HRA/annum").
    parser: (tag) => ({ get: (scope) => (scope && scope[tag] !== undefined ? scope[tag] : (data[tag] !== undefined ? data[tag] : undefined)) }),
    nullGetter: () => '',
  });
  doc.render(data);
  return { buffer: doc.getZip().generate({ type: 'nodebuffer' }), filename: `${offer.referenceNumber || 'offer'}.docx` };
}

function plainNumber(amount) {
  if (amount == null) return '';
  return Number(amount).toLocaleString('en-IN');
}

// Fills {{token}} placeholders in an offer template's letter body from the offer.
function mergeLetterBody(body, offer, model) {
  const tokens = {
    candidateName: model.candidateName,
    candidateEmail: model.candidateEmail,
    jobTitle: model.jobTitle,
    designation: model.jobTitle,
    companyName: model.organisationName,
    department: model.department,
    workMode: String(offer.workMode || '').replaceAll('_', ' ') || 'Not specified',
    workLocation: model.location,
    reportingManager: model.reportingManagerName,
    currency: offer.currency || 'INR',
    ctcAnnual: plainNumber(offer.annualCompensation),
    fixedAnnual: plainNumber(offer.fixedCompensation),
    variableAnnual: plainNumber(offer.variableCompensation),
    joiningDate: model.proposedJoiningDate,
    expiryDate: model.expiryAt,
    referenceNumber: model.referenceNumber,
    offerDate: formatDate(new Date()),
  };
  return String(body).replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key) => (tokens[key] != null ? String(tokens[key]) : match));
}

function currency(amount, code = 'INR') {
  if (amount == null) return 'Not specified';
  return `${code} ${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return 'Not specified';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function writeKeyValue(doc, label, value) {
  doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
  doc.font('Helvetica').text(value || 'Not specified');
}

export function buildOfferDocumentModel(offer) {
  return {
    referenceNumber: offer.referenceNumber,
    version: offer.version,
    organisationName: offer.organisation?.name || 'Careeriz Hire',
    candidateName: offer.candidate?.fullName || 'Candidate',
    candidateEmail: offer.candidate?.user?.email || 'Not specified',
    jobTitle: offer.job?.title || 'Role',
    department: offer.departmentSnapshot || offer.job?.department || 'Not specified',
    location: offer.workLocation || offer.job?.location || 'Not specified',
    employmentType: offer.employmentTypeSnapshot || offer.job?.employmentType || 'Not specified',
    recruiterName: offer.recruiterNameSnapshot || offer.job?.recruiter?.email || 'Not specified',
    reportingManagerName: offer.reportingManagerName || 'Not specified',
    proposedJoiningDate: formatDate(offer.proposedJoiningDate),
    expiryAt: formatDate(offer.expiryAt),
    currency: offer.currency,
    annualCompensation: currency(offer.annualCompensation, offer.currency),
    fixedCompensation: currency(offer.fixedCompensation, offer.currency),
    variableCompensation: currency(offer.variableCompensation, offer.currency),
    joiningBonus: currency(offer.joiningBonus, offer.currency),
    retentionBonus: currency(offer.retentionBonus, offer.currency),
    allowancesAmount: currency(offer.allowancesAmount, offer.currency),
    otherCompensation: currency(offer.otherCompensation, offer.currency),
    totalCompensation: currency(offer.totalCompensation, offer.currency),
    benefitsSummary: offer.benefitsSummary || 'Benefits are included as per company policy.',
    compensationNotes: offer.compensationNotes || 'No additional compensation notes.',
    noticeOrBuyoutNote: offer.noticeOrBuyoutNote || 'No notice or buyout note.',
    termsAndConditions: offer.termsAndConditions || 'Standard employment terms and company policies apply.',
    components: (offer.components || []).map((component) => ({
      label: component.label,
      type: component.type,
      frequency: component.frequency,
      taxable: component.taxable,
      amount: currency(component.amount, offer.currency),
    })),
  };
}

export async function generateOfferPdfBuffer(offer) {
  const model = buildOfferDocumentModel(offer);
  // When the offer was created from a template with a letter body, render the
  // merged letter; otherwise fall back to the structured key-value layout.
  const template = offer.offerTemplateId
    ? await getOfferTemplateById(offer.organisationId, offer.offerTemplateId).catch(() => null)
    : null;
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  const chunks = [];

  return new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (template?.letterBody) {
      doc.fontSize(22).font('Helvetica-Bold').text(model.organisationName);
      doc.moveDown(0.3);
      doc.fontSize(16).text('Offer Letter');
      doc.moveDown(0.8);
      doc.font('Helvetica').fontSize(11).text(mergeLetterBody(template.letterBody, offer, model), { align: 'left', lineGap: 2 });
      if (model.components.length) {
        doc.moveDown();
        doc.font('Helvetica-Bold').fontSize(13).text('Annexure — Salary Components');
        doc.moveDown(0.3);
        for (const component of model.components) {
          doc.font('Helvetica-Bold').fontSize(11).text(`${component.label} `, { continued: true });
          doc.font('Helvetica').text(`- ${component.amount}`);
        }
      }
      doc.moveDown();
      doc.fontSize(9).fillColor('#555').text(`Reference ${model.referenceNumber} / v${model.version} — generated by Careeriz Hire.`);
      doc.end();
      return;
    }

    doc.fontSize(22).font('Helvetica-Bold').text(model.organisationName);
    doc.moveDown(0.3);
    doc.fontSize(16).text('Offer Letter');
    doc.moveDown(0.8);
    writeKeyValue(doc, 'Offer Reference', `${model.referenceNumber} / v${model.version}`);
    writeKeyValue(doc, 'Candidate', model.candidateName);
    writeKeyValue(doc, 'Email', model.candidateEmail);
    writeKeyValue(doc, 'Job Title', model.jobTitle);
    writeKeyValue(doc, 'Department', model.department);
    writeKeyValue(doc, 'Work Location', model.location);
    writeKeyValue(doc, 'Employment Type', String(model.employmentType).replaceAll('_', ' '));
    writeKeyValue(doc, 'Recruiter', model.recruiterName);
    writeKeyValue(doc, 'Reporting Manager', model.reportingManagerName);
    writeKeyValue(doc, 'Proposed Joining Date', model.proposedJoiningDate);
    writeKeyValue(doc, 'Offer Expiry', model.expiryAt);

    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(14).text('Compensation Summary');
    doc.moveDown(0.4);
    writeKeyValue(doc, 'Annual Compensation', model.annualCompensation);
    writeKeyValue(doc, 'Fixed Compensation', model.fixedCompensation);
    writeKeyValue(doc, 'Variable Compensation', model.variableCompensation);
    writeKeyValue(doc, 'Joining Bonus', model.joiningBonus);
    writeKeyValue(doc, 'Retention Bonus', model.retentionBonus);
    writeKeyValue(doc, 'Allowances', model.allowancesAmount);
    writeKeyValue(doc, 'Other Compensation', model.otherCompensation);
    writeKeyValue(doc, 'Total Compensation', model.totalCompensation);

    if (model.components.length) {
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('Component Breakdown');
      doc.moveDown(0.2);
      for (const component of model.components) {
        doc.font('Helvetica-Bold').text(`${component.label} `, { continued: true });
        doc.font('Helvetica').text(`(${component.type}, ${component.frequency}) - ${component.amount}`);
      }
    }

    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(14).text('Benefits and Notes');
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(11).text(model.benefitsSummary);
    doc.moveDown(0.3);
    doc.text(model.compensationNotes);
    doc.moveDown(0.3);
    doc.text(`Notice / Buyout: ${model.noticeOrBuyoutNote}`);

    doc.moveDown();
    doc.font('Helvetica-Bold').fontSize(14).text('Terms and Conditions');
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(11).text(model.termsAndConditions);

    doc.moveDown();
    doc.fontSize(10).fillColor('#555').text(
      `This document was generated by Careeriz Hire. Version ${model.version} for offer ${model.referenceNumber}.`,
      { align: 'left' },
    );

    doc.end();
  });
}
