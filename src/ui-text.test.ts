import { describe, expect, it } from 'vitest';
import {
  uiText,
  commonText,
  authText,
  adminLayoutText,
  adminTabsText,
  publicScoreboardText,
  tvText,
  resultsText,
  participantsText,
  setupText,
  settingsText,
  broadcastText,
  logsText,
} from './ui-text';

describe('uiText formatting', () => {
  it('formats public group names', () => {
    expect(uiText.publicScoreboard.groupName('1')).toBe('Gruppe 1');
    expect(uiText.tv.groupName('Jugend 1')).toBe('Gruppe Jugend 1');
  });

  it('formats singular and plural group counts', () => {
    expect(uiText.admin.participants.groupCount(1)).toBe('1 Gruppe');
    expect(uiText.admin.participants.groupCount(2)).toBe('2 Gruppen');
  });

  it('formats singular and plural audit result counts', () => {
    expect(uiText.admin.logs.foundCount(1)).toBe('1 Eintrag gefunden');
    expect(uiText.admin.logs.foundCount(2)).toBe('2 Einträge gefunden');
  });

  it('formats dynamic setup labels without caller-side sentence construction', () => {
    expect(uiText.admin.setup.categoryTypes.deleteConfirm('Bronze Aktiv')).toBe(
      'Möchten Sie die Bewerbskategorie "Bronze Aktiv" wirklich löschen?',
    );
    expect(uiText.admin.setup.evaluationTypes.webVisibility('Gesamtwertung')).toBe(
      'Web-Sichtbarkeit für Gesamtwertung',
    );
  });

  it('exports domain-scoped text objects matching the aggregated uiText', () => {
    expect(uiText.common).toBe(commonText);
    expect(uiText.auth).toBe(authText);
    expect(uiText.adminLayout).toBe(adminLayoutText);
    expect(uiText.adminTabs).toBe(adminTabsText);
    expect(uiText.publicScoreboard).toBe(publicScoreboardText);
    expect(uiText.tv).toBe(tvText);
    expect(uiText.admin.results).toBe(resultsText);
    expect(uiText.admin.participants).toBe(participantsText);
    expect(uiText.admin.setup).toBe(setupText);
    expect(uiText.admin.settings).toBe(settingsText);
    expect(uiText.admin.broadcast).toBe(broadcastText);
    expect(uiText.admin.logs).toBe(logsText);
  });
});
