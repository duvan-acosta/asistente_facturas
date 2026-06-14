import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';

let initialized = false;

async function initGoogle(webClientId) {
  if (!Capacitor.isNativePlatform() || initialized || !webClientId) return;
  await SocialLogin.initialize({
    google: {
      webClientId,
      mode: 'online',
    },
  });
  initialized = true;
}

async function signIn() {
  const response = await SocialLogin.login({
    provider: 'google',
    options: {
      scopes: ['email', 'profile'],
    },
  });
  return response;
}

async function signOut() {
  try {
    await SocialLogin.logout({ provider: 'google' });
  } catch {
    // ignore if not signed in with native provider
  }
}

window.VencelyCapacitorAuth = {
  initGoogle,
  signIn,
  signOut,
  isNative: () => Capacitor.isNativePlatform(),
  getPlatform: () => Capacitor.getPlatform(),
};
