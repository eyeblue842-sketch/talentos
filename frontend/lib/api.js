const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

const mockData = {
  recruiterDashboard: {
    jobsCount: 12,
    applicantsCount: 184,
    pipelineCounts: [
      { currentStage: 'APPLIED', _count: { currentStage: 48 } },
      { currentStage: 'SHORTLISTED', _count: { currentStage: 18 } },
      { currentStage: 'INTERVIEW_SCHEDULED', _count: { currentStage: 9 } },
      { currentStage: 'SELECTED', _count: { currentStage: 4 } },
    ],
    recentApplications: [
      { id: '1', candidate: { fullName: 'Aarav Sharma' }, job: { title: 'Frontend Engineer' }, matchScore: 94 },
      { id: '2', candidate: { fullName: 'Meera Nair' }, job: { title: 'Product Designer' }, matchScore: 88 },
    ],
  },
  candidateDashboard: {
    applicationsCount: 7,
    resumeViews: 23,
    recentApplications: [],
    suggestedJobs: [],
  },
};

async function request(path, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Request failed for ${path}`);
    }

    return response.json();
  } catch (error) {
    return { success: true, data: null, fallback: true };
  }
}

export async function getRecruiterDashboard() {
  const response = await request('/dashboard/recruiter');
  return response.data || mockData.recruiterDashboard;
}

export async function getCandidateDashboard() {
  const response = await request('/dashboard/candidate');
  return response.data || mockData.candidateDashboard;
}

export async function getPublicJobs() {
  const response = await request('/jobs/public');
  return response.data || [];
}

