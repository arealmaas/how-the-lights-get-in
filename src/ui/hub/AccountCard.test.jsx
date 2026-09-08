import {test, expect, beforeEach, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import AccountCard from './AccountCard.jsx';
import {useCloud} from '../../store/cloud.js';
import {useSheet} from '../../store/sheet.js';

// platform.js is a mutable mock: the button order and the sign-in method depend on it, and both the
// desktop and the installed-iOS arrangement need covering in one file.
const H = vi.hoisted(() => ({platform: {STANDALONE: false, IOS: false, PHONE: false}, emailAction: vi.fn(async () => ({text: ''}))}));
vi.mock('../../cloud/platform.js', () => H.platform);
vi.mock('../../cloud/auth.js', () => ({
  emailAction: H.emailAction, signInGoogle: vi.fn(), changeName: vi.fn(), signOutUser: vi.fn(), deleteAccount: vi.fn(),
}));

const USER = {uid: 'u1', displayName: 'Are', email: 'are@example.com', providerData: [{providerId: 'google.com'}]};
const signedIn = extra => useCloud.setState({user: USER, accountName: 'Are', marker: {uid: 'u1'}, syncPending: false, syncStopped: false, ...extra});
const names = () => [...document.querySelector('.hub-card.account .actions').querySelectorAll('button')].map(b => b.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  H.emailAction.mockResolvedValue({text: ''});
  Object.assign(H.platform, {STANDALONE: false, IOS: false, PHONE: false});
  useCloud.setState({user: null, accountName: '', marker: null, syncPending: false, syncStopped: false, crewId: null});
  useSheet.setState({stack: []});
});

