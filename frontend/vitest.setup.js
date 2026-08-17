import '@testing-library/jest-dom/vitest';
import { expect } from 'vitest';
import { toHaveNoViolations } from 'vitest-axe/matchers';

// vitest-axe exports the matcher function itself under this name (not an
// object of matchers), so it must be wrapped in a matcher-name -> fn object
// for expect.extend - passing it directly is a silent no-op.
expect.extend({ toHaveNoViolations });
