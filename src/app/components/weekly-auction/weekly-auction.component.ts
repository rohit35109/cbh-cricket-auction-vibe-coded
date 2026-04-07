import {
  Component, OnInit, OnDestroy, Output, EventEmitter,
  signal, computed, inject, ChangeDetectorRef
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DbService } from '../../services/db.service';
import {
  ActiveWeeklyAuction, WeeklyTeamState, WeeklyPlayer, WeeklyMatchRecord
} from '../../models/models';

@Component({
  selector: 'app-weekly-auction',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './weekly-auction.component.html',
  styleUrls: ['./weekly-auction.component.css']
})
export class WeeklyAuctionComponent implements OnInit, OnDestroy {
  @Output() auctionCompleted = new EventEmitter<void>();

  private db = inject(DbService);
  private cdr = inject(ChangeDetectorRef);

  auction = signal<ActiveWeeklyAuction | null>(null);
  highlightedPid = signal<string | null>(null);
  showFinishConfirm = signal(false);
  swapMaxMsg = signal('');
  copyDone = signal(false);
  swapSelection = signal<{ team1Pid: string | null; team2Pid: string | null }>({ team1Pid: null, team2Pid: null });

  // Coin flip state
  isFlipping = signal(false);
  flipDone = signal(false);
  flipResult = signal<'heads' | 'tails' | null>(null);
  flipWinnerTeamId = signal<number | null>(null);

  private swapToastTimer: ReturnType<typeof setTimeout> | null = null;

  bothTeams = computed(() => {
    const a = this.auction();
    if (!a) return [];
    return [a.team1, a.team2];
  });

  currentPickTeam = computed(() => {
    const a = this.auction();
    if (!a?.currentPickTeamId) return null;
    return a.team1.teamId === a.currentPickTeamId ? a.team1 : a.team2;
  });

  phaseLabel = computed(() => {
    switch (this.auction()?.phase) {
      case 'toss': return 'Toss';
      case 'picking': return 'Picking';
      case 'swap': return 'Swap Phase';
      case 'completed': return 'Completed';
      default: return '';
    }
  });

  flipWinnerName = computed(() => {
    const id = this.flipWinnerTeamId();
    const a = this.auction();
    if (!id || !a) return '';
    return a.team1.teamId === id ? a.team1.teamName : a.team2.teamName;
  });

  perTeamCap = computed(() => {
    const a = this.auction();
    if (!a) return 12;
    const total = 2 + a.team1.pickedIds.length + a.team2.pickedIds.length + a.pool.length;
    return Math.min(12, Math.ceil(total / 2));
  });

  isTeamFull(team: WeeklyTeamState): boolean {
    return 1 + team.pickedIds.length >= this.perTeamCap();
  }

  teamSizeLabel(team: WeeklyTeamState): string {
    return `${1 + team.pickedIds.length} / ${this.perTeamCap()}`;
  }

  async ngOnInit() {
    const existing = await this.db.getCurrentWeeklyAuction();
    if (existing) this.auction.set(existing);
  }

  ngOnDestroy() {
    if (this.swapToastTimer) clearTimeout(this.swapToastTimer);
  }

  loadAuction(a: ActiveWeeklyAuction) {
    this.auction.set(a);
  }

  getPlayer(pid: string): WeeklyPlayer | undefined {
    return this.auction()?.playerIndex[pid];
  }

  isCorePlayer(pid: string): boolean {
    const a = this.auction();
    if (!a) return false;
    return a.team1.availableCoreIds.includes(pid) || a.team2.availableCoreIds.includes(pid);
  }

  isCorePlayerForTeam(pid: string, teamId: number): boolean {
    const a = this.auction();
    if (!a) return false;
    const team = a.team1.teamId === teamId ? a.team1 : a.team2;
    return team.availableCoreIds.includes(pid);
  }

  nonCorePicks(team: WeeklyTeamState): string[] {
    return team.pickedIds.filter(pid => !team.availableCoreIds.includes(pid));
  }

  copyTeams() {
    const a = this.auction();
    if (!a) return;

    const formatTeam = (team: WeeklyTeamState): string => {
      const lines: string[] = [];
      lines.push(team.teamName);
      lines.push(`1. ${team.captainName} (C)`);
      team.pickedIds.forEach((pid, i) => {
        const name = this.getPlayer(pid)?.name ?? pid;
        lines.push(`${i + 2}. ${name}`);
      });
      return lines.join('\n');
    };

    const text = formatTeam(a.team1) + '\n\n' + formatTeam(a.team2);
    navigator.clipboard.writeText(text).then(() => {
      this.copyDone.set(true);
      setTimeout(() => this.copyDone.set(false), 2500);
    });
  }

  // ── Toss / Coin Flip ──────────────────────────────────────────────
  flipCoin() {
    if (this.isFlipping() || this.flipDone()) return;
    const a = this.auction();
    if (!a) return;

    this.isFlipping.set(true);
    this.flipDone.set(false);
    this.flipResult.set(null);
    this.flipWinnerTeamId.set(null);

    const result: 'heads' | 'tails' = Math.random() < 0.5 ? 'heads' : 'tails';

    setTimeout(() => {
      const winnerId = result === 'heads' ? a.team1.teamId : a.team2.teamId;
      this.flipResult.set(result);
      this.flipWinnerTeamId.set(winnerId);
      this.isFlipping.set(false);
      this.flipDone.set(true);
    }, 2100);
  }

