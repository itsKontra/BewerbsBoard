import { describe, expect, it } from 'vitest';
import { uiText } from './ui-text';

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
});
