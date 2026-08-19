import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { CandidateProfileActiveArea } from '../candidate-profile-active-area';

const profileLinks = [
  { id: 'profile-snapshot', label: 'Profile Snapshot', href: '#profile-snapshot' },
  { id: 'resume-headline', label: 'Resume Headline', href: '#resume-headline' },
  { id: 'key-skills', label: 'Key Skills', href: '#key-skills' },
  { id: 'employment', label: 'Employment', href: '#employment' },
  { id: 'education', label: 'Education', href: '#education' },
  { id: 'projects', label: 'Projects', href: '#projects' },
  { id: 'profile-summary', label: 'Profile Summary', href: '#professional-story' },
  { id: 'certifications', label: 'Certifications', href: '#certifications' },
  { id: 'career-preferences', label: 'Career Preferences', href: '#preferences' },
  { id: 'languages', label: 'Languages', href: '#languages' },
  { id: 'privacy', label: 'Privacy Controls', href: '#privacy' },
];

describe('CandidateProfileActiveArea', () => {
  test('renders as a compact navigation card with profile expanded by default and unique section hrefs', () => {
    const { container } = render(
      <CandidateProfileActiveArea profileLinks={profileLinks} defaultProfileExpanded />
    );

    expect(screen.getByText('Active Area')).toBeInTheDocument();
    expect(container.firstChild.className).toContain('max-w-[320px]');
    const profileToggle = screen.getByRole('button', { name: 'Profile' });
    expect(profileToggle).toHaveAttribute('aria-expanded', 'true');

    const sectionAnchors = profileLinks.map((link) => screen.getByRole('link', { name: link.label }));
    expect(new Set(sectionAnchors.map((anchor) => anchor.getAttribute('href'))).size).toBe(profileLinks.length);
    expect(screen.getAllByRole('link', { name: 'Profile Snapshot' })).toHaveLength(1);
  });

  test('collapses and expands the profile subsection links', () => {
    render(<CandidateProfileActiveArea profileLinks={profileLinks} defaultProfileExpanded />);

    const profileToggle = screen.getByRole('button', { name: 'Profile' });
    fireEvent.click(profileToggle);
    expect(profileToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: 'Profile Snapshot' })).not.toBeInTheDocument();

    fireEvent.click(profileToggle);
    expect(profileToggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Profile Snapshot' })).toBeInTheDocument();
  });
});
