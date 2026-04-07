// ─────────────────────────────────────────────────────────────
// Persistent entities (survive across auctions)
// ─────────────────────────────────────────────────────────────
export interface Team {
  id?: number;
  name: string;
  isActive: boolean;
}

export interface Player {
  id?: number;
  name: string;
  cricherosUsername?: string;
  cricherosId?: string;
  isCaptain: boolean;
  teamId?: number;
  isActive: boolean;
}

// ─────────────────────────────────────────────────────────────
// Main Auction
// ─────────────────────────────────────────────────────────────
export interface AuctionTeamEntry {
  teamId: number;
  teamName: string;
  captainId: number;
  captainName: string;
  memberIds: number[];
}

export interface ActiveAuction {
  id?: number;
  createdAt: string;
  status: 'active' | 'completed';
  coreMembersCount: number;
  teams: AuctionTeamEntry[];
  teamOrder: number[];
  currentTeamIndex: number;
  availablePlayers: number[];
  unsoldPlayers: number[];
  completedTeamIds: number[];
  currentPlayerId: number | null;
  phase: 'shuffling' | 'active' | 'unsold_phase' | 'completed';
  playerSnapshot: { [id: number]: Player };
}

export interface AuctionHistoryRecord {
  id?: number;
  createdAt: string;
  completedAt: string;
  coreMembersCount: number;
  teamSummaries: Array<{
    teamId: number;
    teamName: string;
    captainId: number;
    captainName: string;
    memberIds: number[];      // player IDs picked (excl captain)
    memberNames: string[];
    isFull: boolean;
  }>;
  unsoldPlayerNames: string[];
  totalPlayers: number;
  /** Snapshot of all player data at time of completion */
  playerSnapshot: { [id: number]: Player };
}

// ─────────────────────────────────────────────────────────────
// Weekly Auction
// ─────────────────────────────────────────────────────────────

/** A player in the weekly pool — real or temporary replacement */
export interface WeeklyPlayer {
  id: string;                  // 'p_123' for real | 'temp_0' for temp
  name: string;
  cricherosUsername?: string;
  cricherosId?: string;
  isTemp: boolean;
  originalPlayerId?: number;   // real player this replaces (if temp)
}

export interface WeeklyTeamState {
  teamId: number;
  teamName: string;
  captainId: number;
  captainName: string;
  availableCoreIds: string[];  // 'p_<id>' of available core members
  unavailableCoreIds: string[];
  pickedIds: string[];         // picked during weekly auction
}

export interface ActiveWeeklyAuction {
  id?: number;
  parentHistoryId: number;
  createdAt: string;
  status: 'active' | 'completed';
  team1: WeeklyTeamState;
  team2: WeeklyTeamState;
  pool: string[];              // player IDs still available to pick
  playerIndex: { [id: string]: WeeklyPlayer };
  tossWinnerTeamId: number | null;
  currentPickTeamId: number | null;
  phase: 'toss' | 'picking' | 'swap' | 'completed';
  swapCount: number;           // total swaps completed (max 2)
}

export interface WeeklyMatchRecord {
  id?: number;
  parentHistoryId: number;
  parentAuctionDate: string;
  createdAt: string;
  completedAt: string;
  tossWinnerTeamId: number;
  tossWinnerName: string;
  team1: { teamId: number; teamName: string; captainName: string; playerNames: string[] };
  team2: { teamId: number; teamName: string; captainName: string; playerNames: string[] };
  swapsMade: number;
}
