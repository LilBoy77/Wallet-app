import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.js';

describe('Web App Smoke Test', () => {
  it('should render scaffold placeholder heading without crashing', () => {
    render(<App />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent(/Wallet App — scaffold/i);
  });
});