  async confirmTossWinner() {
    const a = this.auction();
    const winnerId = this.flipWinnerTeamId();
    if (!a || !winnerId) return;
    const updated: ActiveWeeklyAuction = {
      ...a,
      tossWinnerTeamId: winnerId,
      currentPickTeamId: winnerId,
      phase: 'picking'
    };
    this.auction.set(updated);
    await this.db.saveCurrentWeeklyAuction(updated);
  }

  // ── Pick Player ───────────────────────────────────────────────────
  async pickPlayer(pid: string) {
    const a = this.auction();
    if (!a || !a.currentPickTeamId) return;

    const pool = a.pool.filter(p => p !== pid);

    const isTeam1Picking = a.currentPickTeamId === a.team1.teamId;
    const team1 = isTeam1Picking
      ? { ...a.team1, pickedIds: [...a.team1.pickedIds, pid] }
      : a.team1;
    const team2 = !isTeam1Picking
      ? { ...a.team2, pickedIds: [...a.team2.pickedIds, pid] }
      : a.team2;

    const newTotal = 2 + team1.pickedIds.length + team2.pickedIds.length + pool.length;
    const cap = Math.min(12, Math.ceil(newTotal / 2));
    const t1Full = 1 + team1.pickedIds.length >= cap;
    const t2Full = 1 + team2.pickedIds.length >= cap;

    const otherTeamId = isTeam1Picking ? a.team2.teamId : a.team1.teamId;
    const otherFull = isTeam1Picking ? t2Full : t1Full;
    const currentFull = isTeam1Picking ? t1Full : t2Full;

    let nextPickTeamId: number | null = a.currentPickTeamId;
    if (pool.length > 0) {
      if (!otherFull) {
        nextPickTeamId = otherTeamId;
      } else if (!currentFull) {
        nextPickTeamId = a.currentPickTeamId;
      } else {
        nextPickTeamId = null;
      }
    }

    const updated: ActiveWeeklyAuction = {
      ...a, pool, team1, team2,
      currentPickTeamId: nextPickTeamId
    };
    this.auction.set(updated);
    await this.db.saveCurrentWeeklyAuction(updated);
  }

  async proceedToSwap() {
    const a = this.auction();
    if (!a) return;
    const updated: ActiveWeeklyAuction = { ...a, phase: 'swap' };
    this.auction.set(updated);
    await this.db.saveCurrentWeeklyAuction(updated);
  }

  // ── Swap ──────────────────────────────────────────────────────────
  selectSwapPlayer(teamNum: 1 | 2, pid: string) {
    if ((this.auction()?.swapCount ?? 0) >= 2) {
      this.showSwapToast('Maximum 2 swaps allowed.');
      return;
    }
    const cur = this.swapSelection();
    if (teamNum === 1) {
      this.swapSelection.set({ ...cur, team1Pid: cur.team1Pid === pid ? null : pid });
    } else {
      this.swapSelection.set({ ...cur, team2Pid: cur.team2Pid === pid ? null : pid });
    }
  }

  async executeSwap() {
    const a = this.auction();
    if (!a) return;
    const { team1Pid, team2Pid } = this.swapSelection();
    if (!team1Pid || !team2Pid) return;
    if (a.swapCount >= 2) { this.showSwapToast('Maximum 2 swaps allowed.'); return; }

    const team1Picks = a.team1.pickedIds.map(p => p === team1Pid ? team2Pid : p);
    const team2Picks = a.team2.pickedIds.map(p => p === team2Pid ? team1Pid : p);

    const updated: ActiveWeeklyAuction = {
      ...a,
      team1: { ...a.team1, pickedIds: team1Picks },
      team2: { ...a.team2, pickedIds: team2Picks },
      swapCount: a.swapCount + 1
    };
    this.swapSelection.set({ team1Pid: null, team2Pid: null });
    this.auction.set(updated);
    await this.db.saveCurrentWeeklyAuction(updated);
  }

  private showSwapToast(msg: string) {
    this.swapMaxMsg.set(msg);
    if (this.swapToastTimer) clearTimeout(this.swapToastTimer);
    this.swapToastTimer = setTimeout(() => this.swapMaxMsg.set(''), 2500);
  }

  // ── Finish & Save ─────────────────────────────────────────────────
  async finishAndSave() {
    this.showFinishConfirm.set(false);
    const a = this.auction();
    if (!a) return;

    const getNames = (team: WeeklyTeamState): string[] =>
      team.pickedIds.map(pid => a.playerIndex[pid]?.name || pid);

    const tossWinner = a.tossWinnerTeamId === a.team1.teamId ? a.team1 : a.team2;

    const record: WeeklyMatchRecord = {
      parentHistoryId: a.parentHistoryId,
      parentAuctionDate: a.createdAt,
      createdAt: a.createdAt,
      completedAt: new Date().toISOString(),
      tossWinnerTeamId: a.tossWinnerTeamId!,
      tossWinnerName: tossWinner.teamName,
      team1: {
        teamId: a.team1.teamId,
        teamName: a.team1.teamName,
        captainName: a.team1.captainName,
        playerNames: getNames(a.team1)
      },
      team2: {
        teamId: a.team2.teamId,
        teamName: a.team2.teamName,
        captainName: a.team2.captainName,
        playerNames: getNames(a.team2)
      },
      swapsMade: a.swapCount
    };

    await this.db.saveWeeklyMatch(record);
    await this.db.clearCurrentWeeklyAuction();

    const completed: ActiveWeeklyAuction = { ...a, phase: 'completed', status: 'completed' };
    this.auction.set(completed);
  }
}
