import {
  Component, OnInit, Output, EventEmitter, signal, computed, inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DbService } from '../../services/db.service';
import { Team, Player, ActiveAuction, AuctionTeamEntry } from '../../models/models';

interface WizardPlayer extends Player {
  _tempId: number;
}

interface TeamInput {
  idx: number;
  name: string;
  existingId?: number;
  /** Stable key used within wizard for captain assignment. equals existingId for DB teams, or 1000+idx for new ones */
  tempKey: number;
}

@Component({
  selector: 'app-wizard',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="wizard-overlay">
      <div class="wizard-box">
        <!-- Header -->
        <div class="wizard-header">
          <span class="wizard-title">🏏 Auction Setup</span>
          <div class="step-indicators">
            @for (s of steps; track s.num) {
              <div class="step-dot" [class.active]="step() >= s.num" [class.current]="step() === s.num">
                <span>{{ s.num }}</span>
              </div>
              @if (!$last) { <div class="step-line" [class.active]="step() > s.num"></div> }
            }
          </div>
        </div>

        <!-- Step 1: Teams -->
        @if (step() === 1) {
          <div class="wizard-body">
            <h2 class="step-title">Configure Teams</h2>
            <p class="step-sub">Select number of teams and enter their names</p>
            <div class="form-row">
              <label>Number of Teams</label>
              <select [(ngModel)]="teamCount" (ngModelChange)="onTeamCountChange($event)">
                @for (n of teamCountOptions; track n) {
                  <option [value]="n">{{ n }}</option>
                }
              </select>
            </div>
            <div class="teams-grid">
              @for (t of teamInputs(); track t.tempKey) {
                <div class="team-input-row">
                  <span class="team-num">T{{ t.idx + 1 }}</span>
                  <input
                    type="text"
                    [(ngModel)]="t.name"
                    [placeholder]="'Team ' + (t.idx + 1) + ' name'"
                    class="inp"
                    maxlength="40"
                  />
                </div>
              }
            </div>
            @if (step1Error()) {
              <p class="error">{{ step1Error() }}</p>
            }
          </div>
        }

        <!-- Step 2: Core Members -->
        @if (step() === 2) {
          <div class="wizard-body">
            <h2 class="step-title">Core Members Per Team</h2>
            <p class="step-sub">How many core members per team? This count includes the captain.</p>
            <div class="core-members-selector">
              @for (n of coreMemberOptions; track n) {
                <button class="core-btn" [class.selected]="coreMembersCount() === n" (click)="coreMembersCount.set(n)">
                  {{ n }}
                </button>
              }
            </div>
            <div class="core-info">
              <div class="info-card">
                <span class="info-label">Teams</span>
                <span class="info-val">{{ teamCount }}</span>
              </div>
              <div class="info-card">
                <span class="info-label">Core / Team</span>
                <span class="info-val">{{ coreMembersCount() }}</span>
              </div>
              <div class="info-card">
                <span class="info-label">Picks / Captain</span>
                <span class="info-val">{{ coreMembersCount() - 1 }}</span>
              </div>
              <div class="info-card">
                <span class="info-label">Total Picks</span>
                <span class="info-val">{{ (coreMembersCount() - 1) * teamCount }}</span>
              </div>
            </div>
          </div>
        }

        <!-- Step 3: Players -->
        @if (step() === 3) {
          <div class="wizard-body step3-body">
            <h2 class="step-title">Manage Players</h2>
            <p class="step-sub">Add players for this auction. Assign captains to teams.</p>

            <div class="add-player-form">
              <div class="form-grid-5">
                <input type="text" [(ngModel)]="newPlayer.name" placeholder="Player Name *" class="inp" maxlength="50" />
                <input type="text" [(ngModel)]="newPlayer.cricherosUsername" placeholder="Cricheroes Username" class="inp" maxlength="60" />
                <input type="text" [(ngModel)]="newPlayer.cricherosId" placeholder="Cricheroes ID" class="inp" maxlength="30" />
                <label class="captain-check">
                  <input type="checkbox" [(ngModel)]="newPlayer.isCaptain" (ngModelChange)="onCaptainToggle()" />
                  <span>Is Captain</span>
                </label>
                @if (newPlayer.isCaptain) {
                  <select [(ngModel)]="newPlayer.teamKey" class="inp">
                    <option [ngValue]="undefined">-- Select Team --</option>
                    @for (t of availableTeamsForNewCaptain(); track t.tempKey) {
                      <option [ngValue]="t.tempKey">{{ t.name }}</option>
                    }
                  </select>
                } @else {
                  <div></div>
                }
              </div>
              @if (addPlayerError()) { <p class="error">{{ addPlayerError() }}</p> }
              <button class="btn-add" (click)="addPlayer()">+ Add Player</button>
            </div>

            <div class="players-list-container">
              <div class="players-list-header">
                <span class="pl-col name">Name</span>
                <span class="pl-col username">Cricheroes User</span>
                <span class="pl-col cid">Cricheroes ID</span>
                <span class="pl-col captain">Cap</span>
                <span class="pl-col team">Team</span>
                <span class="pl-col active">Active</span>
                <span class="pl-col actions">Del</span>
              </div>
              <div class="players-scroll">
                @for (p of players(); track p._tempId) {
                  <div class="player-row" [class.captain-row]="p.isCaptain">
                    <span class="pl-col name">{{ p.name }}</span>
                    <span class="pl-col username">{{ p.cricherosUsername || '—' }}</span>
                    <span class="pl-col cid">{{ p.cricherosId || '—' }}</span>
                    <span class="pl-col captain">
                      @if (p.isCaptain) { <span class="badge captain">C</span> }
                    </span>
                    <span class="pl-col team">
                      @if (p.isCaptain && p._teamKey != null) { {{ getTeamNameByKey(p._teamKey) }} } @else { — }
                    </span>
                    <span class="pl-col active">
                      <label class="toggle">
                        <input type="checkbox" [checked]="p.isActive" (change)="toggleActive(p)" />
                        <span class="slider"></span>
                      </label>
                    </span>
                    <span class="pl-col actions">
                      <button class="btn-icon remove" (click)="removePlayer(p._tempId)">✕</button>
                    </span>
                  </div>
                }
                @if (players().length === 0) {
                  <div class="empty-players">No players added yet</div>
                }
              </div>
            </div>
            @if (step3Error()) { <p class="error">{{ step3Error() }}</p> }
          </div>
        }

        <!-- Footer -->
        <div class="wizard-footer">
          @if (step() > 1) {
            <button class="btn-ghost" (click)="prevStep()">← Back</button>
          }
          <div class="spacer"></div>
          @if (step() < 3) {
            <button class="btn-primary" (click)="nextStep()">Next →</button>
          } @else {
            <button class="btn-primary btn-finish" (click)="finish()" [disabled]="finishing()">
              @if (finishing()) { Saving... } @else { 🚀 Start Auction }
            </button>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .wizard-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .wizard-box {
      background: #1e293b; border: 1px solid #334155; border-radius: 16px;
      width: 90vw; max-width: 900px; max-height: 90vh;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .wizard-header {
      padding: 20px 28px; border-bottom: 1px solid #334155;
      display: flex; align-items: center; justify-content: space-between; background: #0f172a;
    }
    .wizard-title { font-size: 1.25rem; font-weight: 700; color: #f8fafc; }
    .step-indicators { display: flex; align-items: center; }
    .step-dot {
      width: 32px; height: 32px; border-radius: 50%; border: 2px solid #475569;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.8rem; font-weight: 600; color: #94a3b8; transition: all 0.3s;
    }
    .step-dot.active { border-color: #22c55e; color: #22c55e; }
    .step-dot.current { background: #22c55e; border-color: #22c55e; color: #0f172a; }
    .step-line { width: 40px; height: 2px; background: #334155; transition: background 0.3s; }
    .step-line.active { background: #22c55e; }
    .wizard-body { flex: 1; overflow-y: auto; padding: 24px 28px; }
    .step3-body { padding: 16px 28px; display: flex; flex-direction: column; gap: 14px; }
    .step-title { font-size: 1.3rem; font-weight: 700; color: #f8fafc; margin: 0 0 6px; }
    .step-sub { color: #94a3b8; margin: 0 0 20px; font-size: 0.9rem; }
    .form-row { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
    .form-row label { color: #94a3b8; font-size: 0.9rem; min-width: 150px; }
    select {
      background: #0f172a; border: 1px solid #334155; border-radius: 8px;
      color: #f8fafc; padding: 8px 12px; font-size: 0.95rem; cursor: pointer;
    }
    .teams-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .team-input-row { display: flex; align-items: center; gap: 8px; }
    .team-num { color: #22c55e; font-weight: 600; font-size: 0.85rem; min-width: 28px; }
    .inp {
      background: #0f172a; border: 1px solid #334155; border-radius: 8px;
      color: #f8fafc; padding: 8px 12px; font-size: 0.9rem; width: 100%; transition: border-color 0.2s;
    }
    .inp:focus { outline: none; border-color: #22c55e; }
    .core-members-selector { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 24px; }
    .core-btn {
      width: 56px; height: 56px; border-radius: 12px; border: 2px solid #334155;
      background: #0f172a; color: #94a3b8; font-size: 1.4rem; font-weight: 700; cursor: pointer; transition: all 0.2s;
    }
    .core-btn:hover { border-color: #22c55e; color: #22c55e; }
    .core-btn.selected { border-color: #22c55e; background: #22c55e; color: #0f172a; }
    .core-info { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .info-card {
      background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 14px; text-align: center;
    }
    .info-label { display: block; color: #64748b; font-size: 0.75rem; margin-bottom: 4px; }
    .info-val { display: block; color: #22c55e; font-size: 1.5rem; font-weight: 700; }
    .add-player-form {
      background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 14px;
    }
    .form-grid-5 {
      display: grid; grid-template-columns: 2fr 2fr 1.5fr 1fr 1.5fr; gap: 8px;
      margin-bottom: 10px; align-items: center;
    }
    .captain-check {
      display: flex; align-items: center; gap: 6px; color: #94a3b8; font-size: 0.85rem; cursor: pointer;
    }
    .captain-check input { width: 16px; height: 16px; accent-color: #22c55e; }
    .btn-add {
      background: #22c55e; color: #0f172a; border: none; border-radius: 8px;
      padding: 8px 18px; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: opacity 0.2s;
    }
    .btn-add:hover { opacity: 0.85; }
    .players-list-container { border: 1px solid #334155; border-radius: 10px; overflow: hidden; }
    .players-list-header {
      display: grid; grid-template-columns: 2fr 2fr 1.2fr 0.5fr 1.2fr 0.7fr 0.5fr;
      gap: 8px; padding: 10px 14px; background: #0f172a; border-bottom: 1px solid #334155;
      font-size: 0.75rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;
    }
    .players-scroll { max-height: 240px; overflow-y: auto; }
    .player-row {
      display: grid; grid-template-columns: 2fr 2fr 1.2fr 0.5fr 1.2fr 0.7fr 0.5fr;
      gap: 8px; padding: 10px 14px; border-bottom: 1px solid #1e293b;
      font-size: 0.85rem; color: #cbd5e1; align-items: center; transition: background 0.15s;
    }
    .player-row:hover { background: #1e293b; }
    .player-row.captain-row { background: rgba(34,197,94,0.05); }
    .pl-col { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .badge { display: inline-block; padding: 2px 7px; border-radius: 99px; font-size: 0.7rem; font-weight: 700; }
    .badge.captain { background: #f59e0b; color: #0f172a; }
    .toggle { position: relative; display: inline-block; width: 36px; height: 20px; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .slider { position: absolute; inset: 0; background: #334155; border-radius: 20px; cursor: pointer; transition: 0.2s; }
    .slider:before {
      content: ''; position: absolute; width: 14px; height: 14px; background: white;
      border-radius: 50%; left: 3px; bottom: 3px; transition: 0.2s;
    }
    input:checked + .slider { background: #22c55e; }
    input:checked + .slider:before { transform: translateX(16px); }
    .btn-icon { width: 26px; height: 26px; border-radius: 6px; border: none; cursor: pointer; font-size: 0.8rem; transition: opacity 0.2s; }
    .btn-icon.remove { background: rgba(239,68,68,0.15); color: #ef4444; }
    .btn-icon.remove:hover { background: rgba(239,68,68,0.3); }
    .empty-players { text-align: center; padding: 24px; color: #475569; font-size: 0.9rem; }
    .wizard-footer {
      padding: 16px 28px; border-top: 1px solid #334155;
      display: flex; align-items: center; gap: 12px; background: #0f172a;
    }
    .spacer { flex: 1; }
    .btn-ghost {
      background: transparent; border: 1px solid #334155; color: #94a3b8;
      border-radius: 8px; padding: 10px 20px; font-size: 0.9rem; cursor: pointer; transition: all 0.2s;
    }
    .btn-ghost:hover { border-color: #94a3b8; color: #f8fafc; }
    .btn-primary {
      background: #22c55e; color: #0f172a; border: none; border-radius: 8px;
      padding: 10px 24px; font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s;
    }
    .btn-primary:hover { opacity: 0.85; }
    .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
    .btn-finish { padding: 10px 28px; font-size: 1rem; }
    .error { color: #f87171; font-size: 0.85rem; margin-top: 4px; }
  `]
})
export class WizardComponent implements OnInit {
  @Output() auctionStarted = new EventEmitter<ActiveAuction>();

  private db = inject(DbService);

  steps = [{ num: 1 }, { num: 2 }, { num: 3 }];
  step = signal(1);
  finishing = signal(false);

  teamCount = 4;
  teamCountOptions = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  teamInputs = signal<TeamInput[]>([]);
  step1Error = signal('');

  coreMembersCount = signal(3);
  coreMemberOptions = [2, 3, 4, 5, 6];

  // _teamKey is the tempKey used for captain team assignment within wizard
  players = signal<(WizardPlayer & { _teamKey?: number })[]>([]);
  newPlayer: { name?: string; cricherosUsername?: string; cricherosId?: string; isCaptain?: boolean; teamKey?: number } = {};
  addPlayerError = signal('');
  step3Error = signal('');

  private existingTeams: Team[] = [];
  private nextTempId = 1;

  availableTeamsForNewCaptain = computed(() => {
    const usedKeys = new Set(
      this.players().filter(p => p.isCaptain && p._teamKey != null).map(p => p._teamKey!)
    );
    return this.teamInputs()
      .filter(t => t.name.trim())
      .filter(t => !usedKeys.has(t.tempKey));
  });

  async ngOnInit() {
    await this.db.init();
    this.existingTeams = await this.db.getTeams();
    const existingPlayers = await this.db.getPlayers();
    this.initTeamInputs();

    // Load players; map their saved teamId to tempKey (for existing teams, tempKey == teamId)
    this.players.set(
      existingPlayers.map(p => ({
        ...p,
        _tempId: this.nextTempId++,
        _teamKey: p.isCaptain ? p.teamId : undefined
      }))
    );
  }

  initTeamInputs() {
    const inputs: TeamInput[] = Array.from({ length: this.teamCount }, (_, i) => {
      const existing = this.existingTeams[i];
      return {
        idx: i,
        name: existing?.name || '',
        existingId: existing?.id,
        // For existing teams: tempKey = real DB id; for new teams: high number to avoid collision
        tempKey: existing?.id ?? (1000 + i)
      };
    });
    this.teamInputs.set(inputs);
  }

  onTeamCountChange(n: number) {
    this.teamCount = +n;
    this.initTeamInputs();
  }

  onCaptainToggle() {
    if (!this.newPlayer.isCaptain) {
      this.newPlayer.teamKey = undefined;
    }
  }

  getTeamNameByKey(tempKey: number): string {
    return this.teamInputs().find(t => t.tempKey === tempKey)?.name || '?';
  }

  addPlayer() {
    this.addPlayerError.set('');
    if (!this.newPlayer.name?.trim()) {
      this.addPlayerError.set('Player name is required');
      return;
    }
    if (this.newPlayer.isCaptain) {
      if (this.newPlayer.teamKey == null) {
        this.addPlayerError.set('Select a team for this captain');
        return;
      }
      const alreadyCaptain = this.players().find(
        p => p.isCaptain && p._teamKey === this.newPlayer.teamKey
      );
      if (alreadyCaptain) {
        this.addPlayerError.set(`${this.getTeamNameByKey(this.newPlayer.teamKey)} already has a captain`);
        return;
      }
    }
    const p = {
      name: this.newPlayer.name!.trim(),
      cricherosUsername: this.newPlayer.cricherosUsername?.trim() || undefined,
      cricherosId: this.newPlayer.cricherosId?.trim() || undefined,
      isCaptain: this.newPlayer.isCaptain || false,
      isActive: true,
      _tempId: this.nextTempId++,
      _teamKey: this.newPlayer.isCaptain ? this.newPlayer.teamKey : undefined
    };
    this.players.update(list => [...list, p]);
    this.newPlayer = {};
  }

  removePlayer(tempId: number) {
    this.players.update(list => list.filter(p => p._tempId !== tempId));
  }

  toggleActive(p: WizardPlayer) {
    this.players.update(list =>
      list.map(pl => pl._tempId === p._tempId ? { ...pl, isActive: !pl.isActive } : pl)
    );
  }

  nextStep() {
    this.step1Error.set('');
    if (this.step() === 1) {
      const names = this.teamInputs().map(t => t.name.trim());
      if (names.some(n => !n)) { this.step1Error.set('All team names are required'); return; }
      if (new Set(names).size !== names.length) { this.step1Error.set('Team names must be unique'); return; }
    }
    this.step.update(s => s + 1);
  }

  prevStep() { this.step.update(s => s - 1); }

  async finish() {
    this.step3Error.set('');
    const activePlayers = this.players().filter(p => p.isActive !== false);
    const captains = activePlayers.filter(p => p.isCaptain && p._teamKey != null);
    const inputs = this.teamInputs();

    if (captains.length !== this.teamCount) {
      this.step3Error.set(
        `Each team needs exactly one captain. Found ${captains.length} captains for ${this.teamCount} teams.`
      );
      return;
    }
    const captainKeys = new Set(captains.map(c => c._teamKey));
    if (captainKeys.size !== captains.length) {
      this.step3Error.set('Multiple captains are assigned to the same team');
      return;
    }

    this.finishing.set(true);
    try {
      // Save teams and build tempKey → real DB id map
      const savedTeams: Array<{ id: number; name: string; tempKey: number }> = [];
      for (let i = 0; i < this.teamCount; i++) {
        const inp = inputs[i];
        const teamData: Team = { name: inp.name.trim(), isActive: true };
        let realId: number;
        if (inp.existingId) {
          teamData.id = inp.existingId;
          await this.db.saveTeam(teamData);
          realId = inp.existingId;
        } else {
          realId = (await this.db.saveTeam(teamData)) as number;
        }
        savedTeams.push({ id: realId, name: teamData.name, tempKey: inp.tempKey });
      }

      const tempKeyToId: { [key: number]: number } = {};
      savedTeams.forEach(t => { tempKeyToId[t.tempKey] = t.id; });

      // Save players
      const savedPlayers: Player[] = [];
      for (const wp of this.players()) {
        const realTeamId = wp.isCaptain && wp._teamKey != null
          ? (tempKeyToId[wp._teamKey] ?? wp.teamId)
          : undefined;

        const playerData: Player = {
          name: wp.name,
          cricherosUsername: wp.cricherosUsername,
          cricherosId: wp.cricherosId,
          isCaptain: wp.isCaptain,
          teamId: realTeamId,
          isActive: wp.isActive
        };
        let savedId: number;
        if (wp.id) {
          playerData.id = wp.id;
          await this.db.savePlayer(playerData);
          savedId = wp.id;
        } else {
          savedId = (await this.db.savePlayer(playerData)) as number;
        }
        savedPlayers.push({ ...playerData, id: savedId });
      }

      // Build player snapshot
      const playerSnapshot: { [id: number]: Player } = {};
      savedPlayers.forEach(p => { playerSnapshot[p.id!] = p; });

      // Build auction team entries
      const auctionTeams: AuctionTeamEntry[] = savedTeams.map(st => {
        const captain = savedPlayers.find(p => p.isCaptain && p.teamId === st.id);
        return {
          teamId: st.id,
          teamName: st.name,
          captainId: captain?.id || 0,
          captainName: captain?.name || 'Unknown',
          memberIds: []
        };
      });

      // Non-captain active players are available for auction
      const availablePlayers = savedPlayers
        .filter(p => !p.isCaptain && p.isActive)
        .map(p => p.id!);

      const auction: ActiveAuction = {
        createdAt: new Date().toISOString(),
        status: 'active',
        coreMembersCount: this.coreMembersCount(),
        teams: auctionTeams,
        teamOrder: [],
        currentTeamIndex: 0,
        availablePlayers,
        unsoldPlayers: [],
        completedTeamIds: [],
        currentPlayerId: null,
        phase: 'shuffling',
        playerSnapshot
      };

      await this.db.saveCurrentAuction(auction);
      this.auctionStarted.emit(auction);
    } catch (err) {
      console.error(err);
      this.step3Error.set('Failed to save. Please try again.');
    } finally {
      this.finishing.set(false);
    }
  }
}