test('signed out: both ways in, Google first, and the email form hidden until it is asked for', () => {
  render(<AccountCard />);
  expect(names()).toEqual(['Continue with Google', 'Use email and password']);

  // hidden, so it is out of the accessibility tree: read it from the DOM rather than by role
  const form = document.querySelector('form.authform');
  expect(form.hidden).toBe(true);
  // one way in: email and password. The name is asked for only once signing in has failed, because until
  // then there is nothing to say it is needed (see the registration test below).
  expect([...form.querySelectorAll('input')].map(i => i.name)).toEqual(['email', 'password']);
  expect([...form.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Sign in', 'Forgot password?']);

  fireEvent.click(screen.getByRole('button', {name: 'Use email and password'}));
  expect(document.querySelector('form.authform').hidden).toBe(false);
});

test('in the installed iOS app the email button comes first, with a line saying why', () => {
  Object.assign(H.platform, {STANDALONE: true, IOS: true, PHONE: true});
  render(<AccountCard />);
  expect(names()).toEqual(['Use email and password', 'Continue with Google']);
  expect(screen.getByText(/email and password is the reliable way in/)).toBeInTheDocument();
});

test('submitting the form (Enter, or the Sign in button) signs in and shows what came back', async () => {
  H.emailAction.mockResolvedValue({text: 'Wrong email or password.'});
  render(<AccountCard />);
  fireEvent.click(screen.getByRole('button', {name: 'Use email and password'}));
  fireEvent.change(document.querySelector('input[name=email]'), {target: {value: 'are@example.com'}});
  fireEvent.change(document.querySelector('input[name=password]'), {target: {value: 'long enough'}});

  fireEvent.submit(document.querySelector('form.authform'));

  expect(H.emailAction).toHaveBeenCalledWith('signin', {email: 'are@example.com', password: 'long enough', name: ''});
  expect(await screen.findByText(/Wrong email or password/)).toBeInTheDocument();
  expect(document.querySelector('input[name=name]')).toBeNull();   // a plain failure is not an invitation to register
});

test('“Forgot password?” runs its own action without submitting', async () => {
  H.emailAction.mockResolvedValue({text: 'Password reset email sent. Check your inbox.'});
  render(<AccountCard />);
  fireEvent.click(screen.getByRole('button', {name: 'Use email and password'}));
  fireEvent.change(document.querySelector('input[name=email]'), {target: {value: 'are@example.com'}});
  fireEvent.click(screen.getByRole('button', {name: 'Forgot password?'}));
  expect(H.emailAction).toHaveBeenCalledWith('reset', {email: 'are@example.com', password: '', name: ''});
  expect(await screen.findByText(/reset email sent/)).toBeInTheDocument();
});

// The registration step: sign-in came back "might be new", so the name is asked for and the primary
// button becomes Create account.
test('a sign-in that might mean "new here" turns the form into registration', async () => {
  H.emailAction.mockResolvedValue({text: 'Wrong email or password. If you are new here, add your name and we will create your account.', newHere: true});
  render(<AccountCard />);
  fireEvent.click(screen.getByRole('button', {name: 'Use email and password'}));
  fireEvent.change(document.querySelector('input[name=email]'), {target: {value: 'are@example.com'}});
  fireEvent.change(document.querySelector('input[name=password]'), {target: {value: 'long enough'}});
  fireEvent.submit(document.querySelector('form.authform'));

  expect(await screen.findByText(/new here/)).toBeInTheDocument();
  expect(document.querySelector('input[name=name]')).not.toBeNull();
  const form = document.querySelector('form.authform');
  expect([...form.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Create account', 'Forgot password?']);

  H.emailAction.mockResolvedValue({text: ''});
  fireEvent.change(document.querySelector('input[name=name]'), {target: {value: 'Are'}});
  fireEvent.submit(form);
  expect(H.emailAction).toHaveBeenLastCalledWith('create', {email: 'are@example.com', password: 'long enough', name: 'Are'});
});

// Correcting the password is the other reading of that same failure, and it must not create an account.
test('editing the password puts the registration step away again', async () => {
  H.emailAction.mockResolvedValue({text: 'Wrong email or password. If you are new here, add your name and we will create your account.', newHere: true});
  render(<AccountCard />);
  fireEvent.click(screen.getByRole('button', {name: 'Use email and password'}));
  fireEvent.change(document.querySelector('input[name=email]'), {target: {value: 'are@example.com'}});
  fireEvent.change(document.querySelector('input[name=password]'), {target: {value: 'wrong one'}});
  fireEvent.submit(document.querySelector('form.authform'));
  expect(await screen.findByText(/new here/)).toBeInTheDocument();

  fireEvent.change(document.querySelector('input[name=password]'), {target: {value: 'the right one'}});
  expect(document.querySelector('input[name=name]')).toBeNull();
  const form = document.querySelector('form.authform');
  expect([...form.querySelectorAll('button')].map(b => b.textContent)).toEqual(['Sign in', 'Forgot password?']);

  H.emailAction.mockResolvedValue({text: ''});
  fireEvent.submit(form);
  expect(H.emailAction).toHaveBeenLastCalledWith('signin', {email: 'are@example.com', password: 'the right one', name: ''});
});

// The email is taken after all: back to signing in, with the reason.
test('an email that is already taken sends the form back to signing in', async () => {
  H.emailAction.mockResolvedValue({text: 'Wrong email or password. If you are new here, add your name and we will create your account.', newHere: true});
  render(<AccountCard />);
  fireEvent.click(screen.getByRole('button', {name: 'Use email and password'}));
  fireEvent.change(document.querySelector('input[name=email]'), {target: {value: 'are@example.com'}});
  fireEvent.change(document.querySelector('input[name=password]'), {target: {value: 'long enough'}});
  fireEvent.submit(document.querySelector('form.authform'));
  expect(await screen.findByText(/new here/)).toBeInTheDocument();

  H.emailAction.mockResolvedValue({text: 'That email already has an account. Check your password, or sign in with Google if that is how you made it.', newHere: false});
  fireEvent.change(document.querySelector('input[name=name]'), {target: {value: 'Are'}});
  fireEvent.submit(document.querySelector('form.authform'));

  expect(await screen.findByText(/already has an account/)).toBeInTheDocument();
  expect(document.querySelector('input[name=name]')).toBeNull();
});

test('signed in: the name, the email and the settled sync sentence, with every account action', () => {
  signedIn();
  render(<AccountCard />);
  const card = document.querySelector('.hub-card.account');
  expect(card.textContent).toContain('Signed in as Are · are@example.com');
  expect(card.textContent).toContain('Your picks, verdicts and notes follow this account.');
  expect(names()).toEqual(['Change name', 'Add a password', 'Sign out', 'Sign out and clear this device', 'Delete account']);

  fireEvent.click(screen.getByRole('button', {name: 'Add a password'}));
  expect(document.querySelector('form.authform').hidden).toBe(false);
  expect(screen.getByRole('button', {name: 'Save password'})).toBeInTheDocument();
});

// The old page used window.prompt() here, which blocks the page and cannot be driven by a test. Change
// name opens the same inline form the Crew card uses (src/ui/NamePrompt.jsx), pre-filled with the name.
test('Change name opens the inline form filled with the current name; Cancel writes nothing', async () => {
  const {changeName} = await import('../../cloud/auth.js');
  signedIn();
  render(<AccountCard />);
  expect(document.querySelector('form.nameform')).toBeNull();

  fireEvent.click(screen.getByRole('button', {name: 'Change name'}));
  const form = document.querySelector('form.nameform');
  expect(form.querySelector('input').value).toBe('Are');
  expect(form.querySelector('input').maxLength).toBe(40);

  fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
  expect(changeName).not.toHaveBeenCalled();
  expect(document.querySelector('form.nameform')).toBeNull();

  fireEvent.click(screen.getByRole('button', {name: 'Change name'}));
  fireEvent.change(document.querySelector('form.nameform input'), {target: {value: 'Are Almaas'}});
  fireEvent.submit(document.querySelector('form.nameform'));

  expect(changeName).toHaveBeenCalledWith('Are Almaas');
  expect(document.querySelector('form.nameform')).toBeNull();
});

test('an account that already has a password is not offered another one', () => {
  signedIn({user: {...USER, providerData: [{providerId: 'password'}]}});
  render(<AccountCard />);
  expect(names()).not.toContain('Add a password');
});

test('the sync sentence follows the flags: not synced yet, or stopped', () => {
  signedIn({syncPending: true});
  const {rerender} = render(<AccountCard />);
  expect(document.querySelector('.hub-card.account').textContent).toContain('Signed in, not synced yet');

  signedIn({syncPending: false, marker: null});
  rerender(<AccountCard />);
  expect(document.querySelector('.hub-card.account').textContent).toContain('Signed in, not synced yet');

  signedIn({syncStopped: true});
  rerender(<AccountCard />);
  expect(document.querySelector('.hub-card.account').textContent).toContain('Sync stopped: this account was deleted on another device');
});

test('the privacy link closes the sheet and takes you to the privacy paragraph', () => {
  const scroll = vi.fn();
  document.body.insertAdjacentHTML('beforeend', '<div id="privacy"></div>');
  document.getElementById('privacy').scrollIntoView = scroll;
  useSheet.setState({stack: [{kind: 'hub', key: undefined}]});
  render(<AccountCard />);

  fireEvent.click(screen.getByRole('button', {name: 'privacy'}));

  expect(useSheet.getState().stack).toEqual([]);
  expect(scroll).toHaveBeenCalled();
  document.getElementById('privacy').remove();
});
