import { useState, useCallback, useRef, useMemo, createContext, useContext } from 'react';
import type { CrosshairType } from './useCrosshair';

export interface MissionStats {
  totalKills:          number;
  totalGamesPlayed:    number;
  bestSurvivalSeconds: number;
  totalHeadshots:      number; // cumulative, across all runs
  bestHeadshots:       number; // most headshots landed in a single run
}

type MissionStatKey = keyof MissionStats;

// Every mission grants one of these on completion — see BADGES below.
export type BadgeEmblemType =
  | 'droplet'
  | 'bars'
  | 'chevrons'
  | 'shield'
  | 'cycle'
  | 'skull-reticle'
  | 'target-dart'
  | 'skull-crown';

export interface Mission {
  id:              string;
  label:           string;
  description:     string;
  stat:            MissionStatKey;
  target:          number;
  // Cosmetic unlock granted when the mission is CLAIMED — null for
  // milestones with no crosshair reward. Independent of the badge below:
  // every mission (including these) still grants a badge on completion.
  rewardCrosshair: CrosshairType | null;
  badgeEmblem:     BadgeEmblemType;
}

// Achievable with data already tracked today. EnemySpawner.onEnemyKilled
// reports head vs body hits (isHeadshot), which now feeds totalHeadshots/
// bestHeadshots via GameCanvas.handleEnemyKilled → incrementHeadshots /
// recordGameEnd.
export const MISSIONS: Mission[] = [
  { id: 'first_blood',  label: 'First Blood',  description: 'Get your first kill.',                stat: 'totalKills',          target: 1,    rewardCrosshair: null,       badgeEmblem: 'droplet' },
  { id: 'marksman',     label: 'Marksman',     description: 'Rack up 100 total kills.',             stat: 'totalKills',          target: 100,  rewardCrosshair: 'dot',      badgeEmblem: 'bars' },
  { id: 'veteran',      label: 'Veteran',      description: 'Rack up 1000 total kills.',            stat: 'totalKills',          target: 1000, rewardCrosshair: 'circle',   badgeEmblem: 'chevrons' },
  { id: 'survivor',     label: 'Survivor',     description: 'Survive 60 seconds in a single run.',  stat: 'bestSurvivalSeconds', target: 60,   rewardCrosshair: 'classic',  badgeEmblem: 'shield' },
  { id: 'persistent',   label: 'Persistent',   description: 'Play 25 games.',                       stat: 'totalGamesPlayed',    target: 25,   rewardCrosshair: null,       badgeEmblem: 'cycle' },
  { id: 'sharpshooter', label: 'Sharpshooter', description: 'Land 50 total headshots.',             stat: 'totalHeadshots',      target: 50,   rewardCrosshair: null,       badgeEmblem: 'skull-reticle' },
  { id: 'precision',    label: 'Precision',    description: 'Land 10 headshots in a single run.',   stat: 'bestHeadshots',       target: 10,   rewardCrosshair: null,       badgeEmblem: 'target-dart' },
  { id: 'headhunter',   label: 'Headhunter',   description: 'Land 500 total headshots.',            stat: 'totalHeadshots',      target: 500,  rewardCrosshair: null,       badgeEmblem: 'skull-crown' },
];

export interface Badge {
  id:     string; // same id as the mission that grants it
  name:   string;
  emblem: BadgeEmblemType;
}

// One badge per mission, in mission order — the badge shelf renders this
// list directly so earned/unearned always matches the mission list 1:1.
export const BADGES: Badge[] = MISSIONS.map(m => ({ id: m.id, name: m.label, emblem: m.badgeEmblem }));

export function getMissionProgress(mission: Mission, stats: MissionStats): number {
  return Math.min(1, stats[mission.stat] / mission.target);
}

export function isMissionComplete(mission: Mission, stats: MissionStats): boolean {
  return stats[mission.stat] >= mission.target;
}

const DEFAULT_STATS: MissionStats = {
  totalKills:          0,
  totalGamesPlayed:    0,
  bestSurvivalSeconds: 0,
  totalHeadshots:      0,
  bestHeadshots:       0,
};

const KEYS = {
  stats:   'holdout_missions_stats',
  claimed: 'holdout_missions_claimed',
  badges:  'holdout_badges',
} as const;

function readStats(): MissionStats {
  try {
    const raw = localStorage.getItem(KEYS.stats);
    if (!raw) return { ...DEFAULT_STATS };
    const parsed = JSON.parse(raw);
    return {
      totalKills:          Math.max(0, Number(parsed.totalKills) || 0),
      totalGamesPlayed:    Math.max(0, Number(parsed.totalGamesPlayed) || 0),
      bestSurvivalSeconds: Math.max(0, Number(parsed.bestSurvivalSeconds) || 0),
      totalHeadshots:      Math.max(0, Number(parsed.totalHeadshots) || 0),
      bestHeadshots:       Math.max(0, Number(parsed.bestHeadshots) || 0),
    };
  } catch {
    return { ...DEFAULT_STATS };
  }
}

function writeStats(stats: MissionStats): void {
  try { localStorage.setItem(KEYS.stats, JSON.stringify(stats)); } catch {}
}

