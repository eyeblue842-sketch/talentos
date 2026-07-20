"use client";

import { ToastProvider } from '@/components/ui/toast';

export function AppProviders({ children }) {
  return <ToastProvider>{children}</ToastProvider>;
}
