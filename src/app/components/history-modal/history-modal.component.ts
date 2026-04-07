import {
  Component, OnInit, Output, EventEmitter, signal, computed, inject
} from '@angular/core';
import { DbService } from '../../services/db.service';
import { AuctionHistoryRecord, WeeklyMatchRecord } from '../../models/models';

@Component({
  selector: 'app-history-modal',
  standalone: true,
  template: `
    <div class="overlay" (click)="onOverlayClick($event)">
      <div class="modal-box">
        <div class="modal-header">
          <span class="modal-title">📜 Auction History</span>
          <button class="btn-close" (click)="close.emit()">✕</button>
        </div>

        <div class="modal-body">
          @if (loading()) {
            <div class="loading">Loading history...</div>
          } @else if (records().length === 0) {
            <div class="empty">
              <span class="empty-icon">🏏</span>
              <p>No completed auctions yet.</p>
            </div>
          } @else {
            @for (rec of records(); track rec.id) {
              <div class="record-card" [class.expanded]="expandedId() === rec.id"
                (click)="toggleExpand(rec.id!)">

                <div class="record-header">
                  <div class="record-meta">
                    <span class="record-date">{{ formatDate(rec.createdAt) }}</span>
                    <span class="record-completed">Completed: {{ formatDate(rec.completedAt) }}</span>
                  </div>
                  <div class="record-stats">
                    <span class="stat-pill">{{ rec.teamSummaries.length }} Teams</span>
                    <span class="stat-pill">{{ rec.coreMembersCount }} Core Members</span>
                    <span class="stat-pill">{{ rec.totalPlayers }} Players</span>
                    @if (rec.unsoldPlayerNames.length > 0) {
                      <span class="stat-pill unsold">{{ rec.unsoldPlayerNames.length }} Unsold</span>
                    }
                    @if (weeklyCountFor(rec.id!) > 0) {
                      <span class="stat-pill weekly">⚡ {{ weeklyCountFor(rec.id!) }} Weekly Match{{ weeklyCountFor(rec.id!) > 1 ? 'es' : '' }}</span>
                    }
                  </div>
                  <span class="expand-icon">{{ expandedId() === rec.id ? '▲' : '▼' }}</span>
                </div>

                @if (expandedId() === rec.id) {
                  <div class="record-detail" (click)="$event.stopPropagation()">

                    <!-- Main auction teams -->
                    <div class="section-label">Main Auction Teams</div>
                    <div class="teams-grid">
                      @for (ts of rec.teamSummaries; track ts.teamId) {
                        <div class="team-summary" [class.full]="ts.isFull">
                          <div class="ts-header">
                            <span class="ts-name">{{ ts.teamName }}</span>
                            @if (ts.isFull) {
                              <span class="full-badge">✓ Full</span>
                            } @else {
                              <span class="partial-badge">Partial</span>
                            }
                          </div>
                          <div class="ts-captain">👑 {{ ts.captainName }}</div>
                          @if (ts.memberNames.length > 0) {
                            <div class="ts-members">
                              @for (m of ts.memberNames; track $index; let i = $index) {
                                <div class="ts-member"><span class="ts-idx">{{ i + 1 }}.</span> {{ m }}</div>
                              }
                            </div>
                          } @else {
                            <div class="ts-no-picks">No picks made</div>
                          }
                        </div>
                      }
                    </div>

                    @if (rec.unsoldPlayerNames.length > 0) {
                      <div class="unsold-section">
                        <h4 class="unsold-title">Unsold Players</h4>
                        <div class="unsold-list">
                          @for (name of rec.unsoldPlayerNames; track $index) {
                            <span class="unsold-chip">{{ name }}</span>
                          }
                        </div>
                      </div>
                    }

                    <!-- Weekly matches for this auction -->
                    @if (weeklyCountFor(rec.id!) > 0) {
                      <div class="weekly-section">
                        <div class="section-label weekly-label">⚡ Weekly Matches</div>
                        @for (wm of weeklyMatchesFor(rec.id!); track wm.id) {
                          <div class="weekly-match-card">
                            <div class="wm-header">
                              <span class="wm-date">{{ formatDate(wm.completedAt) }}</span>
                              <span class="wm-toss">🪙 Toss: {{ wm.tossWinnerName }}</span>
                              @if (wm.swapsMade > 0) {
                                <span class="wm-swaps">🔄 {{ wm.swapsMade }} swap{{ wm.swapsMade > 1 ? 's' : '' }}</span>
                              }
                            </div>
                            <div class="wm-teams">
                              <div class="wm-team">
                                <div class="wm-team-name">{{ wm.team1.teamName }}</div>
                                <div class="wm-captain">👑 {{ wm.team1.captainName }}</div>
                                <div class="wm-players">
                                  @for (p of wm.team1.playerNames; track $index; let i = $index) {
                                    <span class="wm-player"><span class="wm-idx">{{ i + 1 }}.</span> {{ p }}</span>
                                  }
                                  @if (wm.team1.playerNames.length === 0) {
                                    <span class="wm-no-players">No picks</span>
                                  }
                                </div>
                              </div>
                              <div class="wm-vs">VS</div>
                              <div class="wm-team">
                                <div class="wm-team-name">{{ wm.team2.teamName }}</div>
                                <div class="wm-captain">👑 {{ wm.team2.captainName }}</div>
                                <div class="wm-players">
                                  @for (p of wm.team2.playerNames; track $index; let i = $index) {
                                    <span class="wm-player"><span class="wm-idx">{{ i + 1 }}.</span> {{ p }}</span>
                                  }
                                  @if (wm.team2.playerNames.length === 0) {
                                    <span class="wm-no-players">No picks</span>
                                  }
                                </div>
                              </div>
                            </div>
                          </div>
                        }
                      </div>
                    }

                  </div>
                }
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.75);
      backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000;
    }
    .modal-box {
      background: #1e293b; border: 1px solid #334155; border-radius: 16px;
      width: 90vw; max-width: 900px; max-height: 88vh;
      display: flex; flex-direction: column; overflow: hidden;
    }
    .modal-header {
      padding: 18px 24px; border-bottom: 1px solid #334155;
      display: flex; align-items: center; justify-content: space-between;
      background: #0f172a; flex-shrink: 0;
    }
    .modal-title { font-size: 1.15rem; font-weight: 700; color: #f8fafc; }
    .btn-close {
      width: 32px; height: 32px; border-radius: 8px;
      background: #334155; border: none; color: #94a3b8;
      cursor: pointer; font-size: 0.9rem; transition: all 0.2s;
    }
    .btn-close:hover { background: #475569; color: #f8fafc; }
    .modal-body { flex: 1; overflow-y: auto; padding: 16px; }
    .loading, .empty {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 12px; padding: 48px; color: #64748b;
    }
    .empty-icon { font-size: 3rem; }
    .empty p { margin: 0; font-size: 0.9rem; }

    /* Main auction record card */
    .record-card {
      background: #0f172a; border: 1px solid #334155; border-radius: 10px;
      margin-bottom: 10px; overflow: hidden; cursor: pointer;
      transition: border-color 0.2s;
    }
    .record-card:hover { border-color: #475569; }
    .record-card.expanded { border-color: #22c55e; }
    .record-header {
      padding: 14px 16px; display: flex; align-items: center;
      justify-content: space-between; gap: 12px;
    }
    .record-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .record-date { font-size: 0.95rem; font-weight: 600; color: #e2e8f0; }
    .record-completed { font-size: 0.75rem; color: #64748b; }
    .record-stats { display: flex; flex-wrap: wrap; gap: 6px; flex: 1; }
    .stat-pill {
      padding: 3px 10px; border-radius: 99px; font-size: 0.75rem;
      background: #334155; color: #94a3b8; white-space: nowrap;
    }
    .stat-pill.unsold { background: rgba(239,68,68,0.15); color: #f87171; }
    .stat-pill.weekly { background: rgba(167,139,250,0.15); color: #a78bfa; }
    .expand-icon { color: #475569; font-size: 0.8rem; flex-shrink: 0; }

    /* Expanded detail */
    .record-detail { padding: 0 16px 16px; border-top: 1px solid #334155; }
    .section-label {
      font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;
      color: #475569; margin: 16px 0 10px;
    }
    .weekly-label { color: #a78bfa; }
    .teams-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 10px;
    }
    .team-summary {
      background: #1e293b; border: 1px solid #334155; border-radius: 8px;
      padding: 12px;
    }
    .team-summary.full { border-color: rgba(34,197,94,0.4); }
    .ts-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    .ts-name { font-size: 0.9rem; font-weight: 700; color: #f8fafc; }
    .full-badge { font-size: 0.7rem; color: #22c55e; font-weight: 600; }
    .partial-badge { font-size: 0.7rem; color: #f59e0b; font-weight: 600; }
    .ts-captain { font-size: 0.78rem; color: #94a3b8; margin-bottom: 6px; }
    .ts-members { display: flex; flex-direction: column; gap: 2px; }
    .ts-member { font-size: 0.78rem; color: #cbd5e1; display: flex; gap: 5px; }
    .ts-idx { color: #475569; font-size: 0.7rem; min-width: 16px; flex-shrink: 0; }
    .ts-no-picks { font-size: 0.78rem; color: #475569; font-style: italic; }
    .unsold-section { margin-top: 14px; }
    .unsold-title { font-size: 0.85rem; color: #94a3b8; margin: 0 0 8px; font-weight: 600; }
    .unsold-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .unsold-chip {
      padding: 4px 10px; background: rgba(239,68,68,0.1);
      border: 1px solid rgba(239,68,68,0.3); border-radius: 99px;
      color: #f87171; font-size: 0.78rem;
    }

    /* Weekly matches section */
    .weekly-section { margin-top: 4px; }
    .weekly-match-card {
      background: #0d1526; border: 1px solid rgba(167,139,250,0.3);
      border-radius: 10px; padding: 14px 16px; margin-bottom: 10px;
    }
    .wm-header {
      display: flex; align-items: center; gap: 14px; margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .wm-date { font-size: 0.82rem; color: #64748b; }
    .wm-toss { font-size: 0.8rem; color: #f59e0b; font-weight: 600; }
    .wm-swaps { font-size: 0.78rem; color: #a78bfa; }
    .wm-teams { display: flex; align-items: flex-start; gap: 12px; }
    .wm-team { flex: 1; background: #1e293b; border-radius: 8px; padding: 10px 12px; }
    .wm-vs {
      font-size: 0.85rem; font-weight: 800; color: #475569;
      padding-top: 10px; flex-shrink: 0;
    }
    .wm-team-name { font-size: 0.9rem; font-weight: 700; color: #f8fafc; margin-bottom: 2px; }
    .wm-captain { font-size: 0.75rem; color: #94a3b8; margin-bottom: 8px; }
    .wm-players { display: flex; flex-direction: column; gap: 3px; }
    .wm-player { font-size: 0.78rem; color: #cbd5e1; display: flex; gap: 5px; }
    .wm-idx { color: #475569; font-size: 0.7rem; min-width: 16px; flex-shrink: 0; }
    .wm-no-players { font-size: 0.75rem; color: #475569; font-style: italic; }
  `]
})
export class HistoryModalComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private db = inject(DbService);
  records = signal<AuctionHistoryRecord[]>([]);
  weeklyRecords = signal<WeeklyMatchRecord[]>([]);
  loading = signal(true);
  expandedId = signal<number | null>(null);

  // Pre-grouped map: parentHistoryId → WeeklyMatchRecord[]
  private weeklyByParent = computed(() => {
    const map = new Map<number, WeeklyMatchRecord[]>();
    for (const w of this.weeklyRecords()) {
      const list = map.get(w.parentHistoryId) ?? [];
      list.push(w);
      map.set(w.parentHistoryId, list);
    }
    return map;
  });

  async ngOnInit() {
    const [history, weekly] = await Promise.all([
      this.db.getAuctionHistory(),
      this.db.getWeeklyMatchHistory()
    ]);
    this.records.set([...history].reverse()); // newest first
    this.weeklyRecords.set([...weekly].reverse());
    this.loading.set(false);
  }

  weeklyMatchesFor(parentId: number): WeeklyMatchRecord[] {
    return this.weeklyByParent().get(parentId) ?? [];
  }

  weeklyCountFor(parentId: number): number {
    return this.weeklyMatchesFor(parentId).length;
  }

  toggleExpand(id: number) {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  onOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('overlay')) {
      this.close.emit();
    }
  }

  formatDate(iso: string): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return iso; }
  }
}
