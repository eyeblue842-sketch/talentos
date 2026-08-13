"use client";

import { FormSection } from './form-section';
import { DepartmentRoleSelector } from './department-role-selector';
import { IndustrySelector } from './industry-selector';
import { CompanySelector } from './company-selector';
import { DesignationSelector } from './designation-selector';

export function ResumeSearchEmployment({ formState, onPatch }) {
  return (
    <FormSection title="Employment Details">
      <div className="grid gap-6">
        <DepartmentRoleSelector
          currentDesignation={formState.currentDesignation}
          onApplyRole={(role) => {
            if (formState.currentDesignation) return;
            onPatch({ currentDesignation: role });
          }}
        />
        <IndustrySelector values={formState.industries || []} onChange={(industries) => onPatch({ industries })} />
        <CompanySelector formState={formState} onPatch={onPatch} />
        <DesignationSelector formState={formState} onPatch={onPatch} />
      </div>
    </FormSection>
  );
}
