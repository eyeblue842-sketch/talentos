"use client";

import { LocationMultiSelect } from '@/components/sections/resume-search/location-multi-select';

/**
 * Converts the flat "District, State" strings LocationMultiSelect works
 * with into the canonical {id, name, city, state} shape Job.locations
 * (JSON) stores. The district/state list is a fixed, hand-maintained
 * taxonomy (lib/india-location-master.js) so the display string itself is
 * already a stable, unique identifier - reused as-is for `id` rather than
 * inventing a parallel id space.
 */
export function toCanonicalLocations(values = []) {
  return values.map((value) => {
    const [city, state] = value.includes(', ') ? value.split(', ') : [value, null];
    return { id: value, name: value, city, state: state || null };
  });
}

export function fromCanonicalLocations(locations = []) {
  return locations.map((location) => location.name || location.id).filter(Boolean);
}

/**
 * Job Location: a searchable, multi-select, chip-based replacement for the
 * old free-text `location` field. Required-ness is workplace-dependent (see
 * the job-post wizard: on-site/hybrid require at least one location, remote
 * does not) - this component only renders the field and required marker;
 * it does not itself decide whether the value is optional.
 */
export function JobLocationSelector({ values, onChange, required = false }) {
  return (
    <div className="grid min-w-0 max-w-full gap-2">
      <LocationMultiSelect
        label={(
          <>
            Job location{required ? <span className="ml-1 text-[var(--color-danger)]">*</span> : null}
          </>
        )}
        placeholder="Search and select one or more job locations"
        values={values}
        onChange={onChange}
      />
    </div>
  );
}
