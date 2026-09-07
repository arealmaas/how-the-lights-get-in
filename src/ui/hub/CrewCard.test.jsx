// cloud/crew.js is mocked: the card's job is which controls it offers to whom, and those decisions read
// crewOwnedByMe() and liveInvites(). The batches behind the buttons are covered in cloud/crew.test.js.
import {test, expect, beforeEach, vi} from 'vitest';
import {render, screen, fireEvent, act} from '@testing-library/react';
import CrewCard from './CrewCard.jsx';
import {useCloud} from '../../store/cloud.js';

const H = vi.hoisted(() => ({owner: {value: false}, invites: {value: []}}));
vi.mock('../../cloud/crew.js', () => ({
  crewOwnedByMe: () => H.owner.value,
  liveInvites: () => H.invites.value,
  inviteLink: token => 'https://example.test/#join=c1.' + token,
  createCrew: vi.fn(), renameCrew: vi.fn(), leaveCrew: vi.fn(), closeCrew: vi.fn(),
  removeMember: vi.fn(), readmit: vi.fn(), makeOwner: vi.fn(), createInvite: vi.fn(), revokeInvite: vi.fn(),
}));

const crewApi = await import('../../cloud/crew.js');

const USER = {uid: 'u1', displayName: 'Are', email: 'are@example.com'};
const member = (uid, name, picks = {}) => ({uid, name, joinedAt: 1, picks, verdicts: {}, notes: {}});
const CREW = {
  id: 'c1', name: 'The Heath Three', createdBy: 'u1',
  members: [member('u1', 'Are Almaas', {3: true, 6: true}), member('u2', 'Kari Nordmann', {3: true})],
  invites: [], removed: [], syncedAt: Date.parse('2026-09-19T13:45:00Z'), live: true,
};
const labels = () => [...document.querySelectorAll('.hub-card.crew button')].map(b => b.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  H.owner.value = false;
  H.invites.value = [];
  useCloud.setState({user: USER, accountName: 'Are', marker: null, crewId: 'c1', crew: CREW});
});

test('no crew: Create a crew, the invite-link line, and an inline name form instead of a prompt', () => {
  useCloud.setState({crewId: null, crew: null});
  render(<CrewCard />);

  expect(screen.getByText(/Have an invite link\? Open it\./)).toBeInTheDocument();
  expect(document.querySelector('form.authform')).toBeNull();

  fireEvent.click(screen.getByRole('button', {name: 'Create a crew'}));
  const form = document.querySelector('form.authform');
  expect(form).not.toBeNull();
  fireEvent.change(form.querySelector('input'), {target: {value: 'The Heath Three'}});
  fireEvent.submit(form);

  expect(crewApi.createCrew).toHaveBeenCalledWith('The Heath Three');
  expect(document.querySelector('form.authform')).toBeNull();
});

test('signed out the card is not built at all', () => {
  useCloud.setState({user: null, crewId: null, crew: null});
  render(<CrewCard />);
  expect(document.querySelector('.hub-card.crew')).toBeNull();
});

test('in a crew: the name, the sync state, members with colours, pick counts, "(you)" and "· owner"', () => {
  render(<CrewCard />);

  expect(document.querySelector('.cname-h').textContent).toBe('The Heath Three');
  expect(document.querySelector('.hc-k').textContent).toBe('Crew · live');
  const rows = [...document.querySelectorAll('.members li')];
  expect(rows).toHaveLength(2);
  expect(rows[0].querySelector('.cname').textContent).toBe('Are Almaas (you) · owner');
  expect(rows[0].querySelector('.cpicks').textContent).toBe('2 picks');
  expect(rows[0].querySelector('.cdot').textContent).toBe('AA');
  expect(rows[0].querySelector('.cdot').style.getPropertyValue('--c')).toBe('var(--debates)');
  expect(rows[1].querySelector('.cdot').style.getPropertyValue('--c')).toBe('var(--talks)');
  expect(rows[1].querySelector('.cname').textContent).toBe('Kari Nordmann');
});

// CREW-SPEC section 7: "each member's pick count and last sync time". The member documents carry an
// updatedAt; a member whose document has not been written since joining has none, and says nothing.
test('a member with an updatedAt shows when they last synced, beside their pick count', () => {
  const at = Date.parse('2026-09-19T13:45:00Z');
  useCloud.setState({crew: {...CREW, members: [{...member('u1', 'Are Almaas', {3: true, 6: true}), updatedAt: at}, member('u2', 'Kari Nordmann', {3: true})]}});
  render(<CrewCard />);

  const rows = [...document.querySelectorAll('.members li')];
  expect(rows[0].querySelector('.cpicks').textContent).toBe('2 picks · synced ' + new Date(at).toLocaleTimeString('en-GB', {hour: '2-digit', minute: '2-digit'}));
  expect(rows[0].querySelector('.cpicks').textContent).toMatch(/ · synced \d\d:\d\d$/);
  expect(rows[1].querySelector('.cpicks').textContent).toBe('1 picks');
});

test('a crew that has not synced since the SDK failed says when it last did', () => {
  useCloud.setState({crew: {...CREW, live: false}});
  const {rerender} = render(<CrewCard />);
  expect(document.querySelector('.hc-k').textContent).toMatch(/^Crew · last synced \d\d:\d\d$/);

  act(() => useCloud.setState({crew: {...CREW, syncedAt: null}}));
  rerender(<CrewCard />);
  expect(document.querySelector('.hc-k').textContent).toBe('Crew · not synced yet');
});

