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
  template: `
    <div class="ww-overlay">
      <div class="ww-container">

        <!-- Header -->
        <div class="ww-header">
          <span class="ww-title">⚡ Weekly Auction Setup</span>
          <button class="ww-close" (click)="cancel.emit()">✕</button>
        </div>

        <!-- Step indicator -->
        <div class="step-bar">
          @for (s of steps; track s.n) {
            <div class="step-item" [class.active]="step() === s.n" [class.done]="step() > s.n">
              <div class="step-circle">{{ step() > s.n ? '✓' : s.n }}</div>
              <span class="step-label">{{ s.label }}</span>
            </div>
            @if (s.n < steps.length) { <div class="step-line" [class.done]="step() > s.n"></div> }
          }
        </div>

        <!-- ── STEP 1: Select past auction ── -->
        @if (step() === 1) {
          <div class="ww-body">
            <h2 class="step-heading">Select a past auction</h2>
            @if (loading()) {
              <div class="ww-loading">Loading history...</div>
            } @else if (history().length === 0) {
              <div class="ww-empty">No completed auctions found. Run a main auction first.</div>
            } @else {
              <div class="history-list">
                @for (rec of history(); track rec.id) {
                  <div class="history-card" [class.selected]="selectedHistoryId() === rec.id"
                    [class.legacy-card]="!isNewFormat(rec)"
                    (click)="selectHistory(rec)">
                    <div class="hc-top">
                      <span class="hc-date">{{ formatDate(rec.createdAt) }}</span>
                      <div class="hc-top-right">
                        @if (!isNewFormat(rec)) {
                          <span class="hc-legacy-badge" title="Saved before weekly auction support — cannot be used">⚠ Legacy</span>
                        } @else {
                          <span class="hc-compat-badge">✓ Compatible</span>
                        }
                        <span class="hc-teams">{{ rec.teamSummaries.length }} teams</span>
                      </div>
                    </div>
                    <div class="hc-teams-list">
                      @for (ts of rec.teamSummaries; track ts.teamId) {
                        <span class="hc-team-chip">{{ ts.teamName }}</span>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- ── STEP 2: Select 2 teams ── -->
        @if (step() === 2) {
          <div class="ww-body">
            <h2 class="step-heading">Select the 2 teams playing this week</h2>
            @if (selectedHistory()) {
              <div class="team-grid">
                @for (ts of selectedHistory()!.teamSummaries; track ts.teamId) {
                  <div class="team-sel-card"
                    [class.selected]="isTeamSelected(ts.teamId)"
                    [class.disabled]="!isTeamSelected(ts.teamId) && selectedTeamIds().length >= 2"
                    (click)="toggleTeam(ts.teamId)">
                    <div class="tsc-check">{{ isTeamSelected(ts.teamId) ? '✓' : '' }}</div>
                    <div class="tsc-name">{{ ts.teamName }}</div>
                    <div class="tsc-captain">👑 {{ ts.captainName }}</div>
                  </div>
                }
              </div>
              @if (selectedTeamIds().length === 2) {
                <p class="sel-hint">Both teams selected. Click Next to continue.</p>
              } @else {
                <p class="sel-hint">Select exactly 2 teams ({{ selectedTeamIds().length }}/2 selected)</p>
              }
            }
          </div>
        }

        <!-- ── STEP 3: Core member availability ── -->
        @if (step() === 3) {
          <div class="ww-body">
            <h2 class="step-heading">Core member availability</h2>
            <p class="step-sub">Mark who can play this week. Unavailable members sit out — their slots open up for extra pool picks. If the captain is absent, assign a temp captain from available core members.</p>
            @for (teamAvail of coreAvailability(); track teamAvail.teamId) {
              <div class="avail-team-section">
                <div class="avail-team-header">
                  <span class="avail-team-name">{{ teamAvail.teamName }}</span>
                </div>
                <!-- Members list (wrapped so temp-captain-row can attach below) -->
                <div class="avail-members" [class.has-absent-cap]="isCaptainAbsent(teamAvail)">
                  @for (member of teamAvail.members; track member.id) {
                    <div class="avail-row"
                      [class.captain-row]="member.isCaptain"
                      [class.row-unavail]="!member.available">
                      <div class="avail-info">
                        <span class="avail-name">{{ member.name }}</span>
                        @if (member.isCaptain) {
                          <span class="captain-badge" [class.badge-absent]="!member.available">
                            {{ member.available ? '👑 Captain' : '👑 Captain – Absent' }}
                          </span>
                        }
                      </div>
                      <div class="avail-toggle">
                        <button class="toggle-btn" [class.avail]="member.available"
                          (click)="setMemberAvailability(teamAvail, member, true)">
                          Available
                        </button>
                        <button class="toggle-btn" [class.unavail]="!member.available"
                          (click)="setMemberAvailability(teamAvail, member, false)">
                          Unavailable
                        </button>
                      </div>
                    </div>
                  }
                </div>
                <!-- Temp captain selector — shown when captain is absent -->
                @if (isCaptainAbsent(teamAvail)) {
                  <div class="temp-captain-row">
                    <div class="tc-label">⚠ Captain absent — select a temp captain for this match:</div>
                    @if (getAvailableCoreMembers(teamAvail).length === 0) {
                      <div class="tc-no-options">No available core members. Mark at least one member as available to assign a temp captain.</div>
                    } @else {
                      <div class="tc-options">
                        @for (cm of getAvailableCoreMembers(teamAvail); track cm.id) {
                          <button class="tc-option" [class.tc-selected]="teamAvail.tempCaptainId === cm.id"
                            (click)="setTempCaptain(teamAvail, cm.id)">
                            {{ cm.name }}
                            @if (teamAvail.tempCaptainId === cm.id) {
                              <span class="tc-check">✓</span>
                            }
                          </button>
                        }
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- ── STEP 4: Other player availability ── -->
        @if (step() === 4) {
          <div class="ww-body">
            <h2 class="step-heading">Other player availability</h2>
            <p class="step-sub">Mark who's available from the pool. Use "Add Temp Player" at the bottom to add anyone not in the system.</p>

            @if (otherPlayers().length > 0) {
              @for (p of otherPlayers(); track p.id) {
                <div class="other-row">
                  <div class="other-info">
                    <span class="other-name">{{ p.name }}</span>
                    @if (p.username) { <span class="other-sub">&#64;{{ p.username }}</span> }
                  </div>
                  <div class="other-avail-toggle">
                    <button class="toggle-btn sm" [class.avail]="p.available"
                      (click)="p.available = true; p.tempName = ''">
                      Available
                    </button>
                    <button class="toggle-btn sm" [class.unavail]="!p.available"
                      (click)="p.available = false">
                      Unavailable
                    </button>
                  </div>
                  @if (!p.available) {
                    <input class="temp-input" [(ngModel)]="p.tempName"
                      placeholder="Replacement name (optional)" />
                  }
                </div>
              }
            } @else {
              <div class="ww-empty-inline">No other players in the pool for this auction.</div>
            }

            <!-- ── Add extra temp players ── -->
            <div class="extra-temp-section">
              <div class="extra-temp-header">
                <span class="extra-temp-title">➕ Add Temp Players</span>
                <span class="extra-temp-hint">One-off players for this week only (not saved to your roster)</span>
              </div>

              @if (extraTempPlayers().length > 0) {
                <div class="extra-temp-list">
                  @for (tp of extraTempPlayers(); track $index; let i = $index) {
                    <div class="extra-temp-item">
                      <span class="extra-temp-idx">{{ i + 1 }}.</span>
                      <span class="extra-temp-name">{{ tp }}</span>
                      <button class="extra-temp-remove" (click)="removeExtraTemp(i)" title="Remove">✕</button>
                    </div>
                  }
                </div>
              }

              <div class="extra-temp-add-row">
                <input class="temp-input extra-temp-input" [(ngModel)]="newTempName"
                  placeholder="Player name"
                  (keydown.enter)="addExtraTemp()" />
                <button class="btn-add-temp" (click)="addExtraTemp()"
                  [disabled]="!newTempName.trim()">
                  + Add
                </button>
              </div>
            </div>

          </div>
        }

        <!-- Footer -->
        <div class="ww-footer">
          @if (step() >= 3) {
            <div class="total-counter" [class.total-ok]="weeklyTotal() >= 22 && weeklyTotal() <= 24"
              [class.total-low]="weeklyTotal() < 22" [class.total-high]="weeklyTotal() > 24">
              <span class="total-label">Total players:</span>
              <span class="total-val">{{ weeklyTotal() }}</span>
              <span class="total-range">/ target 22–24</span>
              @if (weeklyTotal() < 22) {
                <span class="total-hint">need {{ 22 - weeklyTotal() }} more</span>
              } @else if (weeklyTotal() > 24) {
                <span class="total-hint">{{ weeklyTotal() - 24 }} too many</span>
              }
            </div>
          }
          @if (errorMsg()) {
            <span class="ww-error">{{ errorMsg() }}</span>
          }
          <div class="footer-btns">
            @if (step() > 1) {
              <button class="btn-back" (click)="prevStep()">← Back</button>
            }
            @if (step() < 4) {
              <button class="btn-next" (click)="nextStep()" [disabled]="!canNext()">
                Next →
              </button>
            } @else {
              <button class="btn-start" (click)="startWeeklyAuction()" [disabled]="saving()">
                {{ saving() ? 'Starting...' : '⚡ Start Weekly Auction' }}
              </button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .ww-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.82); backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .ww-container {
      background: #0f172a; border: 1px solid #334155; border-radius: 16px;
      width: 700px; max-width: 96vw; max-height: 90vh;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .ww-header {
      padding: 18px 24px; border-bottom: 1px solid #334155;
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    .ww-title { font-size: 1.15rem; font-weight: 700; color: #f8fafc; }
    .ww-close {
      background: none; border: none; color: #64748b; font-size: 1.1rem;
      cursor: pointer; padding: 4px 8px; border-radius: 6px; transition: all 0.2s;
    }
    .ww-close:hover { color: #f8fafc; background: #1e293b; }

    /* Step bar */
    .step-bar {
      display: flex; align-items: center; padding: 16px 24px; flex-shrink: 0;
      border-bottom: 1px solid #1e293b; gap: 0;
    }
    .step-item { display: flex; align-items: center; gap: 8px; }
    .step-circle {
      width: 28px; height: 28px; border-radius: 50%; border: 2px solid #334155;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.78rem; font-weight: 700; color: #64748b; flex-shrink: 0; transition: all 0.3s;
    }
    .step-item.active .step-circle { border-color: #22c55e; color: #22c55e; }
    .step-item.done .step-circle { border-color: #22c55e; background: #22c55e; color: #0f172a; }
    .step-label { font-size: 0.75rem; color: #64748b; white-space: nowrap; }
    .step-item.active .step-label { color: #f8fafc; }
    .step-line { flex: 1; height: 1px; background: #334155; min-width: 20px; margin: 0 8px; }
    .step-line.done { background: #22c55e; }

    /* Body */
    .ww-body { flex: 1; overflow-y: auto; padding: 20px 24px; }
    .step-heading { font-size: 1.15rem; font-weight: 700; color: #f8fafc; margin: 0 0 14px; }
    .step-sub { font-size: 0.85rem; color: #64748b; margin: -8px 0 16px; line-height: 1.5; }
    .ww-loading, .ww-empty { color: #64748b; font-size: 0.9rem; padding: 24px 0; text-align: center; }

    /* Step 1 - history list */
    .history-list { display: flex; flex-direction: column; gap: 10px; }
    .history-card {
      padding: 14px 16px; border-radius: 10px; background: #1e293b; border: 2px solid #334155;
      cursor: pointer; transition: all 0.2s;
    }
    .history-card:hover { border-color: #475569; }
    .history-card.selected { border-color: #22c55e; background: rgba(34,197,94,0.07); }
    .hc-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
    .hc-top-right { display: flex; align-items: center; gap: 8px; }
    .hc-date { font-size: 0.85rem; color: #94a3b8; font-weight: 600; }
    .hc-teams { font-size: 0.75rem; color: #64748b; }
    .hc-legacy-badge {
      font-size: 0.68rem; font-weight: 700; padding: 2px 7px; border-radius: 99px;
      background: rgba(245,158,11,0.15); color: #f59e0b; cursor: default;
    }
    .hc-compat-badge {
      font-size: 0.68rem; font-weight: 700; padding: 2px 7px; border-radius: 99px;
      background: rgba(34,197,94,0.12); color: #22c55e;
    }
    .history-card.legacy-card { opacity: 0.6; }
    .history-card.legacy-card:hover { border-color: #f59e0b44; }
    .hc-teams-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .hc-team-chip {
      background: #334155; color: #94a3b8; padding: 3px 10px;
      border-radius: 99px; font-size: 0.72rem;
    }

    /* Step 2 - team selection */
    .team-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
    .team-sel-card {
      padding: 14px; border-radius: 10px; background: #1e293b; border: 2px solid #334155;
      cursor: pointer; transition: all 0.2s; position: relative; text-align: center;
    }
    .team-sel-card:hover:not(.disabled) { border-color: #475569; }
    .team-sel-card.selected { border-color: #22c55e; background: rgba(34,197,94,0.08); }
    .team-sel-card.disabled { opacity: 0.4; cursor: not-allowed; }
    .tsc-check {
      position: absolute; top: 8px; right: 10px; color: #22c55e; font-size: 0.9rem; font-weight: 700;
    }
    .tsc-name { font-size: 1rem; font-weight: 700; color: #f8fafc; margin-bottom: 4px; }
    .tsc-captain { font-size: 0.78rem; color: #64748b; }
    .sel-hint { margin: 14px 0 0; font-size: 0.83rem; color: #64748b; text-align: center; }

    /* Step 3 - core availability */
    .avail-team-section { margin-bottom: 20px; }
    .avail-team-header {
      padding: 8px 12px; background: #1e293b; border-radius: 8px; margin-bottom: 8px;
    }
    .avail-team-name { font-size: 0.95rem; font-weight: 700; color: #f8fafc; }

    /* Members container — rounds bottom only when no temp-captain-row follows */
    .avail-members {
      border: 1px solid #334155; border-radius: 8px; overflow: hidden; margin-bottom: 6px;
    }
    .avail-members.has-absent-cap {
      border-radius: 8px 8px 0 0; margin-bottom: 0;
      border-bottom-color: transparent;
    }
    .avail-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 12px; background: #0f172a; border-bottom: 1px solid #1e293b;
    }
    .avail-row:last-child { border-bottom: none; }
    .avail-row.captain-row { background: rgba(245,158,11,0.03); }
    .avail-row.captain-row.row-unavail {
      background: rgba(239,68,68,0.05);
    }
    .avail-row.row-unavail .avail-name { color: #64748b; }
    .avail-info { display: flex; align-items: center; gap: 10px; flex: 1; }
    .avail-name { font-size: 0.88rem; color: #e2e8f0; font-weight: 500; }
    .captain-badge {
      font-size: 0.72rem; background: rgba(245,158,11,0.15); color: #f59e0b;
      padding: 2px 8px; border-radius: 99px;
    }
    .captain-badge.badge-absent {
      background: rgba(239,68,68,0.15); color: #f87171;
    }
    .avail-toggle { display: flex; gap: 6px; }

    /* Temp captain selector */
    .temp-captain-row {
      border: 1px solid #334155; border-top: 1px solid rgba(239,68,68,0.25);
      border-radius: 0 0 8px 8px; background: rgba(239,68,68,0.05);
      padding: 12px 14px; margin-bottom: 6px;
    }
    .tc-label {
      font-size: 0.78rem; font-weight: 600; color: #f87171; margin-bottom: 10px;
    }
    .tc-options { display: flex; flex-wrap: wrap; gap: 8px; }
    .tc-option {
      padding: 6px 14px; border-radius: 8px; border: 1px solid #334155;
      background: #1e293b; color: #cbd5e1; font-size: 0.82rem;
      cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px;
    }
    .tc-option:hover { border-color: #a78bfa; color: #a78bfa; }
    .tc-option.tc-selected {
      border-color: #a78bfa; background: rgba(167,139,250,0.15); color: #a78bfa; font-weight: 600;
    }
    .tc-check { color: #a78bfa; font-size: 0.75rem; font-weight: 700; }
    .tc-no-options { font-size: 0.78rem; color: #64748b; font-style: italic; }

    .ww-empty-inline { color: #64748b; font-size: 0.85rem; padding: 12px 0; font-style: italic; }

    /* Extra temp players */
    .extra-temp-section {
      margin-top: 20px; border: 1px solid #334155; border-radius: 10px;
      overflow: hidden;
    }
    .extra-temp-header {
      padding: 10px 14px; background: #1e293b;
      display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap;
    }
    .extra-temp-title { font-size: 0.88rem; font-weight: 700; color: #f8fafc; }
    .extra-temp-hint { font-size: 0.72rem; color: #64748b; }
    .extra-temp-list { padding: 8px 14px 4px; display: flex; flex-direction: column; gap: 4px; }
    .extra-temp-item {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 10px; background: rgba(167,139,250,0.07);
      border: 1px solid rgba(167,139,250,0.2); border-radius: 6px;
    }
    .extra-temp-idx { font-size: 0.7rem; color: #475569; min-width: 18px; }
    .extra-temp-name { font-size: 0.85rem; color: #cbd5e1; flex: 1; }
    .extra-temp-remove {
      background: none; border: none; color: #475569; cursor: pointer;
      font-size: 0.75rem; padding: 2px 6px; border-radius: 4px; transition: all 0.2s;
    }
    .extra-temp-remove:hover { color: #f87171; background: rgba(239,68,68,0.1); }
    .extra-temp-add-row {
      padding: 10px 14px; display: flex; gap: 8px; align-items: center;
      border-top: 1px solid #1e293b;
    }
    .extra-temp-input { flex: 1; width: auto; }
    .btn-add-temp {
      padding: 6px 16px; border-radius: 6px; border: 1px solid #a78bfa;
      background: rgba(167,139,250,0.1); color: #a78bfa;
      font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: all 0.2s; white-space: nowrap;
    }
    .btn-add-temp:hover:not(:disabled) { background: rgba(167,139,250,0.2); }
    .btn-add-temp:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Step 4 - other players */
    .other-row {
      display: flex; align-items: center; gap: 12px; padding: 10px 12px;
      border-radius: 8px; margin-bottom: 6px; background: #0f172a; border: 1px solid #334155;
      flex-wrap: wrap;
    }
    .other-info { flex: 1; min-width: 120px; }
    .other-name { font-size: 0.88rem; color: #e2e8f0; font-weight: 500; display: block; }
    .other-sub { font-size: 0.72rem; color: #64748b; }
    .other-avail-toggle { display: flex; gap: 6px; }
    .temp-input {
      border: 1px solid #334155; background: #1e293b; color: #e2e8f0;
      border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; width: 200px;
      outline: none; transition: border-color 0.2s;
    }
    .temp-input:focus { border-color: #a78bfa; }
    .temp-input::placeholder { color: #475569; }

    /* Toggle buttons */
    .toggle-btn {
      padding: 5px 12px; border-radius: 6px; border: 1px solid #334155;
      background: transparent; color: #64748b; font-size: 0.78rem; cursor: pointer; transition: all 0.2s;
    }
    .toggle-btn.sm { padding: 4px 9px; font-size: 0.72rem; }
    .toggle-btn.avail { background: rgba(34,197,94,0.15); border-color: #22c55e; color: #22c55e; }
    .toggle-btn.unavail { background: rgba(239,68,68,0.12); border-color: #ef4444; color: #ef4444; }

    /* Footer */
    .ww-footer {
      padding: 12px 24px; border-top: 1px solid #334155; flex-shrink: 0;
      display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
    }
    .total-counter {
      display: flex; align-items: center; gap: 7px;
      padding: 5px 12px; border-radius: 8px; border: 1px solid #334155;
      background: #1e293b; transition: all 0.3s;
    }
    .total-counter.total-ok { border-color: #22c55e44; background: rgba(34,197,94,0.08); }
    .total-counter.total-low { border-color: #f59e0b44; background: rgba(245,158,11,0.08); }
    .total-counter.total-high { border-color: #ef444444; background: rgba(239,68,68,0.08); }
    .total-label { font-size: 0.72rem; color: #64748b; }
    .total-val { font-size: 1rem; font-weight: 800; color: #f8fafc; }
    .total-counter.total-ok .total-val { color: #22c55e; }
    .total-counter.total-low .total-val { color: #f59e0b; }
    .total-counter.total-high .total-val { color: #ef4444; }
    .total-range { font-size: 0.7rem; color: #475569; }
    .total-hint { font-size: 0.7rem; font-weight: 700; padding: 1px 7px; border-radius: 99px; }
    .total-low .total-hint { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .total-high .total-hint { background: rgba(239,68,68,0.15); color: #ef4444; }
    .ww-error { font-size: 0.82rem; color: #ef4444; flex: 1; min-width: 0; }
    .footer-btns { display: flex; gap: 10px; margin-left: auto; }
    .btn-back {
      background: transparent; border: 1px solid #334155; color: #94a3b8;
      border-radius: 8px; padding: 9px 18px; font-size: 0.88rem; cursor: pointer; transition: all 0.2s;
    }
    .btn-back:hover { border-color: #94a3b8; color: #f8fafc; }
    .btn-next {
      background: #1e3a5f; border: 1px solid #3b82f6; color: #93c5fd;
      border-radius: 8px; padding: 9px 22px; font-size: 0.88rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .btn-next:hover:not(:disabled) { background: #1e40af; }
    .btn-next:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-start {
      background: #22c55e; border: none; color: #0f172a;
      border-radius: 8px; padding: 9px 22px; font-size: 0.88rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s;
    }
    .btn-start:hover:not(:disabled) { opacity: 0.85; }
    .btn-start:disabled { opacity: 0.45; cursor: not-allowed; }
  `]
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
        // temp captain is already an available member — don't double-count
      }
    }
    for (const op of this.otherPlayers()) {
      if (op.available) total++;
      else if (op.tempName?.trim()) total++;
    }
    // Free-form extra temp players always count
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
    // If captain becomes available again, clear any temp captain selection
    if (member.isCaptain && available) {
      teamAvail.tempCaptainId = null;
    }
    // Spread into new array so computed() / template re-evaluate
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
      // Captain first — can now also be toggled unavailable
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

          // Always register in player index for lookup
          playerIndex[pid] = {
            id: pid,
            name: m.name,
            cricherosUsername: snap?.cricherosUsername,
            cricherosId: snap?.cricherosId,
            isTemp: false,
            originalPlayerId: m.id
          };

          if (m.isCaptain) {
            // Captain plays separately (not in pickedIds); track if absent
            if (!m.available) unavailableCoreIds.push(pid);
            continue;
          }

          // Non-captain core members
          if (m.available) {
            if (captainAbsent && tempCaptainId === m.id) {
              // This member acts as temp captain — plays as captain, not in pickedIds
            } else {
              availableCoreIds.push(pid);
            }
          } else {
            unavailableCoreIds.push(pid);
          }
        }

        // Resolve which player is captain this week
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
          pickedIds: [...availableCoreIds]  // core members start pre-placed
        };
      };

      const team1 = buildTeamState(teamIds[0]);
      const team2 = buildTeamState(teamIds[1]);

      // Pool: available other players + named temp replacements for unavailable others
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

      // Free-form extra temp players (typed in step 4)
      for (const name of this.extraTempPlayers()) {
        const tid = `temp_${tempIdx++}`;
        pool.push(tid);
        playerIndex[tid] = { id: tid, name, isTemp: true };
      }

      // 2 captains (or temp captains) + both teams' picked cores + pool
      const totalInMatch = 2 + team1.pickedIds.length + team2.pickedIds.length + pool.length;

      if (totalInMatch > 24) {
        this.errorMsg.set(
          `Total players (${totalInMatch}) exceeds the maximum of 24. Mark more players as unavailable.`
        );
        this.saving.set(false);
        return;
      }
      if (totalInMatch < 22) {
        this.errorMsg.set(
          `Total players (${totalInMatch}) is below the minimum of 22. Add ${22 - totalInMatch} more available or temp player(s) in step 4.`
        );
        this.saving.set(false);
        return;
      }

      // Shuffle pool
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
