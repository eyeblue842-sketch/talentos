import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { CandidateProfileSnapshot } from '@/components/sections/candidate-profile-snapshot';
import { LocationMultiSelect } from '@/components/sections/resume-search/location-multi-select';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));

afterEach(() => cleanup());

const snapshot = { fullName: 'Asha Rao', currentTitle: 'Engineer', completionPercentage: 60 };

describe('profile snapshot edit button', () => {
  test('on the dashboard (no inline editor) the pencil links to the profile page with the editor open', () => {
    render(<CandidateProfileSnapshot snapshot={snapshot} />);
    const edit = screen.getByRole('link', { name: /edit profile snapshot/i });
    expect(edit).toHaveAttribute('href', '/candidate/profile?edit=profile-snapshot');
  });

  test('on the profile page the pencil opens the editor in place', () => {
    const onEdit = vi.fn();
    render(<CandidateProfileSnapshot snapshot={snapshot} onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: /edit profile snapshot/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

describe('location picker with a cap', () => {
  test('refuses a fourth location and says so', () => {
    const onChange = vi.fn();
    render(
      <LocationMultiSelect
        label="Preferred locations"
        values={['Pune, Maharashtra', 'Thane, Maharashtra', 'Nashik, Maharashtra']}
        onChange={onChange}
        maxItems={3}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /preferred locations/i }));
    fireEvent.change(screen.getByPlaceholderText(/search city, district or state/i), { target: { value: 'Nagpur' } });
    fireEvent.click(screen.getAllByRole('checkbox').find((box) => !box.checked));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/up to 3/i);
  });
});

describe('single-select location picker (current location)', () => {
  test('picking a district sets exactly one value, replacing the previous one, and closes the list', () => {
    const onChange = vi.fn();
    render(
      <LocationMultiSelect label="Current location" values={['Pune, Maharashtra']} onChange={onChange} single />,
    );
    fireEvent.click(screen.getByRole('button', { name: /current location/i }));
    fireEvent.change(screen.getByPlaceholderText(/search city, district or state/i), { target: { value: 'Chennai' } });
    // no whole-state checkbox in single mode
    const boxes = screen.getAllByRole('checkbox');
    fireEvent.click(boxes.find((box) => !box.checked));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toHaveLength(1);
    expect(onChange.mock.calls[0][0][0]).toMatch(/chennai/i);
    expect(screen.queryByPlaceholderText(/search city, district or state/i)).not.toBeInTheDocument();
  });
});
