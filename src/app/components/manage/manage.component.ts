import {
  Component, OnInit, Output, EventEmitter, signal, computed, inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DbService } from '../../services/db.service';
import { Team, Player } from '../../models/models';

type Tab = 'players' | 'teams';

interface PlayerRow extends Player {
  id: number;
  teamName: string;
  editing: boolean;
  editName: string;
  editUsername: string;
  editCricherosId: string;
  editTeamId: number | null;
  editIsCaptain: boolean;
}

interface TeamRow extends Team {
  id: number;
  captainName: string;
  playerCount: number;
  editing: boolean;
  editName: string;
  changingCaptain: boolean;
}

@Component({
  selector: 'app-manage',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="overlay" (click)="onOverlayClick($event)">
      <div class="modal-box">

        <!-- Header -->
        <div class="modal-header">
          <div class="header-left">
            <span class="modal-title">⚙️ Manage</span>
            <div class="tabs">
              <button class="tab-btn" [class.active]="tab() === 'players'" (click)="tab.set('players')">
                🏏 Players
              </button>
              <button class="tab-btn" [class.active]="tab() === 'teams'" (click)="tab.set('teams')">
                👥 Teams
              </button>
            </div>
          </div>
          <button class="btn-close" (click)="close.emit()">✕</button>
        </div>

        <!-- ══ PLAYERS TAB ══ -->
        @if (tab() === 'players') {
          <div class="modal-body">

            <!-- Add Player Form -->
            <div class="add-section">
              <button class="btn-add-toggle" (click)="showAddPlayer.set(!showAddPlayer())">
                {{ showAddPlayer() ? '✕ Cancel' : '+ Add Player' }}
              </button>
              @if (showAddPlayer()) {
                <div class="add-form">
                  <div class="form-grid">
                    <div class="form-field">
                      <label>Name *</label>
                      <input [(ngModel)]="newPlayer.name" placeholder="Full name" />
                    </div>
                    <div class="form-field">
                      <label>Team</label>
                      <select [(ngModel)]="newPlayer.teamId">
                        <option [ngValue]="null">— Unassigned —</option>
                        @for (t of activeTeams(); track t.id) {
                          <option [ngValue]="t.id">{{ t.name }}</option>
                        }
                      </select>
                    </div>
                    <div class="form-field">
                      <label>Cricheroes Username</label>
                      <input [(ngModel)]="newPlayer.cricherosUsername" placeholder="username" />
                    </div>
                    <div class="form-field">
                      <label>Cricheroes ID</label>
                      <input [(ngModel)]="newPlayer.cricherosId" placeholder="numeric ID" />
                    </div>
                  </div>
                  <div class="form-check">
                    <label class="check-label">
                      <input type="checkbox" [(ngModel)]="newPlayer.isCaptain" />
                      Set as team captain
                    </label>
                  </div>
                  @if (addPlayerError()) {
                    <p class="form-error">{{ addPlayerError() }}</p>
                  }
                  <div class="form-actions">
                    <button class="btn-save-add" (click)="addPlayer()">Save Player</button>
                  </div>
                </div>
              }
            </div>

            <!-- Active Players List -->
            <div class="section-label">Active Players ({{ activePlayers().length }})</div>
            @if (activePlayers().length === 0) {
              <div class="empty-state">No active players. Add some above.</div>
            } @else {
              @for (p of activePlayers(); track p.id; let i = $index) {
                <div class="player-row" [class.editing-row]="p.editing">
                  <div class="pr-index">{{ i + 1 }}</div>
                  <div class="pr-info">
                    <div class="pr-name-row">
                      <span class="pr-name">{{ p.name }}</span>
                      @if (p.isCaptain) { <span class="badge captain-badge">👑 Captain</span> }
                      @if (p.teamName) { <span class="badge team-badge">{{ p.teamName }}</span> }
                    </div>
                    @if (p.cricherosUsername) {
                      <span class="pr-sub">&#64;{{ p.cricherosUsername }}
                        @if (p.cricherosId) { &nbsp;· ID: {{ p.cricherosId }} }
                      </span>
                    }
                  </div>
                  <div class="pr-actions">
                    <button class="btn-icon edit-btn" (click)="startEditPlayer(p)" title="Edit">✏️</button>
                    <button class="btn-icon deact-btn" (click)="deactivatePlayer(p)" title="Deactivate">🗑</button>
                  </div>
                </div>

                @if (p.editing) {
                  <div class="inline-edit-form">
                    <div class="form-grid">
                      <div class="form-field">
                        <label>Name</label>
                        <input [(ngModel)]="p.editName" />
                      </div>
                      <div class="form-field">
                        <label>Team</label>
                        <select [(ngModel)]="p.editTeamId">
                          <option [ngValue]="null">— Unassigned —</option>
                          @for (t of activeTeams(); track t.id) {
                            <option [ngValue]="t.id">{{ t.name }}</option>
                          }
                        </select>
                      </div>
                      <div class="form-field">
                        <label>Cricheroes Username</label>
                        <input [(ngModel)]="p.editUsername" placeholder="username" />
                      </div>
                      <div class="form-field">
                        <label>Cricheroes ID</label>
                        <input [(ngModel)]="p.editCricherosId" placeholder="numeric ID" />
                      </div>
                    </div>
                    <div class="form-check">
                      <label class="check-label">
                        <input type="checkbox" [(ngModel)]="p.editIsCaptain" />
                        Team captain
                      </label>
                    </div>
                    <div class="form-actions">
                      <button class="btn-ghost-sm" (click)="cancelEditPlayer(p)">Cancel</button>
                      <button class="btn-save-sm" (click)="saveEditPlayer(p)">Save</button>
                    </div>
                  </div>
                }
              }
            }

            <!-- Inactive Players -->
            @if (inactivePlayers().length > 0) {
              <div class="section-label inactive-label" style="margin-top:24px; cursor:pointer"
                (click)="showInactive.set(!showInactive())">
                Inactive Players ({{ inactivePlayers().length }}) {{ showInactive() ? '▲' : '▼' }}
              </div>
              @if (showInactive()) {
                @for (p of inactivePlayers(); track p.id; let i = $index) {
                  <div class="player-row inactive-row">
                    <div class="pr-index dim">{{ i + 1 }}</div>
                    <div class="pr-info">
                      <span class="pr-name dim">{{ p.name }}</span>
                      @if (p.teamName) { <span class="badge team-badge dim">{{ p.teamName }}</span> }
                    </div>
                    <div class="pr-actions">
                      <button class="btn-icon react-btn" (click)="reactivatePlayer(p)" title="Reactivate">♻️</button>
                    </div>
                  </div>
                }
              }
            }

          </div>
        }

        <!-- ══ TEAMS TAB ══ -->
        @if (tab() === 'teams') {
          <div class="modal-body">

            <!-- Add Team -->
            <div class="add-section">
              <button class="btn-add-toggle" (click)="showAddTeam.set(!showAddTeam())">
                {{ showAddTeam() ? '✕ Cancel' : '+ Add Team' }}
              </button>
              @if (showAddTeam()) {
                <div class="add-form">
                  <div class="form-field">
                    <label>Team Name *</label>
                    <input [(ngModel)]="newTeamName" placeholder="e.g. Thunder Strikers" />
                  </div>
                  @if (addTeamError()) {
                    <p class="form-error">{{ addTeamError() }}</p>
                  }
                  <div class="form-actions">
                    <button class="btn-save-add" (click)="addTeam()">Save Team</button>
                  </div>
                </div>
              }
            </div>

            <!-- Active Teams -->
            <div class="section-label">Active Teams ({{ activeTeams().length }})</div>
            @if (activeTeams().length === 0) {
              <div class="empty-state">No teams yet. Add one above.</div>
            } @else {
              @for (t of teamRows(); track t.id; let i = $index) {
                @if (t.isActive) {
                  <div class="team-row" [class.editing-row]="t.editing || t.changingCaptain">
                    <div class="tr-index">{{ i + 1 }}</div>
                    <div class="tr-info">
                      @if (!t.editing) {
                        <span class="tr-name">{{ t.name }}</span>
                      } @else {
                        <input class="tr-edit-input" [(ngModel)]="t.editName" (keyup.enter)="saveTeamName(t)" />
                      }
                      <div class="tr-meta">
                        <span class="tr-captain">👑 {{ t.captainName || 'No captain assigned' }}</span>
                        <span class="tr-count">{{ t.playerCount }} player{{ t.playerCount !== 1 ? 's' : '' }}</span>
                      </div>
                    </div>
                    <div class="tr-actions">
                      @if (!t.editing) {
                        <button class="btn-icon edit-btn" (click)="t.editing = true; t.editName = t.name" title="Rename">✏️</button>
                      } @else {
                        <button class="btn-icon edit-btn" (click)="saveTeamName(t)" title="Save">✓</button>
                        <button class="btn-icon" (click)="t.editing = false" title="Cancel">✕</button>
                      }
                      <button class="btn-icon captain-btn" (click)="t.changingCaptain = !t.changingCaptain" title="Change Captain">👑</button>
                      <button class="btn-icon deact-btn" (click)="deactivateTeam(t)" title="Deactivate">🗑</button>
                    </div>
                  </div>

                  @if (t.changingCaptain) {
                    <div class="captain-picker">
                      <p class="captain-picker-label">Select new captain for {{ t.name }}:</p>
                      <div class="captain-list">
                        @for (p of playersForTeam(t.id); track p.id; let pi = $index) {
                          <div class="captain-option" [class.current-captain]="p.isCaptain"
                            (click)="setCaptain(t, p)">
                            <span class="co-index">{{ pi + 1 }}</span>
                            <span class="co-name">{{ p.name }}</span>
                            @if (p.isCaptain) { <span class="co-current">current</span> }
                          </div>
                        }
                        @if (playersForTeam(t.id).length === 0) {
                          <p class="no-players-hint">No active players assigned to this team.</p>
                        }
                      </div>
                    </div>
                  }
                }
              }
            }

            <!-- Inactive Teams -->
            @if (inactiveTeams().length > 0) {
              <div class="section-label inactive-label" style="margin-top:24px; cursor:pointer"
                (click)="showInactiveTeams.set(!showInactiveTeams())">
                Inactive Teams ({{ inactiveTeams().length }}) {{ showInactiveTeams() ? '▲' : '▼' }}
              </div>
              @if (showInactiveTeams()) {
                @for (t of inactiveTeams(); track t.id; let i = $index) {
                  <div class="team-row inactive-row">
                    <div class="tr-index dim">{{ i + 1 }}</div>
                    <div class="tr-info"><span class="tr-name dim">{{ t.name }}</span></div>
                    <div class="tr-actions">
                      <button class="btn-icon react-btn" (click)="reactivateTeam(t)" title="Reactivate">♻️</button>
                    </div>
                  </div>
                }
              }
            }

          </div>
        }

      </div>
    </div>
  `,
  styles: [`
    .overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.78); backdrop-filter: blur(5px);
      display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .modal-box {
      background: #0f172a; border: 1px solid #334155; border-radius: 16px;
      width: 92vw; max-width: 820px; max-height: 90vh;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .modal-header {
      padding: 14px 20px; border-bottom: 1px solid #334155;
      display: flex; align-items: center; justify-content: space-between;
      background: #1e293b; flex-shrink: 0;
    }
    .header-left { display: flex; align-items: center; gap: 18px; }
    .modal-title { font-size: 1.1rem; font-weight: 700; color: #f8fafc; }
    .tabs { display: flex; gap: 4px; }
    .tab-btn {
      padding: 6px 14px; border-radius: 8px; border: 1px solid #334155;
      background: transparent; color: #64748b; font-size: 0.82rem; font-weight: 600;
      cursor: pointer; transition: all 0.2s;
    }
    .tab-btn.active { background: #22c55e; border-color: #22c55e; color: #0f172a; }
    .tab-btn:hover:not(.active) { border-color: #475569; color: #94a3b8; }
    .btn-close {
      width: 32px; height: 32px; border-radius: 8px; background: #334155;
      border: none; color: #94a3b8; cursor: pointer; font-size: 0.9rem; transition: all 0.2s;
    }
    .btn-close:hover { background: #475569; color: #f8fafc; }

    .modal-body { flex: 1; overflow-y: auto; padding: 16px 20px; }

    /* Add section */
    .add-section { margin-bottom: 18px; }
    .btn-add-toggle {
      background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.4);
      color: #22c55e; padding: 8px 16px; border-radius: 8px;
      font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .btn-add-toggle:hover { background: rgba(34,197,94,0.2); }
    .add-form {
      background: #1e293b; border: 1px solid #334155; border-radius: 10px;
      padding: 16px; margin-top: 10px;
    }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
    .form-field { display: flex; flex-direction: column; gap: 5px; }
    .form-field label { font-size: 0.72rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .form-field input, .form-field select {
      background: #0f172a; border: 1px solid #334155; color: #e2e8f0;
      border-radius: 7px; padding: 8px 10px; font-size: 0.85rem; outline: none; transition: border-color 0.2s;
    }
    .form-field input:focus, .form-field select:focus { border-color: #22c55e; }
    .form-field select option { background: #1e293b; }
    .form-check { margin-bottom: 12px; }
    .check-label { display: flex; align-items: center; gap: 8px; font-size: 0.83rem; color: #94a3b8; cursor: pointer; }
    .check-label input[type=checkbox] { width: 15px; height: 15px; accent-color: #22c55e; }
    .form-error { font-size: 0.78rem; color: #ef4444; margin: 0 0 8px; }
    .form-actions { display: flex; justify-content: flex-end; }
    .btn-save-add {
      background: #22c55e; border: none; color: #0f172a;
      border-radius: 8px; padding: 8px 18px; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s;
    }
    .btn-save-add:hover { opacity: 0.85; }

    /* Section label */
    .section-label {
      font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
      color: #475569; margin: 0 0 10px; padding-bottom: 6px; border-bottom: 1px solid #1e293b;
    }
    .inactive-label { color: #334155; }
    .empty-state { color: #475569; font-size: 0.85rem; padding: 16px 0; text-align: center; }

    /* Player row */
    .player-row {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 12px; border-radius: 8px; margin-bottom: 2px;
      background: #1e293b; border: 1px solid #1e293b; transition: border-color 0.2s;
    }
    .player-row:hover { border-color: #334155; }
    .player-row.editing-row { border-color: #22c55e; border-radius: 8px 8px 0 0; margin-bottom: 0; }
    .player-row.inactive-row { opacity: 0.5; }
    .pr-index {
      width: 26px; height: 26px; border-radius: 50%; background: #334155;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.72rem; font-weight: 700; color: #94a3b8; flex-shrink: 0;
    }
    .pr-index.dim { background: #1e293b; color: #475569; }
    .pr-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
    .pr-name-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .pr-name { font-size: 0.9rem; font-weight: 600; color: #f8fafc; }
    .pr-name.dim { color: #475569; }
    .pr-sub { font-size: 0.72rem; color: #64748b; }
    .pr-actions { display: flex; gap: 4px; flex-shrink: 0; }
    .badge { padding: 2px 8px; border-radius: 99px; font-size: 0.68rem; font-weight: 600; }
    .captain-badge { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .team-badge { background: #334155; color: #94a3b8; }
    .team-badge.dim { opacity: 0.5; }

    .btn-icon {
      width: 30px; height: 30px; border-radius: 7px; border: 1px solid #334155;
      background: transparent; cursor: pointer; font-size: 0.82rem; transition: all 0.2s;
      display: flex; align-items: center; justify-content: center;
    }
    .edit-btn:hover { background: rgba(59,130,246,0.15); border-color: #3b82f6; }
    .deact-btn:hover { background: rgba(239,68,68,0.15); border-color: #ef4444; }
    .react-btn:hover { background: rgba(34,197,94,0.15); border-color: #22c55e; }
    .captain-btn:hover { background: rgba(245,158,11,0.15); border-color: #f59e0b; }

    /* Inline edit */
    .inline-edit-form {
      background: #1e293b; border: 1px solid #22c55e; border-top: none;
      border-radius: 0 0 8px 8px; padding: 14px 12px; margin-bottom: 8px;
    }
    .btn-ghost-sm {
      background: transparent; border: 1px solid #334155; color: #64748b;
      border-radius: 6px; padding: 6px 12px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;
    }
    .btn-ghost-sm:hover { border-color: #94a3b8; color: #94a3b8; }
    .btn-save-sm {
      background: #22c55e; border: none; color: #0f172a;
      border-radius: 6px; padding: 6px 12px; font-size: 0.8rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s;
    }
    .btn-save-sm:hover { opacity: 0.85; }

    /* Team rows */
    .team-row {
      display: flex; align-items: center; gap: 12px;
      padding: 12px 14px; border-radius: 8px; margin-bottom: 2px;
      background: #1e293b; border: 1px solid #1e293b; transition: border-color 0.2s;
    }
    .team-row:hover { border-color: #334155; }
    .team-row.editing-row { border-color: #22c55e; }
    .team-row.inactive-row { opacity: 0.5; margin-bottom: 2px; }
    .tr-index {
      width: 28px; height: 28px; border-radius: 50%; background: #334155;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.75rem; font-weight: 700; color: #94a3b8; flex-shrink: 0;
    }
    .tr-index.dim { background: #1e293b; color: #475569; }
    .tr-info { flex: 1; min-width: 0; }
    .tr-name { font-size: 0.95rem; font-weight: 700; color: #f8fafc; }
    .tr-name.dim { color: #475569; }
    .tr-edit-input {
      background: #0f172a; border: 1px solid #22c55e; color: #f8fafc;
      border-radius: 6px; padding: 5px 9px; font-size: 0.9rem; font-weight: 700; outline: none; width: 200px;
    }
    .tr-meta { display: flex; align-items: center; gap: 14px; margin-top: 3px; }
    .tr-captain { font-size: 0.75rem; color: #94a3b8; }
    .tr-count { font-size: 0.72rem; color: #475569; }
    .tr-actions { display: flex; gap: 4px; flex-shrink: 0; }

    /* Captain picker */
    .captain-picker {
      background: #0f172a; border: 1px solid #f59e0b44; border-radius: 0 0 8px 8px;
      padding: 12px 14px; margin-bottom: 8px; margin-top: -2px;
    }
    .captain-picker-label { font-size: 0.78rem; color: #94a3b8; margin: 0 0 10px; }
    .captain-list { display: flex; flex-direction: column; gap: 4px; }
    .captain-option {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px; border-radius: 7px; border: 1px solid #1e293b;
      background: #1e293b; cursor: pointer; transition: all 0.2s;
    }
    .captain-option:hover { border-color: #f59e0b; background: rgba(245,158,11,0.05); }
    .captain-option.current-captain { border-color: #f59e0b44; background: rgba(245,158,11,0.08); }
    .co-index { width: 22px; height: 22px; border-radius: 50%; background: #334155; display: flex; align-items: center; justify-content: center; font-size: 0.68rem; font-weight: 700; color: #64748b; flex-shrink: 0; }
    .co-name { font-size: 0.85rem; color: #e2e8f0; flex: 1; }
    .co-current { font-size: 0.68rem; color: #f59e0b; font-weight: 700; }
    .no-players-hint { font-size: 0.8rem; color: #475569; margin: 0; padding: 8px 0; }
  `]
})
export class ManageComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private db = inject(DbService);

  tab = signal<Tab>('players');
  loading = signal(true);

  allPlayers = signal<Player[]>([]);
  allTeams = signal<Team[]>([]);

  // Add player form
  showAddPlayer = signal(false);
  addPlayerError = signal('');
  newPlayer = { name: '', teamId: null as number | null, cricherosUsername: '', cricherosId: '', isCaptain: false };

  // Add team form
  showAddTeam = signal(false);
  addTeamError = signal('');
  newTeamName = '';

  // Inactive toggles
  showInactive = signal(false);
  showInactiveTeams = signal(false);

  // Derived lists
  activeTeams = computed(() => this.allTeams().filter(t => t.isActive));
  inactiveTeams = computed(() => this.allTeams().filter(t => !t.isActive) as TeamRow[]);

  activePlayers = computed((): PlayerRow[] => {
    return this.allPlayers()
      .filter(p => p.isActive)
      .map(p => ({
        ...p,
        id: p.id!,
        teamName: this.teamName(p.teamId),
        editing: false,
        editName: p.name,
        editUsername: p.cricherosUsername || '',
        editCricherosId: p.cricherosId || '',
        editTeamId: p.teamId ?? null,
        editIsCaptain: p.isCaptain
      }));
  });

  inactivePlayers = computed((): PlayerRow[] => {
    return this.allPlayers()
      .filter(p => !p.isActive)
      .map(p => ({
        ...p,
        id: p.id!,
        teamName: this.teamName(p.teamId),
        editing: false,
        editName: p.name,
        editUsername: p.cricherosUsername || '',
        editCricherosId: p.cricherosId || '',
        editTeamId: p.teamId ?? null,
        editIsCaptain: p.isCaptain
      }));
  });

  teamRows = computed((): TeamRow[] => {
    return this.allTeams().map(t => ({
      ...t,
      id: t.id!,
      captainName: this.captainNameForTeam(t.id!),
      playerCount: this.allPlayers().filter(p => p.isActive && p.teamId === t.id).length,
      editing: false,
      editName: t.name,
      changingCaptain: false
    }));
  });

  async ngOnInit() {
    await this.reload();
  }

  private async reload() {
    const [teams, players] = await Promise.all([this.db.getTeams(), this.db.getPlayers()]);
    this.allTeams.set(teams);
    this.allPlayers.set(players);
    this.loading.set(false);
  }

  private teamName(teamId: number | undefined): string {
    if (!teamId) return '';
    return this.allTeams().find(t => t.id === teamId)?.name || '';
  }

  private captainNameForTeam(teamId: number): string {
    return this.allPlayers().find(p => p.isActive && p.teamId === teamId && p.isCaptain)?.name || '—';
  }

  playersForTeam(teamId: number): PlayerRow[] {
    return this.activePlayers().filter(p => p.teamId === teamId);
  }

  // ── Add Player ─────────────────────────────────────────────────
  async addPlayer() {
    this.addPlayerError.set('');
    if (!this.newPlayer.name.trim()) { this.addPlayerError.set('Name is required.'); return; }

    // If marking as captain, remove existing captain from that team
    if (this.newPlayer.isCaptain && this.newPlayer.teamId) {
      await this.removeCaptainFromTeam(this.newPlayer.teamId);
    }

    await this.db.savePlayer({
      name: this.newPlayer.name.trim(),
      teamId: this.newPlayer.teamId ?? undefined,
      cricherosUsername: this.newPlayer.cricherosUsername.trim() || undefined,
      cricherosId: this.newPlayer.cricherosId.trim() || undefined,
      isCaptain: this.newPlayer.isCaptain,
      isActive: true
    });

    this.newPlayer = { name: '', teamId: null, cricherosUsername: '', cricherosId: '', isCaptain: false };
    this.showAddPlayer.set(false);
    await this.reload();
  }

  // ── Edit Player ────────────────────────────────────────────────
  startEditPlayer(p: PlayerRow) {
    // Close any other open edits first
    this.activePlayers().forEach(ap => { if (ap.id !== p.id) ap.editing = false; });
    p.editing = !p.editing;
  }

  cancelEditPlayer(p: PlayerRow) { p.editing = false; }

  async saveEditPlayer(p: PlayerRow) {
    if (!p.editName.trim()) return;

    // If setting as captain and there's another captain in the same team, demote them
    if (p.editIsCaptain && p.editTeamId) {
      const existingCap = this.allPlayers().find(
        x => x.isCaptain && x.teamId === p.editTeamId && x.id !== p.id && x.isActive
      );
      if (existingCap) {
        await this.db.savePlayer({ ...existingCap, isCaptain: false });
      }
    }

    await this.db.savePlayer({
      ...this.allPlayers().find(x => x.id === p.id)!,
      name: p.editName.trim(),
      teamId: p.editTeamId ?? undefined,
      cricherosUsername: p.editUsername.trim() || undefined,
      cricherosId: p.editCricherosId.trim() || undefined,
      isCaptain: p.editIsCaptain
    });

    p.editing = false;
    await this.reload();
  }

  // ── Deactivate / Reactivate Player ────────────────────────────
  async deactivatePlayer(p: PlayerRow) {
    const player = this.allPlayers().find(x => x.id === p.id)!;
    await this.db.savePlayer({ ...player, isActive: false, isCaptain: false });
    await this.reload();
  }

  async reactivatePlayer(p: PlayerRow) {
    const player = this.allPlayers().find(x => x.id === p.id)!;
    await this.db.savePlayer({ ...player, isActive: true });
    await this.reload();
  }

  // ── Teams ──────────────────────────────────────────────────────
  async addTeam() {
    this.addTeamError.set('');
    if (!this.newTeamName.trim()) { this.addTeamError.set('Team name is required.'); return; }
    await this.db.saveTeam({ name: this.newTeamName.trim(), isActive: true });
    this.newTeamName = '';
    this.showAddTeam.set(false);
    await this.reload();
  }

  async saveTeamName(t: TeamRow) {
    if (!t.editName.trim()) return;
    const team = this.allTeams().find(x => x.id === t.id)!;
    await this.db.saveTeam({ ...team, name: t.editName.trim() });
    t.editing = false;
    await this.reload();
  }

  async deactivateTeam(t: TeamRow) {
    const team = this.allTeams().find(x => x.id === t.id)!;
    await this.db.saveTeam({ ...team, isActive: false });
    await this.reload();
  }

  async reactivateTeam(t: TeamRow) {
    const team = this.allTeams().find(x => x.id === t.id)!;
    await this.db.saveTeam({ ...team, isActive: true });
    await this.reload();
  }

  async setCaptain(t: TeamRow, p: PlayerRow) {
    // Demote existing captain
    await this.removeCaptainFromTeam(t.id);
    // Promote new captain
    const player = this.allPlayers().find(x => x.id === p.id)!;
    await this.db.savePlayer({ ...player, isCaptain: true, teamId: t.id });
    t.changingCaptain = false;
    await this.reload();
  }

  private async removeCaptainFromTeam(teamId: number) {
    const currentCap = this.allPlayers().find(p => p.isCaptain && p.teamId === teamId && p.isActive);
    if (currentCap) {
      await this.db.savePlayer({ ...currentCap, isCaptain: false });
    }
  }

  onOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('overlay')) this.close.emit();
  }
}