test('the creator gets Remove and Make owner per other member, and Close crew', () => {
  H.owner.value = true;
  render(<CrewCard />);

  expect(labels()).toEqual(['Make owner', 'Remove', 'Invite link', 'Rename', 'Leave crew', 'Close crew']);
  const rows = [...document.querySelectorAll('.members li')];
  expect(rows[0].querySelectorAll('button')).toHaveLength(0);   // never on yourself

  fireEvent.click(screen.getByRole('button', {name: 'Remove'}));
  expect(crewApi.removeMember).toHaveBeenCalledWith('u2');
  fireEvent.click(screen.getByRole('button', {name: 'Make owner'}));
  expect(crewApi.makeOwner).toHaveBeenCalledWith('u2');
  fireEvent.click(screen.getByRole('button', {name: 'Close crew'}));
  expect(crewApi.closeCrew).toHaveBeenCalledWith(false);
});

test('a member gets none of the creator’s powers', () => {
  H.owner.value = false;
  render(<CrewCard />);

  expect(labels()).toEqual(['Invite link', 'Rename', 'Leave crew']);
  expect(screen.queryByRole('button', {name: 'Remove'})).toBeNull();
  expect(screen.queryByRole('button', {name: 'Make owner'})).toBeNull();
  expect(screen.queryByRole('button', {name: 'Close crew'})).toBeNull();
});

test('a live invite renders Copy and Revoke, and Copy says Copied for two seconds', async () => {
  vi.useFakeTimers();
  const writeText = vi.fn(async () => {});
  vi.stubGlobal('navigator', {...navigator, clipboard: {writeText}});
  H.invites.value = [{token: 'a'.repeat(22), createdByName: 'Are', expiresAt: {toMillis: () => Date.parse('2026-10-03T12:00:00Z')}}];
  render(<CrewCard />);

  expect(document.querySelector('.members.invites .cname').textContent).toBe('Invite by Are · until 3 Oct');
  const copy = screen.getByRole('button', {name: 'Copy'});
  await act(async () => { fireEvent.click(copy); });
  expect(copy.textContent).toBe('Copied');
  expect(writeText).toHaveBeenCalledWith('https://example.test/#join=c1.' + 'a'.repeat(22));

  fireEvent.click(screen.getByRole('button', {name: 'Revoke'}));
  expect(crewApi.revokeInvite).toHaveBeenCalledWith('a'.repeat(22));

  await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
  expect(copy.textContent).toBe('Copy');
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

test('the Removed list with Re-admit is the creator’s alone', () => {
  useCloud.setState({crew: {...CREW, removed: [{uid: 'u3', name: 'Morten'}]}});
  render(<CrewCard />);
  expect(screen.queryByRole('button', {name: 're-admit'})).toBeNull();

  H.owner.value = true;
  render(<CrewCard />);
  expect(document.querySelectorAll('p.src')[0].textContent).toBe('Removed: Morten re-admit');
  fireEvent.click(screen.getAllByRole('button', {name: 're-admit'})[0]);
  expect(crewApi.readmit).toHaveBeenCalledWith('u3');
});

test('Rename opens the inline form filled with the current name; Cancel writes nothing', () => {
  render(<CrewCard />);

  fireEvent.click(screen.getByRole('button', {name: 'Rename'}));
  const form = document.querySelector('form.authform');
  expect(form.querySelector('input').value).toBe('The Heath Three');
  fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
  expect(crewApi.renameCrew).not.toHaveBeenCalled();
  expect(document.querySelector('form.authform')).toBeNull();

  fireEvent.click(screen.getByRole('button', {name: 'Rename'}));
  fireEvent.change(document.querySelector('form.authform input'), {target: {value: 'The Heath Four'}});
  fireEvent.submit(document.querySelector('form.authform'));
  expect(crewApi.renameCrew).toHaveBeenCalledWith('The Heath Four');
});

test('Invite link and Leave crew reach the crew module', () => {
  render(<CrewCard />);
  fireEvent.click(screen.getByRole('button', {name: 'Invite link'}));
  expect(crewApi.createInvite).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: 'Leave crew'}));
  expect(crewApi.leaveCrew).toHaveBeenCalledWith(false);
});

// CREW-SPEC section 6, "Failure modes": on a cold or offline start hydrateCrewCache() has painted the
// crew but the SDK has not loaded, so there is no `user` yet. The card shows the cached crew and its last
// sync time, and offers the same actions — each one in cloud/crew.js checks the SDK and the session and
// says "Still connecting; try again in a moment." rather than writing (cloud/crew.test.js covers that).
// The owner-only controls stay away, because crewOwnedByMe() cannot be true without a session.
test('a cached crew with only the account marker renders, with actions that answer for themselves', () => {
  useCloud.setState({user: null, marker: {uid: 'u1'}, crew: {...CREW, live: false}});
  render(<CrewCard />);

  expect(screen.getByText('The Heath Three')).toBeInTheDocument();
  expect(document.querySelector('.hub-card.crew .hc-k').textContent).toMatch(/^Crew · last synced /);
  expect(screen.getByText(/Are Almaas \(you\)/)).toBeInTheDocument();   // the marker is my identity
  expect(labels()).toEqual(['Invite link', 'Rename', 'Leave crew']);
  fireEvent.click(screen.getByRole('button', {name: 'Leave crew'}));
  expect(crewApi.leaveCrew).toHaveBeenCalledWith(false);
});

test('with no crew cached and no session yet, the card is not built at all', () => {
  useCloud.setState({user: null, marker: {uid: 'u1'}, crewId: null, crew: null});
  render(<CrewCard />);
  expect(document.querySelector('.hub-card.crew')).toBeNull();
});
