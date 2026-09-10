'use client';

import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function OnboardingSubmitButton({ edit = false }) {
  return (
    <Button type="submit" trailingIcon={ArrowRight}>
      {edit ? 'Save changes' : 'Complete workspace setup'}
    </Button>
  );
}
