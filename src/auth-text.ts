/**
 * Authentication and authorization user-facing text.
 * Kept modular so critical-path bundles (like initial App entry)
 * can import auth copy without pulling in the entire uiText tree.
 */
export const authText = {
  forbiddenTitle: 'Zugriff verweigert (403)',
  forbiddenBeforeRole: 'Sie verfügen nicht über die erforderliche Benutzerrolle',
  forbiddenAfterRole: ', um auf das Admin-Panel zuzugreifen.',
  switchAccount: 'Abmelden & Konto wechseln',
  backToHome: 'Zurück zur Startseite',
  invalidCredentials: 'Ungültiger Benutzername oder Passwort.',
  connectionError: 'Verbindungsfehler. Bitte versuche es erneut.',
  adminAccess: 'Admin-Zugang — Anmeldung erforderlich',
  username: 'Benutzername',
  usernamePlaceholder: 'admin',
  password: 'Passwort',
  showPassword: 'Passwort anzeigen',
  hidePassword: 'Passwort verbergen',
  signingIn: 'Anmelden…',
  signIn: 'Anmelden',
  footer: (year: number) =>
    `BewerbsBoard © ${year} — Lokale Authentifizierung`,
} as const;
