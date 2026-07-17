export function PublicJobSearchForm({ action = '/jobs', searchParams = {}, organisationLocked = false }) {
  return (
    <form action={action} className="grid gap-3 rounded-[28px] border border-[var(--line)] bg-white p-5 shadow-[0_14px_40px_rgba(16,36,24,0.05)]">
      <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
        <input name="keyword" defaultValue={searchParams.keyword || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Search roles, skills, or keywords" />
        <input name="location" defaultValue={searchParams.location || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Location" />
        <input name="skills" defaultValue={searchParams.skills || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Skills" />
        <select name="workplaceType" defaultValue={searchParams.workplaceType || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3">
          <option value="">Workplace type</option>
          <option value="REMOTE">Remote</option>
          <option value="HYBRID">Hybrid</option>
          <option value="ONSITE">On-site</option>
        </select>
        <button type="submit" className="rounded-2xl bg-[var(--brand)] px-5 py-3 font-semibold text-white">Search</button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <select name="employmentType" defaultValue={searchParams.employmentType || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3">
          <option value="">Employment type</option>
          <option value="FULL_TIME">Full-time</option>
          <option value="PART_TIME">Part-time</option>
          <option value="CONTRACT">Contract</option>
          <option value="INTERN">Internship</option>
        </select>
        <input name="minExperience" type="number" min="0" defaultValue={searchParams.minExperience || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Min exp" />
        <input name="maxExperience" type="number" min="0" defaultValue={searchParams.maxExperience || ''} className="rounded-2xl border border-[var(--line)] px-4 py-3" placeholder="Max exp" />
        <input name="organisation" defaultValue={organisationLocked ? '' : searchParams.organisation || ''} disabled={organisationLocked} className="rounded-2xl border border-[var(--line)] px-4 py-3 disabled:bg-slate-50" placeholder="Company" />
        <select name="sort" defaultValue={searchParams.sort || 'relevance'} className="rounded-2xl border border-[var(--line)] px-4 py-3">
          <option value="relevance">Relevance</option>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="salary_high">Salary high to low</option>
        </select>
        <div className="flex items-center justify-between rounded-2xl border border-[var(--line)] px-4 py-3 text-sm">
          <label htmlFor="fresherFriendly" className="text-[var(--muted)]">Fresher friendly</label>
          <input id="fresherFriendly" name="fresherFriendly" type="checkbox" defaultChecked={searchParams.fresherFriendly === 'true'} className="h-4 w-4 accent-[var(--brand)]" />
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-sm">
        <a href={action} className="rounded-full border border-[var(--line)] px-4 py-2 font-semibold text-[var(--muted)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]">Reset filters</a>
      </div>
    </form>
  );
}

