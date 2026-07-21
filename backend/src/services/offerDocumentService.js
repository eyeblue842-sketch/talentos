import PDFDocument from 'pdfkit';

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
  const doc = new PDFDocument({ margin: 48, size: 'A4' });
  const chunks = [];

  return new Promise((resolve, reject) => {
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

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
