// The hub with accounts on (CLOUD mocked true, as cloud/crew.test.js does): the crew cards come first
// under their heading, and opening the hub in 'crew' mode — the masthead's crew button — scrolls to them
// after Sheet.jsx has scrolled the body to the top.
import {test, expect, beforeEach, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import Sheet from '../Sheet.jsx';
import {useSheet} from '../../store/sheet.js';
import {usePlanner} from '../../store/planner.js';
import {useCloud} from '../../store/cloud.js';

vi.mock('../../data/index.js', async orig => ({...await orig(), CLOUD: true, FIREBASE: {apiKey: 'test'}}));
vi.mock('../../cloud/platform.js', () => ({STANDALONE: false, IOS: false, PHONE: false}));

const USER = {uid: 'u1', displayName: 'Are', email: 'are@example.com', providerData: [{providerId: 'google.com'}], metadata: {}};
const CREW = {
  id: 'c1', name: 'The Heath Three', createdBy: 'u1', picks: {6: 'u1'},
  members: [{uid: 'u1', name: 'Are', joinedAt: 1, picks: {}, verdicts: {}, notes: {}}],
  invites: [], removed: [], syncedAt: Date.now(), live: true,
};

beforeEach(() => {
  localStorage.clear();
  useSheet.setState({stack: []});
  usePlanner.setState({picks: new Set([6]), verdicts: {}, notes: {}, shared: {}});
  useCloud.setState({user: USER, accountName: 'Are', marker: {uid: 'u1'}, crewId: 'c1', crew: CREW, syncPending: false, syncStopped: false});
  Element.prototype.scrollIntoView = vi.fn();
});

test('the crew heading and cards come before the account card, with the crew first', () => {
  useSheet.getState().open('hub');
  render(<Sheet />);

  const heading = screen.getByRole('heading', {name: 'Crew and account'});
  expect(heading.id).toBe('crew');
  const cards = [...heading.nextElementSibling.querySelectorAll('.hub-card')];
  expect(cards[0]).toHaveClass('crew');
  expect(cards[1]).toHaveClass('account');
  expect(screen.getByRole('heading', {name: 'Crew plan · 1'})).toBeInTheDocument();
  expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
});

test('opened in crew mode the hub scrolls to the crew heading, after a tick', async () => {
  useSheet.getState().open('hub', undefined, 'crew');
  render(<Sheet />);

  await vi.waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
  const target = Element.prototype.scrollIntoView.mock.instances[0];
  expect(target.id).toBe('crew');
});
