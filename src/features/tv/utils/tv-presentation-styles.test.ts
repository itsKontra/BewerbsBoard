import { describe, it, expect } from 'vitest';
import { TV_PRESENTATION_STYLES } from './tv-presentation-styles';
import { TV_THEMES } from '../../../../shared/domain/tv-presentation';

describe('TV_PRESENTATION_STYLES', () => {
  it('defines style objects for all supported TvThemes', () => {
    TV_THEMES.forEach((theme) => {
      expect(TV_PRESENTATION_STYLES[theme]).toBeDefined();
      expect(TV_PRESENTATION_STYLES[theme].label).toBeTypeOf('string');
    });
  });

  describe('row(rank) accessor method', () => {
    it('returns rank 1 container and number styles', () => {
      const broadcast = TV_PRESENTATION_STYLES.broadcast;
      const rank1 = broadcast.row(1);
      expect(rank1.container).toContain('tv-leading-bar-1');
      expect(rank1.rankNumber).toContain('text-amber-300');
    });

    it('returns rank 2 container and number styles', () => {
      const broadcast = TV_PRESENTATION_STYLES.broadcast;
      const rank2 = broadcast.row(2);
      expect(rank2.container).toContain('tv-leading-bar-2');
      expect(rank2.rankNumber).toContain('text-slate-300');
    });

    it('returns rank 3 container and number styles', () => {
      const broadcast = TV_PRESENTATION_STYLES.broadcast;
      const rank3 = broadcast.row(3);
      expect(rank3.container).toContain('tv-leading-bar-3');
      expect(rank3.rankNumber).toContain('text-amber-600');
    });

    it('returns unranked / other base row container and rank number styles for rank null or > 3', () => {
      const broadcast = TV_PRESENTATION_STYLES.broadcast;
      const rankOther = broadcast.row(4);
      expect(rankOther.container).toContain('border-l-4 border-l-transparent');
      expect(rankOther.container).toContain(broadcast.rowBase);
      expect(rankOther.rankNumber).toBe(broadcast.rankOtherNumber);

      const rankNull = broadcast.row(null);
      expect(rankNull.container).toContain('border-l-4 border-l-transparent');
      expect(rankNull.rankNumber).toBe(broadcast.rankOtherNumber);
    });
  });

  describe('podium(place) accessor method', () => {
    it('returns place 1, 2, 3 podium styles with height, tone, name, group, and time classes', () => {
      const ceremony = TV_PRESENTATION_STYLES.ceremony;
      const place1 = ceremony.podium(1);
      expect(place1.height).toBe('h-[32vh]');
      expect(place1.name).toBe(ceremony.podiumName);
      expect(place1.group).toBe(ceremony.podiumGroup);
      expect(place1.time).toBe(ceremony.podiumTime);

      const place2 = ceremony.podium(2);
      expect(place2.height).toBe('h-[25vh]');

      const place3 = ceremony.podium(3);
      expect(place3.height).toBe('h-[18vh]');
    });
  });
});
