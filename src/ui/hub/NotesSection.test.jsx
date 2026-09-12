import {beforeEach, test, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import NotesSection from './NotesSection.jsx';
import {usePlanner} from '../../store/planner.js';
import {useSheet} from '../../store/sheet.js';
import {byNo} from '../../data/index.js';
import {download} from '../download.js';

vi.mock('../download.js', () => ({download: vi.fn()}));

beforeEach(() => {
  usePlanner.setState({notes: {6: 'A quantum question\n\nFinal paragraph.', 41: 'A different thought'}, picks: new Set(), verdicts: {6: 'Draw'}});
  useSheet.setState({stack: []});
  vi.clearAllMocks();
});

test('notes are complete, searchable and editable even with no picks', () => {
  render(<NotesSection />);
  expect(document.querySelectorAll('.notebook-entry')).toHaveLength(2);
  expect(document.querySelector('.note-text').textContent).toBe('A quantum question\n\nFinal paragraph.');
  fireEvent.change(screen.getByRole('searchbox', {name: 'Search my notes'}), {target: {value: 'final paragraph'}});
  expect(document.querySelectorAll('.notebook-entry')).toHaveLength(1);
  fireEvent.click(screen.getByRole('button', {name: `Edit note for ${byNo.get(6).title}`}));
  expect(useSheet.getState().stack.at(-1)).toEqual({kind: 'event', key: 6, mode: 'edit-note'});
  fireEvent.change(screen.getByRole('searchbox'), {target: {value: 'no match here'}});
  expect(screen.getByText('No notes match “no match here”.')).toBeVisible();
});

test('export includes all notes and verdicts without requiring picks', () => {
  render(<NotesSection />);
  fireEvent.click(screen.getByRole('button', {name: 'Export notes (.md)'}));
  expect(download).toHaveBeenCalledWith('htlgi-london-2026-notes.md', expect.stringContaining('A quantum question\n\nFinal paragraph.'), 'text/markdown;charset=utf-8');
  expect(download.mock.calls[0][1]).toContain('A different thought');
  expect(download.mock.calls[0][1]).toContain('Draw');
});
