import {test, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import App from './App.jsx';

test('renders the masthead', () => {
  render(<App />);
  expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('HowTheLightGetsIn');
});

// The PR workflow builds with VITE_PREVIEW="PR #12"; the live build has no such variable, so neither the
// ribbon nor the robots tag exists there.
test('a preview build carries the ribbon and a noindex tag; a live build carries neither', () => {
  const {unmount} = render(<App />);
  expect(document.querySelector('.previewtag')).toBeNull();
  expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  unmount();

  vi.stubEnv('VITE_PREVIEW', 'PR #7');
  render(<App />);
  expect(document.querySelector('.previewtag').textContent).toBe('Preview build · PR #7 · not the live site');
  expect(document.head.querySelector('meta[name="robots"]').getAttribute('content')).toBe('noindex');
  vi.unstubAllEnvs();
});
