// src/store/banner.js — actions are {label, primary?, onClick}; input is an optional read-only value with a Copy button
import {create} from 'zustand';
export const useBanner = create(set => ({
  banner: null,
  show(banner){ set({banner}); },
  hide(){ set({banner: null}); },
}));
export const showBanner = b => useBanner.getState().show(b);
export const hideBanner = () => useBanner.getState().hide();
export const okBanner = text => showBanner({text, actions: [{label: 'OK', onClick: hideBanner}]});