function readClaimed(): Set<string> {
  try {
    const raw = localStorage.getItem(KEYS.claimed);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function readBadges(): Set<string> {
  try {
    const raw = localStorage.getItem(KEYS.badges);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeBadges(badges: Set<string>): void {
  try { localStorage.setItem(KEYS.badges, JSON.stringify(Array.from(badges))); } catch {}
}

function writeClaimed(claimed: Set<string>): void {
  try { localStorage.setItem(KEYS.claimed, JSON.stringify(Array.from(claimed))); } catch {}
}

export interface MissionsState {
  stats:                MissionStats;
  claimedIds:            Set<string>;
  earnedBadgeIds:        Set<string>;
  unlockedCrosshairs:    Set<CrosshairType>;
  isCrosshairUnlocked:  (type: CrosshairType) => boolean;
  claimMission:          (id: string) => void;
  // Gameplay-side updaters (called from GameCanvas)
  incrementKills:        (n?: number) => void;
  incrementHeadshots:    (n?: number) => void;
  recordGameEnd:         (survivalSeconds: number, headshotsThisRun?: number) => void;
  // Called by the Missions screen on mount to pull the latest ref-backed
  // value into React state — see incrementKills below for why it's needed.
  refreshStats:          () => void;
}

const DEFAULT_UNLOCKED = new Set<CrosshairType>(['tactical']);

// Context — consumed anywhere in the tree via useMissions()
export const MissionsContext = createContext<MissionsState>({
  stats:               DEFAULT_STATS,
  claimedIds:           new Set(),
  earnedBadgeIds:       new Set(),
  unlockedCrosshairs:   DEFAULT_UNLOCKED,
  isCrosshairUnlocked: type => type === 'tactical',
  claimMission:         () => {},
  incrementKills:       () => {},
  incrementHeadshots:   () => {},
  recordGameEnd:        () => {},
  refreshStats:         () => {},
});

export function useMissions(): MissionsState {
  return useContext(MissionsContext);
}

// The actual hook — call this ONCE at the app root and pass into MissionsContext.Provider
export function useMissionsProvider(): MissionsState {
  const [stats, setStats] = useState<MissionStats>(() => readStats());
  const [claimedIds, setClaimedIds] = useState<Set<string>>(() => readClaimed());
  const [earnedBadgeIds, setEarnedBadgeIds] = useState<Set<string>>(() => readBadges());

  const statsRef = useRef(stats);
  statsRef.current = stats;

  const badgesRef = useRef(earnedBadgeIds);
  badgesRef.current = earnedBadgeIds;

  // Scans MISSIONS against a fresh stats snapshot and marks any newly-
  // completed mission's badge as earned. Badges are awarded on COMPLETION,
  // not on claim (claiming is only what unlocks a crosshair reward) — so
  // this runs from incrementKills/incrementHeadshots/recordGameEnd, every
  // one of which already has a fresh `next` stats object in hand. Mutates
  // badgesRef and persists immediately; like stats, the React state write
  // is deferred to refreshStats()/recordGameEnd to avoid a re-render on
  // every single kill.
  const checkBadges = useCallback((s: MissionStats) => {
    const current = badgesRef.current;
    let next: Set<string> | null = null;
    for (const mission of MISSIONS) {
      if (!current.has(mission.id) && isMissionComplete(mission, s)) {
        if (!next) next = new Set(current);
        next.add(mission.id);
      }
    }
    if (next) {
      badgesRef.current = next;
      writeBadges(next);
    }
  }, []);

  // Called very frequently (once per kill, mid-gameplay). Mutates the ref
  // and persists immediately, but deliberately skips the React state write
  // — a kill streak forcing a re-render through every consumer on every
  // single kill isn't worth it. refreshStats() (called by the Missions
  // screen on mount) and recordGameEnd (below) are what sync it into state.
  const incrementKills = useCallback((n = 1) => {
    const next = { ...statsRef.current, totalKills: statsRef.current.totalKills + n };
    statsRef.current = next;
    writeStats(next);
    checkBadges(next);
  }, [checkBadges]);

  // Same ref-only pattern as incrementKills, called once per headshot kill.
  const incrementHeadshots = useCallback((n = 1) => {
    const next = { ...statsRef.current, totalHeadshots: statsRef.current.totalHeadshots + n };
    statsRef.current = next;
    writeStats(next);
    checkBadges(next);
  }, [checkBadges]);

  // Called once per run, at game over — infrequent enough that a normal
  // state update is fine. headshotsThisRun comes from a per-run ref in
  // GameCanvas (it remounts fresh every run, so the ref always starts at 0).
  const recordGameEnd = useCallback((survivalSeconds: number, headshotsThisRun = 0) => {
    const next: MissionStats = {
      ...statsRef.current,
      totalGamesPlayed:    statsRef.current.totalGamesPlayed + 1,
      bestSurvivalSeconds: Math.max(statsRef.current.bestSurvivalSeconds, survivalSeconds),
      bestHeadshots:       Math.max(statsRef.current.bestHeadshots, headshotsThisRun),
    };
    statsRef.current = next;
    writeStats(next);
    checkBadges(next);
    setStats(next);
    setEarnedBadgeIds(new Set(badgesRef.current));
  }, [checkBadges]);

  const refreshStats = useCallback(() => {
    setStats({ ...statsRef.current });
    setEarnedBadgeIds(new Set(badgesRef.current));
  }, []);

  const claimMission = useCallback((id: string) => {
    setClaimedIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      writeClaimed(next);
      return next;
    });
  }, []);

  const unlockedCrosshairs = useMemo(() => {
    const set = new Set<CrosshairType>(['tactical']);
    for (const mission of MISSIONS) {
      if (mission.rewardCrosshair && claimedIds.has(mission.id)) set.add(mission.rewardCrosshair);
    }
    return set;
  }, [claimedIds]);

  const isCrosshairUnlocked = useCallback(
    (type: CrosshairType) => unlockedCrosshairs.has(type),
    [unlockedCrosshairs],
  );

  return {
    stats,
    claimedIds,
    earnedBadgeIds,
    unlockedCrosshairs,
    isCrosshairUnlocked,
    claimMission,
    incrementKills,
    incrementHeadshots,
    recordGameEnd,
    refreshStats,
  };
}
