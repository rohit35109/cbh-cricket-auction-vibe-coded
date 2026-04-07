import {
  Component, OnDestroy, Output, EventEmitter,
  signal, computed, inject, ChangeDetectorRef
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { DbService } from '../../services/db.service';
import { ActiveAuction, AuctionTeamEntry, AuctionHistoryRecord } from '../../models/models';

@Component({
  selector: 'app-auction-screen',
  standalone: true,
  templateUrl: './auction-screen.component.html',
  styleUrls: ['./auction-screen.component.css']
})
export class AuctionScreenComponent implements OnDestroy {
  @Output() auctionCompleted = new EventEmitter<void>();

  private db = inject(DbService);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);

  auction = signal<ActiveAuction | null>(null);
  actionInProgress = signal(false);
  showConfirmModal = signal(false);
  shuffleDisplay = signal<string[]>([]);
  private shuffleTimer: ReturnType<typeof setInterval> | null = null;

  completedTeamIds = computed(() => this.auction()?.completedTeamIds || []);
  teamOrder = computed(() =>
    this.auction()?.teamOrder?.length
      ? this.auction()!.teamOrder
      : (this.auction()?.teams?.map(t => t.teamId) || [])
  );
  currentTeamId = computed(() => {
    const a = this.auction();
    if (!a?.teamOrder?.length) return null;
    return a.teamOrder[a.currentTeamIndex] ?? null;
  });
  currentTeam = computed(() => {
    const id = this.currentTeamId();
    return id != null ? (this.auction()?.teams?.find(t => t.teamId === id) || null) : null;
  });
  currentPlayer = computed(() => {
    const a = this.auction();
    if (!a?.currentPlayerId) return null;
    return a.playerSnapshot[a.currentPlayerId] || null;
  });
  pickDots = computed(() => {
    const team = this.currentTeam(); const a = this.auction();
    if (!team || !a) return [];
    return Array.from({ length: a.coreMembersCount - 1 }, (_, i) => i < team.memberIds.length);
  });
  safeIframeUrl = computed((): SafeResourceUrl => {
    const p = this.currentPlayer();
    if (!p?.cricherosId || !p?.cricherosUsername) return '';
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://cricheroes.com/player-profile/${p.cricherosId}/${p.cricherosUsername}/stats?pagesize=12&ballType=LEATHER`
    );
  });
  cricherosProfileUrl = computed(() => {
    const p = this.currentPlayer();
    if (!p?.cricherosId || !p?.cricherosUsername) return null;
    return `https://cricheroes.com/player-profile/${p.cricherosId}/${p.cricherosUsername}/stats?pagesize=12&ballType=LEATHER`;
  });
  phaseLabel = computed(() => {
    switch (this.auction()?.phase) {
      case 'shuffling': return 'Shuffling';
      case 'active': return 'Live';
      case 'unsold_phase': return 'Unsold Phase';
      case 'completed': return 'Completed';
      default: return '';
    }
  });

  ngOnDestroy() { if (this.shuffleTimer) clearInterval(this.shuffleTimer); }

  loadAuction(a: ActiveAuction) {
    this.auction.set({ ...a, unsoldPlayers: a.unsoldPlayers ?? [] });
    if (a.phase === 'shuffling') setTimeout(() => this.startShuffle(), 100);
  }

  getPlayerName(id: number): string { return this.auction()?.playerSnapshot[id]?.name || `Player #${id}`; }
  getPlayerUsername(id: number): string { return this.auction()?.playerSnapshot[id]?.cricherosUsername || ''; }
  getTeam(id: number): AuctionTeamEntry | undefined { return this.auction()?.teams?.find(t => t.teamId === id); }

  // ── Shuffle ───────────────────────────────────────────────────────
  private startShuffle() {
    const teams = this.auction()?.teams || [];
    if (!teams.length) return;
    const names = teams.map(t => t.teamName);
    const ids = teams.map(t => t.teamId);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    const start = Date.now(); const duration = 5000; let frame = 0;
    this.shuffleTimer = setInterval(() => {
      const elapsed = Date.now() - start; frame++;
      const slow = Math.max(1, Math.floor((elapsed / duration) * 8));
      if (frame % slow === 0) {
        this.shuffleDisplay.set([...names].sort(() => Math.random() - 0.5).slice(0, 5));
        this.cdr.markForCheck();
      }
      if (elapsed >= duration) {
        clearInterval(this.shuffleTimer!); this.shuffleTimer = null;
        this.shuffleDisplay.set(ids.map(id => teams.find(t => t.teamId === id)!.teamName));
        this.cdr.markForCheck();
        setTimeout(async () => {
          const cur = this.auction()!;
          const updated: ActiveAuction = {
            ...cur, teamOrder: ids, currentTeamIndex: 0, phase: 'active',
            currentPlayerId: this.pickRandom(cur.availablePlayers)
          };
          this.auction.set(updated);
          await this.db.saveCurrentAuction(updated);
          this.cdr.markForCheck();
        }, 800);
      }
    }, 80);
  }

  // ── Pick Player ───────────────────────────────────────────────────
  async pickPlayer() {
    if (this.actionInProgress()) return;
    const a = this.auction();
    if (!a || !a.currentPlayerId || !this.currentTeam()) return;
    this.actionInProgress.set(true);
    try {
      const playerId = a.currentPlayerId;
      const teamId = this.currentTeamId()!;

      const teams = a.teams.map(t =>
        t.teamId === teamId ? { ...t, memberIds: [...t.memberIds, playerId] } : t
      );

      let availablePlayers = [...a.availablePlayers];
      let unsoldPlayers = [...a.unsoldPlayers];
      if (a.phase === 'active') {
        availablePlayers = availablePlayers.filter(p => p !== playerId);
      } else {
        unsoldPlayers = unsoldPlayers.filter(p => p !== playerId);
      }

      const updatedTeam = teams.find(t => t.teamId === teamId)!;
      const teamDone = updatedTeam.memberIds.length >= a.coreMembersCount - 1;
      const completedTeamIds = teamDone ? [...a.completedTeamIds, teamId] : [...a.completedTeamIds];

      const { nextIndex, phase } = this.nextTurn(a.teamOrder, a.currentTeamIndex, completedTeamIds, availablePlayers, unsoldPlayers);
      const currentPlayerId = this.choosePlayer(phase, availablePlayers, unsoldPlayers, null);

      const updated: ActiveAuction = {
        ...a, teams, availablePlayers, unsoldPlayers, completedTeamIds,
        currentTeamIndex: nextIndex, phase, currentPlayerId
      };
      this.auction.set(updated);
      await this.db.saveCurrentAuction(updated);
    } finally { this.actionInProgress.set(false); }
  }

  // ── Mark Unsold ───────────────────────────────────────────────────
  async markUnsold() {
    if (this.actionInProgress()) return;
    const a = this.auction();
    if (!a || !a.currentPlayerId) return;
    this.actionInProgress.set(true);
    try {
      const playerId = a.currentPlayerId;
      let availablePlayers = [...a.availablePlayers];
      let unsoldPlayers = [...a.unsoldPlayers];

      if (a.phase === 'active') {
        availablePlayers = availablePlayers.filter(p => p !== playerId);
        unsoldPlayers = [...unsoldPlayers, playerId];
      }

      const { nextIndex, phase } = this.nextTurn(a.teamOrder, a.currentTeamIndex, a.completedTeamIds, availablePlayers, unsoldPlayers);
      const currentPlayerId = this.choosePlayer(phase, availablePlayers, unsoldPlayers, playerId);

      const updated: ActiveAuction = {
        ...a, availablePlayers, unsoldPlayers,
        currentTeamIndex: nextIndex, phase, currentPlayerId
      };
      this.auction.set(updated);
      await this.db.saveCurrentAuction(updated);
    } finally { this.actionInProgress.set(false); }
  }

  // ── Turn logic ────────────────────────────────────────────────────
  private nextTurn(
    teamOrder: number[], currentIndex: number, completedTeamIds: number[],
    available: number[], unsold: number[]
  ): { nextIndex: number; phase: ActiveAuction['phase'] } {
    const active = teamOrder.filter(id => !completedTeamIds.includes(id));
    if (active.length === 0) return { nextIndex: currentIndex, phase: 'completed' };

    let nextIndex = (currentIndex + 1) % teamOrder.length;
    for (let s = 0; s < teamOrder.length; s++) {
      if (!completedTeamIds.includes(teamOrder[nextIndex])) break;
      nextIndex = (nextIndex + 1) % teamOrder.length;
    }

    if (available.length > 0) return { nextIndex, phase: 'active' };
    if (unsold.length > 0) return { nextIndex, phase: 'unsold_phase' };
    return { nextIndex, phase: 'active' };
  }

  private choosePlayer(
    phase: ActiveAuction['phase'], available: number[], unsold: number[], exclude: number | null
  ): number | null {
    if (phase === 'active' || (phase !== 'unsold_phase' && available.length > 0)) {
      const pool = exclude ? available.filter(p => p !== exclude) : available;
      return this.pickRandom(pool.length > 0 ? pool : available);
    }
    if (phase === 'unsold_phase') {
      const pool = exclude ? unsold.filter(p => p !== exclude) : unsold;
      return this.pickRandom(pool.length > 0 ? pool : unsold);
    }
    return null;
  }

  private pickRandom(pool: number[]): number | null {
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ── Save history ──────────────────────────────────────────────────
  async saveToHistory() {
    this.showConfirmModal.set(false);
    const a = this.auction();
    if (!a) return;

    const unsoldIds = [...a.availablePlayers, ...a.unsoldPlayers];

    const record: AuctionHistoryRecord = {
      createdAt: a.createdAt,
      completedAt: new Date().toISOString(),
      coreMembersCount: a.coreMembersCount,
      teamSummaries: a.teams.map(team => ({
        teamId: team.teamId,
        teamName: team.teamName,
        captainId: team.captainId,
        captainName: team.captainName,
        memberIds: team.memberIds,
        memberNames: team.memberIds.map(mid => a.playerSnapshot[mid]?.name || `#${mid}`),
        isFull: team.memberIds.length >= a.coreMembersCount - 1
      })),
      unsoldPlayerNames: unsoldIds.map(pid => a.playerSnapshot[pid]?.name || `#${pid}`),
      totalPlayers: Object.keys(a.playerSnapshot).length,
      playerSnapshot: a.playerSnapshot
    };

    await this.db.saveAuctionHistory(record);
    await this.db.clearCurrentAuction();
    this.auctionCompleted.emit();
  }
}
