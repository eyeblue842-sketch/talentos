import { redirect } from 'next/navigation';
import { getInitialSetupStatus } from '@/lib/api';

export async function getSetupStatusServer() {
  try {
    return await getInitialSetupStatus();
  } catch {
    return {
      initialized: true,
      setupCompleted: true,
      forcedSetupMode: false,
    };
  }
}

export async function redirectToSetupIfRequired() {
  const status = await getSetupStatusServer();
  if (!status.initialized) {
    redirect('/setup');
  }
  return status;
}

export async function redirectAwayFromSetupIfInitialized() {
  const status = await getSetupStatusServer();
  if (status.initialized) {
    redirect('/auth');
  }
  return status;
}
