import { Flag, Star, Trophy } from 'lucide-react';
import { formatHundredthsToDisplayTime } from '../../../../shared/utils/time-parser';
import { uiText } from '../../../ui-text';
import type { CategoryResultData, DnfEntryRow, OpenEntryRow, RankedResultRow, RunResultRow } from '../types';
import { brigadeKey, groupLabel } from '../utils/public-participants';

const text = uiText.publicScoreboard;
type Participant = Pick<RankedResultRow, 'fireBrigadeName' | 'groupName'> & { fireBrigadeId?: string };

interface FavoriteProps {
  favorites: string[];
  onToggleFavorite: (key: string) => void;
}

function FavoriteButton({ item, favorites, onToggleFavorite }: FavoriteProps & { item: Participant }) {
  const key = brigadeKey(item);
  const saved = favorites.includes(key);
  return (
    <button
      className={`public-favorite${saved ? ' is-saved' : ''}`}
      type="button"
      aria-pressed={saved}
      aria-label={saved ? text.unsaveBrigade(item.fireBrigadeName) : text.saveBrigade(item.fireBrigadeName)}
      onClick={() => onToggleFavorite(key)}
    >
      <Star size={18} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
    </button>
  );
}

function Contribution({ run, relay = false, label, inferPenalty = false }: {
  run?: RunResultRow | null;
  relay?: boolean;
  label: string;
  inferPenalty?: boolean;
}) {
  const rawTime = relay ? run?.relayRaceHundredths : run?.attackTimeHundredths;
  const errors = (relay ? run?.relayRaceErrors : run?.attackTimeErrors) ?? 0;
  const penalty = inferPenalty && typeof rawTime === 'number' && typeof run?.scoreHundredths === 'number'
    ? Math.max(0, (run.scoreHundredths - rawTime) / 100)
    : errors;
  return (
    <div className="public-contribution">
      <span className="public-contribution-label">{label}</span>
      <span className="public-contribution-value">
        <span>{run?.runStatus === 'DNF' ? text.dnf : formatHundredthsToDisplayTime(rawTime ?? (!relay ? run?.scoreHundredths : null))}</span>
        {run?.runStatus !== 'DNF' && penalty > 0 && <span className="public-penalty">{text.penaltyPoints(penalty)}</span>}
      </span>
    </div>
  );
}

function RunDetails({ item, category }: { item: RankedResultRow; category: CategoryResultData }) {
  const relay1 = Boolean(category.hasRelayRace1 && !category.excludeRelayRace);
  const relay2 = Boolean(category.hasRelayRace2 && !category.excludeRelayRace);
  const combined = category.type === 'combined';
  const cat1 = category.categoryTypeName1 || text.defaultDiscipline1;
  const cat2 = category.categoryTypeName2 || text.defaultDiscipline2;

  if (combined) {
    return <div className="public-run-details public-run-details--combined" role="cell">
      {[{ run: item.primaryRun, label: cat1, relay: relay1, group: item.groupName },
        { run: item.secondaryRun, label: cat2, relay: relay2, group: item.secondaryGroupName }].map(({ run, label, relay, group }, index) => (
        <div className="public-discipline" key={index}>
          <h4>{label}{category.isBrigadePairing && group && <span> · {groupLabel(group)}</span>}</h4>
          <Contribution run={run} label={relay ? text.attackShort : text.attack} inferPenalty={!relay} />
          {relay && <Contribution run={run} relay label={text.relayShort} />}
        </div>
      ))}
    </div>;
  }

  return <div className="public-run-details" role="cell">
    <Contribution run={item.primaryRun} label={text.attack} inferPenalty={!relay1} />
    {relay1 && <Contribution run={item.primaryRun} relay label={text.relay} />}
  </div>;
}

export function PublicResultsList({ category, favorites, onToggleFavorite }: FavoriteProps & { category: CategoryResultData }) {
  const combined = category.type === 'combined';
  const cat1 = category.categoryTypeName1 || text.defaultDiscipline1;
  const cat2 = category.categoryTypeName2 || text.defaultDiscipline2;
  const relay1 = Boolean(category.hasRelayRace1 && !category.excludeRelayRace);
  const relay2 = Boolean(category.hasRelayRace2 && !category.excludeRelayRace);
  const disciplineHeaders = combined
    ? [relay1 ? `${cat1} ${text.attackShort}` : cat1, ...(relay1 ? [`${cat1} ${text.relayShort}`] : []),
      relay2 ? `${cat2} ${text.attackShort}` : cat2, ...(relay2 ? [`${cat2} ${text.relayShort}`] : [])]
    : [text.attack, ...(relay1 ? [text.relay] : [])];

  return (
    <div className="public-results-table" role="table" aria-label={`${category.displayName} ${text.rankingList}`}>
      <div className="public-result-columns" role="row">
        <span role="columnheader">{text.rank}</span>
        <span role="columnheader">{text.brigade} / {text.group}</span>
        <span role="columnheader">{text.total}</span>
        <span role="columnheader" className="public-sr-only">{text.myBrigade}</span>
        <span role="columnheader" className="public-sr-only">{disciplineHeaders.join(' · ')}</span>
      </div>
      <div role="rowgroup" className="public-result-rows">
        {category.rankedResults.map((item, index) => (
          <div
            role="row"
            data-rank={item.rank ?? undefined}
            key={`${item.groupId}-${item.primaryRun?.entryId || index}`}
            className={`public-result-row${item.rank === 1 ? ' is-leading' : ''}${favorites.includes(brigadeKey(item)) ? ' is-favorite' : ''}`}
          >
            <div role="cell" className={`public-rank${item.rank && item.rank <= 3 ? ` public-rank--${item.rank}` : ''}`}>
              <span>{item.rank ?? '—'}</span>
              {item.rank === 1 && <Trophy size={12} aria-hidden="true" />}
            </div>
            <div role="cell" className="public-participant">
              <span className="public-brigade-name">{item.fireBrigadeName}</span>{' '}
              {!category.isBrigadePairing && <span className="public-group-name">{groupLabel(item.groupName)}</span>}
            </div>
            <div role="cell" className="public-result-score">{formatHundredthsToDisplayTime(item.scoreHundredths)}</div>
            <div role="cell" className="public-favorite-cell"><FavoriteButton item={item} favorites={favorites} onToggleFavorite={onToggleFavorite} /></div>
            <RunDetails item={item} category={category} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PublicEntryList({ entries, favorites, onToggleFavorite, dnf = false }: FavoriteProps & {
  entries: (OpenEntryRow | DnfEntryRow)[];
  dnf?: boolean;
}) {
  return <ul className="public-entry-list">
    {entries.map((item, index) => (
      <li className="public-entry" key={item.id || item.groupId || index}>
        <span className={`public-start-position${dnf ? ' is-dnf' : ''}`}>
          {dnf ? text.dnf : 'startOrderPosition' in item && item.startOrderPosition != null ? `#${item.startOrderPosition}` : <Flag size={18} aria-label={text.startOrderUnknown} />}
        </span>
        <div className="public-participant">
          <span className="public-brigade-name">{item.fireBrigadeName}</span>{' '}
          <span className="public-group-name">{groupLabel(item.groupName)}</span>
        </div>
        <FavoriteButton item={item} favorites={favorites} onToggleFavorite={onToggleFavorite} />
      </li>
    ))}
  </ul>;
}
