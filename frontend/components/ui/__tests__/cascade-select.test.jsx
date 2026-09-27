import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CascadeSelect, toCascadeOptions } from '../cascade-select';

const treeOptions = [
  {
    label: 'Manufacturing & Production',
    children: [
      { label: 'Chemicals', children: [
        { label: 'Paints', value: 'Paints' },
        { label: 'Other', value: 'Chemicals - Other' },
      ] },
      { label: 'Automobile', value: 'Automobile' },
    ],
  },
  { label: 'Technology', children: [{ label: 'Software Product', value: 'Software Product' }] },
];

function open(name = 'Industry') {
  fireEvent.click(screen.getByRole('button', { name }));
}

describe('CascadeSelect', () => {
  it('flat string options render and select as single value', () => {
    const onChange = vi.fn();
    render(<CascadeSelect label="Industry" options={toCascadeOptions(['IT', 'Retail'])} value="" onChange={onChange} placeholder="Select industry" />);
    open();
    fireEvent.click(screen.getByRole('option', { name: 'Retail' }));
    expect(onChange).toHaveBeenCalledWith('Retail');
  });

  it('drills through branches to reach a nested leaf', () => {
    const onChange = vi.fn();
    render(<CascadeSelect label="Industry" options={treeOptions} value="" onChange={onChange} />);
    open();
    fireEvent.click(screen.getByRole('option', { name: /Manufacturing & Production/i }));
    fireEvent.click(screen.getByRole('option', { name: /^Chemicals/i }));
    fireEvent.click(screen.getByRole('option', { name: 'Paints' }));
    expect(onChange).toHaveBeenCalledWith('Paints');
  });

  it('search finds a deep leaf by label', () => {
    const onChange = vi.fn();
    render(<CascadeSelect label="Industry" options={treeOptions} value="" onChange={onChange} />);
    open();
    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'paint' } });
    fireEvent.click(screen.getByRole('option', { name: /Paints/i }));
    expect(onChange).toHaveBeenCalledWith('Paints');
  });

  it('multi-select toggles values and posts a comma-joined hidden input', () => {
    const onChange = vi.fn();
    const { container, rerender } = render(
      <CascadeSelect label="Education" name="education" multiple options={treeOptions} value={[]} onChange={onChange} />,
    );
    open('Education');
    fireEvent.click(screen.getByRole('option', { name: /Technology/i }));
    fireEvent.click(screen.getByRole('option', { name: 'Software Product' }));
    expect(onChange).toHaveBeenCalledWith(['Software Product']);

    rerender(<CascadeSelect label="Education" name="education" multiple options={treeOptions} value={['Software Product']} onChange={onChange} />);
    expect(container.querySelector('input[name="education"]').value).toBe('Software Product');
  });

  it('clear button resets the selection', () => {
    const onChange = vi.fn();
    render(<CascadeSelect label="Industry" options={toCascadeOptions(['IT', 'Retail'])} value="Retail" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /clear selection/i }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
