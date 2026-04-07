import {
  Component, OnInit, Output, EventEmitter, signal, computed, inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DbService } from '../../services/db.service';
import {
  AuctionHistoryRecord, ActiveWeeklyAuction, WeeklyPlayer, WeeklyTeamState
} from '../../models/models';

type CoreMember = { id: number; name: string; isCaptain: boolean; available: boolean };
type TeamAvailability = {
  teamId: number;
  teamName: string;
  tempCaptainId: number | null;
  members: CoreMember[];
};

@Component({
  selector: 'app-weekly-wizard',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './weekly-wizard.component.html',
  styleUrls: ['./weekly-wizard.component.css']
})
export class WeeklyWizardComponent implements OnInit {
  @Output() cancel = new EventEmitter<void>();
  @Output() started = new EventEmitter<ActiveWeeklyAuction>();

  private db = inject(DbService);

  step = signal(1);
  loading = signal(true);
  saving = signal(false);
  errorMsg = signal('');

  history = signal<AuctionHistoryRecord[]>([]);
  selectedHistoryId = signal<number | null>(null);
  selectedHistory = signal<AuctionHistoryRecord | null>(null);
  selectedTeamIds = signal<number[]>([]);

  steps = [
    { n: 1, label: 'History' },
    { n: 2, label: 'Teams' },
    { n: 3, label: 'Core Availability' },
    { n: 4, label: 'Other Players' },
  ];

  // Step 3 — mutable array; signal updated via .update() to trigger reactivity
  coreAvailability = signal<TeamAvailability[]>([]);

  /** Live count of players participating this week */
  weeklyTotal = computed(() => {
    let total = 0;
    for (const teamAvail of this.coreAvailability()) {
      for (const m of teamAvail.members) {
        if (m.available) total++;
      }
    }
    for (const op of this.otherPlayers()) {
      if (op.available) total++;
      else if (op.tempName?.trim()) total++;
    }
    total += this.extraTempPlayers().length;
    return total;
  });

  // Step 4 data
  otherPlayers = signal<Array<{
    id: number;
    name: string;
    username: string;
    available: boolean;
    tempName: string;
  }>>([]);

  // Free-form temp players added for this week (not in DB)
  extraTempPlayers = signal<string[]>([]);
  newTempName = '';

  async ngOnInit() {
    this.loading.set(true);
    const hist = await this.db.getAuctionHistory();
    this.history.set([...hist].reverse());
    this.loading.set(false);
  }

  canNext = computed(() => {
    const s = this.step();
    if (s === 1) return this.selectedHistoryId() !== null;
    if (s === 2) return this.selectedTeamIds().length === 2;
    if (s === 3) {
      for (const teamAvail of this.coreAvailability()) {
        if (this.isCaptainAbsent(teamAvail) && teamAvail.tempCaptainId === null) return false;
      }
      return true;
    }
    return false;
  });

  isNewFormat(rec: AuctionHistoryRecord): boolean {
    return !!rec.playerSnapshot && rec.teamSummaries.every(
      ts => ts.captainId != null && Array.isArray(ts.memberIds)
    );
  }

  selectHistory(rec: AuctionHistoryRecord) {
    this.selectedHistoryId.set(rec.id!);
    this.selectedHistory.set(rec);
    this.selectedTeamIds.set([]);
  }

  isTeamSelected(teamId: number): boolean {
    return this.selectedTeamIds().includes(teamId);
  }

  toggleTeam(teamId: number) {
    const cur = this.selectedTeamIds();
    if (cur.includes(teamId)) {
      this.selectedTeamIds.set(cur.filter(id => id !== teamId));
    } else if (cur.length < 2) {
      this.selectedTeamIds.set([...cur, teamId]);
    }
  }

