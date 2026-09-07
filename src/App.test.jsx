import {test, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import App from './App.jsx';

test('renders the masthead', () => {
  render(<App />);
  expect(screen.getByRole('heading', {level: 1})).toHaveTextContent('HowTheLightGetsIn');
});
