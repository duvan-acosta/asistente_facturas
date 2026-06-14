async function verifyGoogleIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Se requiere idToken de Google');
  }

  const response = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
  );

  if (!response.ok) {
    throw new Error('Token de Google inválido o expirado');
  }

  const data = await response.json();
  const verified = data.email_verified === true || data.email_verified === 'true';
  if (!verified || !data.email || !data.sub) {
    throw new Error('Email de Google no verificado');
  }

  return {
    email: String(data.email).trim().toLowerCase(),
    googleId: String(data.sub),
    name: data.name || data.email.split('@')[0],
    picture: data.picture || '',
  };
}

module.exports = { verifyGoogleIdToken };