  nextStep() {
    this.errorMsg.set('');
    const s = this.step();

    if (s === 2) {
      const rec = this.selectedHistory()!;
      const hasNewFormat = rec.playerSnapshot &&
        rec.teamSummaries.every(ts => ts.captainId != null && Array.isArray(ts.memberIds));
      if (!hasNewFormat) {
        this.errorMsg.set(
          'This auction record is too old — it was saved before weekly auction support was added. Please run a new main auction first.'
        );
        return;
      }
      this.buildCoreAvailability();
    }

    if (s === 3) {
      for (const teamAvail of this.coreAvailability()) {
        if (this.isCaptainAbsent(teamAvail) && teamAvail.tempCaptainId === null) {
          this.errorMsg.set(
            `${teamAvail.teamName}: Captain is absent — please select a temp captain from the available core members.`
          );
          return;
        }
      }
      this.buildOtherPlayers();
    }

    this.step.set(s + 1);
  }

  prevStep() {
    this.errorMsg.set('');
    this.step.set(this.step() - 1);
  }

  /** True when the team's captain is marked unavailable */
  isCaptainAbsent(teamAvail: TeamAvailability): boolean {
    const cap = teamAvail.members.find(m => m.isCaptain);
    return !!cap && !cap.available;
  }

  /** Available non-captain core members (candidates for temp captain) */
  getAvailableCoreMembers(teamAvail: TeamAvailability): CoreMember[] {
    return teamAvail.members.filter(m => !m.isCaptain && m.available);
  }

  /** Toggle availability for any core member, including the captain */
  setMemberAvailability(teamAvail: TeamAvailability, member: CoreMember, available: boolean) {
    member.available = available;
    if (member.isCaptain && available) {
      teamAvail.tempCaptainId = null;
    }
    this.coreAvailability.update(v => [...v]);
  }

  /** Assign temp captain for the week when original captain is absent */
  setTempCaptain(teamAvail: TeamAvailability, memberId: number) {
    teamAvail.tempCaptainId = memberId;
    this.coreAvailability.update(v => [...v]);
  }

  /** Add a free-form temp player to this week's pool */
  addExtraTemp() {
    const name = this.newTempName.trim();
    if (!name) return;
    this.extraTempPlayers.update(v => [...v, name]);
    this.newTempName = '';
  }

  /** Remove a free-form temp player by index */
  removeExtraTemp(index: number) {
    this.extraTempPlayers.update(v => v.filter((_, i) => i !== index));
  }

  private buildCoreAvailability() {
    const rec = this.selectedHistory()!;
    const teamIds = this.selectedTeamIds();
    const avail: TeamAvailability[] = teamIds.map(tid => {
      const ts = rec.teamSummaries.find(t => t.teamId === tid)!;
      const snapshot = rec.playerSnapshot ?? {};
      const members: CoreMember[] = [];
      members.push({ id: ts.captainId ?? 0, name: ts.captainName, isCaptain: true, available: true });
      for (const mid of ts.memberIds ?? []) {
        const name = snapshot[mid]?.name || `Player #${mid}`;
        members.push({ id: mid, name, isCaptain: false, available: true });
      }
      return { teamId: tid, teamName: ts.teamName, tempCaptainId: null, members };
    });
    this.coreAvailability.set(avail);
  }

  private buildOtherPlayers() {
    const rec = this.selectedHistory()!;
    const teamIds = this.selectedTeamIds();
    const snapshot = rec.playerSnapshot ?? {};

    const coreIds = new Set<number>();
    for (const tid of teamIds) {
      const ts = rec.teamSummaries.find(t => t.teamId === tid)!;
      if (ts.captainId != null) coreIds.add(ts.captainId);
      for (const mid of ts.memberIds ?? []) coreIds.add(mid);
    }

    const others = Object.entries(snapshot)
      .map(([idStr, p]) => ({ id: Number(idStr), ...p }))
      .filter(p => !coreIds.has(p.id))
      .map(p => ({
        id: p.id,
        name: p.name,
        username: p.cricherosUsername || '',
        available: true,
        tempName: ''
      }));

    this.otherPlayers.set(others);
  }

  async startWeeklyAuction() {
    this.errorMsg.set('');
    this.saving.set(true);
    try {
      const rec = this.selectedHistory()!;
      const teamIds = this.selectedTeamIds();
      const coreAvail = this.coreAvailability();

      const playerIndex: { [id: string]: WeeklyPlayer } = {};

      const buildTeamState = (tid: number): WeeklyTeamState => {
        const ts = rec.teamSummaries.find(t => t.teamId === tid)!;
        const avail = coreAvail.find(a => a.teamId === tid)!;

        const captainMember = avail.members.find(m => m.isCaptain)!;
        const captainAbsent = !captainMember.available;
        const tempCaptainId = avail.tempCaptainId;

        const availableCoreIds: string[] = [];
        const unavailableCoreIds: string[] = [];

        for (const m of avail.members) {
          const pid = `p_${m.id}`;
          const snap = rec.playerSnapshot?.[m.id];

          playerIndex[pid] = {
            id: pid,
            name: m.name,
            cricherosUsername: snap?.cricherosUsername,
            cricherosId: snap?.cricherosId,
            isTemp: false,
            originalPlayerId: m.id
          };

          if (m.isCaptain) {
            if (!m.available) unavailableCoreIds.push(pid);
            continue;
          }

          if (m.available) {
            if (captainAbsent && tempCaptainId === m.id) {
              // Acts as temp captain — not in pickedIds
            } else {
              availableCoreIds.push(pid);
            }
          } else {
            unavailableCoreIds.push(pid);
          }
        }

        let resolvedCaptainId = ts.captainId ?? 0;
        let resolvedCaptainName = ts.captainName;
        if (captainAbsent && tempCaptainId !== null) {
          const tempCapMember = avail.members.find(m => m.id === tempCaptainId);
          if (tempCapMember) {
            resolvedCaptainId = tempCaptainId;
            resolvedCaptainName = tempCapMember.name;
          }
        }

        return {
          teamId: tid,
          teamName: ts.teamName,
          captainId: resolvedCaptainId,
          captainName: resolvedCaptainName,
          availableCoreIds,
          unavailableCoreIds,
          pickedIds: [...availableCoreIds]
        };
      };

      const team1 = buildTeamState(teamIds[0]);
      const team2 = buildTeamState(teamIds[1]);

      const pool: string[] = [];
      let tempIdx = 0;

      for (const op of this.otherPlayers()) {
        if (op.available) {
          const pid = `p_${op.id}`;
          pool.push(pid);
          const snap = rec.playerSnapshot?.[op.id];
          playerIndex[pid] = {
            id: pid, name: op.name,
            cricherosUsername: snap?.cricherosUsername,
            cricherosId: snap?.cricherosId,
            isTemp: false, originalPlayerId: op.id
          };
        } else if (op.tempName.trim()) {
          const tid = `temp_${tempIdx++}`;
          pool.push(tid);
          playerIndex[tid] = {
            id: tid, name: op.tempName.trim(),
            isTemp: true, originalPlayerId: op.id
          };
        }
      }

      for (const name of this.extraTempPlayers()) {
        const tid = `temp_${tempIdx++}`;
        pool.push(tid);
        playerIndex[tid] = { id: tid, name, isTemp: true };
      }

      const totalInMatch = 2 + team1.pickedIds.length + team2.pickedIds.length + pool.length;

      if (totalInMatch > 24) {
        this.errorMsg.set(`Total players (${totalInMatch}) exceeds the maximum of 24. Mark more players as unavailable.`);
        this.saving.set(false);
        return;
      }
      if (totalInMatch < 22) {
        this.errorMsg.set(`Total players (${totalInMatch}) is below the minimum of 22. Add ${22 - totalInMatch} more available or temp player(s) in step 4.`);
        this.saving.set(false);
        return;
      }

      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      const weekly: ActiveWeeklyAuction = {
        parentHistoryId: rec.id!,
        createdAt: new Date().toISOString(),
        status: 'active',
        team1, team2, pool, playerIndex,
        tossWinnerTeamId: null,
        currentPickTeamId: null,
        phase: 'toss',
        swapCount: 0
      };

      await this.db.saveCurrentWeeklyAuction(weekly);
      this.started.emit(weekly);
    } catch (e) {
      this.errorMsg.set('Failed to start weekly auction. Please try again.');
    } finally {
      this.saving.set(false);
    }
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
    } catch { return iso; }
  }
}
