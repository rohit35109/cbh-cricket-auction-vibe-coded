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
  template: `
    <div class="auction-root">

      <!-- Top bar -->
      <div class="top-bar">
        <div class="top-bar-left">
          <span class="logo">🏏 Cricket Auction</span>
          @if (auction()) {
            <span class="phase-badge" [class]="'phase-' + auction()!.phase">{{ phaseLabel() }}</span>
          }
        </div>
        <div class="top-bar-right">
          <span class="stats">
            Pool: {{ auction()?.availablePlayers?.length || 0 }}
            &nbsp;|&nbsp; Unsold: {{ auction()?.unsoldPlayers?.length || 0 }}
            &nbsp;|&nbsp; Done: {{ completedTeamIds().length }}/{{ auction()?.teams?.length || 0 }}
          </span>
          @if (auction()?.phase === 'active' || auction()?.phase === 'unsold_phase') {
            <button class="btn-complete" (click)="showConfirmModal.set(true)">Mark Complete</button>
          }
        </div>
      </div>

      <!-- 3-panel layout -->
      <div class="main-layout">

        <!-- LEFT: player pool -->
        <div class="panel panel-left">
          <div class="panel-header">
            <span>Player Pool</span>
            <span class="count-badge">{{ auction()?.availablePlayers?.length || 0 }}</span>
          </div>
          <div class="panel-scroll">
            @for (pid of auction()?.availablePlayers || []; track pid) {
              <div class="player-card" [class.on-stage]="pid === auction()?.currentPlayerId && auction()?.phase === 'active'">
                <div class="pc-row">
                  <span class="player-name">{{ getPlayerName(pid) }}</span>
                  @if (pid === auction()?.currentPlayerId && auction()?.phase === 'active') {
                    <span class="stage-dot">▶</span>
                  }
                </div>
                @if (getPlayerUsername(pid)) {
                  <span class="player-sub">&#64;{{ getPlayerUsername(pid) }}</span>
                }
              </div>
            }
            @if ((auction()?.availablePlayers?.length || 0) === 0) {
              <div class="empty-panel">Main pool exhausted</div>
            }
          </div>

          <!-- Unsold sub-panel -->
          @if ((auction()?.unsoldPlayers?.length || 0) > 0) {
            <div class="panel-header unsold-header">
              <span>Unsold Pool</span>
              <span class="count-badge unsold-badge">{{ auction()!.unsoldPlayers.length }}</span>
            </div>
            <div class="panel-scroll unsold-scroll">
              @for (pid of auction()?.unsoldPlayers || []; track pid) {
                <div class="player-card unsold-card" [class.on-stage]="pid === auction()?.currentPlayerId && auction()?.phase === 'unsold_phase'">
                  <div class="pc-row">
                    <span class="player-name">{{ getPlayerName(pid) }}</span>
                    @if (pid === auction()?.currentPlayerId && auction()?.phase === 'unsold_phase') {
                      <span class="stage-dot purple">▶</span>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>

        <!-- MIDDLE: current turn -->
        <div class="panel panel-mid">

          @if (auction()?.phase === 'shuffling') {
            <div class="shuffle-screen">
              <div class="shuffle-spinner">🏏</div>
              <p class="shuffle-title">Shuffling Pick Order</p>
              <div class="shuffle-teams">
                @for (name of shuffleDisplay(); track $index) {
                  <div class="shuffle-name" [style.opacity]="$index === 0 ? 1 : 0.55 - $index * 0.1">{{ name }}</div>
                }
              </div>
              <p class="shuffle-sub">Determining sequence...</p>
            </div>
          }

          @if (auction()?.phase === 'active' || auction()?.phase === 'unsold_phase') {
            <!-- Captain header -->
            <div class="turn-header">
              @if (currentTeam()) {
                <div class="turn-info">
                  @if (auction()?.phase === 'unsold_phase') {
                    <span class="phase-tag unsold-tag">⚡ Unsold Phase</span>
                  }
                  <span class="turn-label">Current Pick</span>
                  <span class="captain-name">{{ currentTeam()!.captainName }}</span>
                  <span class="team-name-sub">{{ currentTeam()!.teamName }}</span>
                </div>
                <div class="pick-progress">
                  <span class="picks-label">Picks</span>
                  <div class="pick-dots">
                    @for (filled of pickDots(); track $index) {
                      <div class="pick-dot" [class.filled]="filled"></div>
                    }
                  </div>
                  <span class="picks-count">{{ currentTeam()!.memberIds.length }}/{{ auction()!.coreMembersCount - 1 }}</span>
                </div>
              }
            </div>

            <!-- Player spotlight -->
            @if (currentPlayer()) {
              <div class="player-spotlight">
                <div class="spotlight-info">
                  <div class="name-row">
                    <h2 class="spotlight-name">{{ currentPlayer()!.name }}</h2>
                    @if (cricherosProfileUrl()) {
                      <a [href]="cricherosProfileUrl()" target="_blank" rel="noopener noreferrer" class="profile-link">
                        🔗 Open Profile
                      </a>
                    }
                  </div>
                  @if (currentPlayer()!.cricherosUsername) {
                    <p class="spotlight-meta">&#64;{{ currentPlayer()!.cricherosUsername }}</p>
                  }
                  @if (currentPlayer()!.cricherosId) {
                    <p class="spotlight-meta id-meta">ID: {{ currentPlayer()!.cricherosId }}</p>
                  }
                </div>

                @if (currentPlayer()!.cricherosId && currentPlayer()!.cricherosUsername) {
                  <div class="iframe-wrap">
                    <iframe
                      [src]="safeIframeUrl()"
                      frameborder="0"
                      class="stats-iframe"
                      loading="lazy"
                      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                    ></iframe>
                    <div class="iframe-note">
                      <span>Profile stats may not load if restricted by Cricheroes.</span>
                      <a [href]="cricherosProfileUrl()" target="_blank" rel="noopener noreferrer" class="iframe-link">
                        Open in browser ↗
                      </a>
                    </div>
                  </div>
                } @else {
                  <div class="no-profile">
                    <span>📊</span>
                    <p>No Cricheroes profile linked</p>
                  </div>
                }

                <div class="action-buttons">
                  <button class="btn-unsold" (click)="markUnsold()" [disabled]="actionInProgress()">
                    ❌ &nbsp;Unsold
                  </button>
                  <button class="btn-pick" (click)="pickPlayer()" [disabled]="actionInProgress()">
                    ✅ &nbsp;Pick
                  </button>
                </div>
              </div>

            } @else {
              <!-- No player in pool at all -->
              <div class="no-player-state">
                <span class="no-player-icon">🏏</span>
                <p class="no-player-msg">No players remaining in any pool.</p>
                <p class="no-player-sub">Click <strong>Mark Complete</strong> to end the auction.</p>
              </div>
            }
          }

          @if (auction()?.phase === 'completed') {
            <div class="completed-screen">
              <div class="trophy">🏆</div>
              <h2>Auction Complete!</h2>
              <p>All picks have been finalised.</p>
              <div class="comp-stats">
                <div class="comp-stat">
                  <span class="comp-val">{{ completedTeamIds().length }}</span>
                  <span class="comp-label">Teams Filled</span>
                </div>
                <div class="comp-stat">
                  <span class="comp-val">{{ auction()?.unsoldPlayers?.length || 0 }}</span>
                  <span class="comp-label">Players Unsold</span>
                </div>
              </div>
              <button class="btn-save" (click)="saveToHistory()">💾 Save to History &amp; Exit</button>
            </div>
          }
        </div>

        <!-- RIGHT: teams -->
        <div class="panel panel-right">
          <div class="panel-header">
            <span>Pick Order &amp; Teams</span>
            @if (auction()?.phase === 'shuffling') {
              <span class="shuffling-tag">Shuffling...</span>
            }
          </div>
          <div class="panel-scroll">
            @for (tid of teamOrder(); track tid; let i = $index) {
              @if (getTeam(tid); as team) {
                <div class="team-card"
                  [class.current-team]="tid === currentTeamId()"
                  [class.done-team]="completedTeamIds().includes(tid)">
                  <div class="tc-header">
                    <div class="tc-seq">
                      @if (completedTeamIds().includes(tid)) { <span class="done-check">✓</span> }
                      @else { <span>{{ i + 1 }}</span> }
                    </div>
                    <div class="tc-info">
                      <span class="tc-name">{{ team.teamName }}</span>
                      <span class="tc-captain">👑 {{ team.captainName }}</span>
                    </div>
                    <div class="tc-slots">{{ team.memberIds.length + 1 }}/{{ auction()?.coreMembersCount }}</div>
                  </div>
                  @if (team.memberIds.length > 0) {
                    <div class="tc-members">
                      @for (mid of team.memberIds; track mid) {
                        <div class="tc-member">• {{ getPlayerName(mid) }}</div>
                      }
                    </div>
                  }
                </div>
              }
            }
          </div>
        </div>

      </div>

      <!-- Manual complete modal -->
      @if (showConfirmModal()) {
        <div class="modal-overlay">
          <div class="confirm-box">
            <h3>Mark Auction as Complete?</h3>
            <p>This will save the result to history and end the session. Any unsold players will remain unsold.</p>
            <div class="modal-actions">
              <button class="btn-ghost" (click)="showConfirmModal.set(false)">Cancel</button>
              <button class="btn-danger" (click)="saveToHistory()">Yes, Complete</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
    .auction-root { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: #0f172a; }

    /* Top bar */
    .top-bar {
      height: 52px; min-height: 52px; background: #1e293b; border-bottom: 1px solid #334155;
      display: flex; align-items: center; justify-content: space-between; padding: 0 20px; flex-shrink: 0;
    }
    .top-bar-left, .top-bar-right { display: flex; align-items: center; gap: 14px; }
    .logo { font-size: 1.05rem; font-weight: 700; color: #f8fafc; }
    .phase-badge { padding: 3px 10px; border-radius: 99px; font-size: 0.72rem; font-weight: 600; }
    .phase-shuffling { background: #f59e0b; color: #0f172a; }
    .phase-active { background: #22c55e; color: #0f172a; }
    .phase-unsold_phase { background: #a78bfa; color: #0f172a; }
    .phase-completed { background: #475569; color: #f8fafc; }
    .stats { color: #64748b; font-size: 0.78rem; }
    .btn-complete {
      background: transparent; border: 1px solid #f59e0b; color: #f59e0b;
      border-radius: 8px; padding: 6px 14px; font-size: 0.78rem; cursor: pointer; transition: all 0.2s;
    }
    .btn-complete:hover { background: rgba(245,158,11,0.1); }

    /* Layout */
    .main-layout { flex: 1; display: flex; overflow: hidden; }
    .panel { display: flex; flex-direction: column; border-right: 1px solid #334155; overflow: hidden; }
    .panel-left { width: 27%; min-width: 190px; }
    .panel-mid { flex: 1; border-right: none; }
    .panel-right { width: 27%; min-width: 190px; }
    .panel-header {
      padding: 10px 14px; background: #1e293b; border-bottom: 1px solid #334155;
      font-size: 0.8rem; font-weight: 600; color: #94a3b8;
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    .unsold-header { background: #160d2b; border-top: 1px solid #334155; }
    .count-badge { background: #334155; color: #94a3b8; padding: 2px 8px; border-radius: 99px; font-size: 0.7rem; }
    .unsold-badge { background: rgba(167,139,250,0.2); color: #a78bfa; }
    .shuffling-tag { color: #f59e0b; font-size: 0.7rem; animation: blink 1s infinite; }
    @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
    .panel-scroll { flex: 1; overflow-y: auto; padding: 8px; }
    .unsold-scroll { flex: 0 0 auto; max-height: 35%; overflow-y: auto; padding: 8px; }

    /* Left panel cards */
    .player-card {
      padding: 8px 10px; border-radius: 8px; margin-bottom: 5px;
      background: #1e293b; border: 1px solid #334155; transition: all 0.2s;
    }
    .player-card.on-stage { background: rgba(34,197,94,0.1); border-color: #22c55e; }
    .player-card.unsold-card { border-color: #2d1f4a; background: #1a1030; }
    .player-card.unsold-card.on-stage { background: rgba(167,139,250,0.1); border-color: #a78bfa; }
    .pc-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
    .player-name { font-size: 0.83rem; color: #e2e8f0; font-weight: 500; }
    .stage-dot { font-size: 0.68rem; color: #22c55e; font-weight: 700; }
    .stage-dot.purple { color: #a78bfa; }
    .player-sub { font-size: 0.7rem; color: #64748b; margin-top: 1px; display: block; }
    .empty-panel { text-align: center; color: #475569; padding: 16px 8px; font-size: 0.8rem; }

    /* Middle - shuffle */
    .shuffle-screen {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 16px; padding: 40px;
    }
    .shuffle-spinner { font-size: 3rem; animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .shuffle-title { font-size: 1.5rem; font-weight: 700; color: #f8fafc; margin: 0; }
    .shuffle-sub { color: #64748b; margin: 0; font-size: 0.9rem; }
    .shuffle-teams { display: flex; flex-direction: column; align-items: center; gap: 5px; min-height: 110px; }
    .shuffle-name { font-size: 1.35rem; font-weight: 700; color: #22c55e; transition: all 0.15s; }

    /* Middle - turn header */
    .turn-header {
      padding: 14px 22px; background: #1e293b; border-bottom: 1px solid #334155;
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    .turn-info { display: flex; flex-direction: column; gap: 1px; }
    .phase-tag { font-size: 0.68rem; font-weight: 700; padding: 2px 8px; border-radius: 4px; width: fit-content; margin-bottom: 3px; }
    .unsold-tag { background: rgba(167,139,250,0.2); color: #a78bfa; }
    .turn-label { font-size: 0.7rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
    .captain-name { font-size: 1.65rem; font-weight: 800; color: #f8fafc; }
    .team-name-sub { font-size: 0.82rem; color: #22c55e; }
    .pick-progress { display: flex; align-items: center; gap: 10px; }
    .picks-label { font-size: 0.7rem; color: #64748b; }
    .pick-dots { display: flex; gap: 6px; }
    .pick-dot { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #334155; background: transparent; transition: all 0.3s; }
    .pick-dot.filled { background: #22c55e; border-color: #22c55e; }
    .picks-count { font-size: 0.82rem; color: #94a3b8; }

    /* Middle - player spotlight */
    .player-spotlight { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .spotlight-info { padding: 16px 22px; border-bottom: 1px solid #334155; flex-shrink: 0; }
    .name-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; margin-bottom: 6px; }
    .spotlight-name { font-size: 1.9rem; font-weight: 800; color: #f8fafc; margin: 0; }
    .profile-link {
      display: inline-flex; align-items: center; gap: 4px;
      background: rgba(34,197,94,0.1); border: 1px solid rgba(34,197,94,0.35);
      color: #22c55e; padding: 6px 14px; border-radius: 8px;
      font-size: 0.82rem; font-weight: 600; text-decoration: none; transition: all 0.2s;
    }
    .profile-link:hover { background: rgba(34,197,94,0.2); }
    .spotlight-meta { color: #22c55e; margin: 0 0 3px; font-size: 0.9rem; }
    .spotlight-meta.id-meta { color: #64748b; font-size: 0.78rem; }
    .iframe-wrap { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .stats-iframe { flex: 1; width: 100%; border: none; min-height: 0; }
    .iframe-note {
      padding: 8px 22px; background: rgba(15,23,42,0.8); border-top: 1px solid #334155;
      display: flex; align-items: center; gap: 10px; flex-shrink: 0; flex-wrap: wrap;
    }
    .iframe-note span { font-size: 0.75rem; color: #64748b; }
    .iframe-link { font-size: 0.78rem; color: #a78bfa; text-decoration: none; font-weight: 600; }
    .iframe-link:hover { color: #c4b5fd; }
    .no-profile {
      flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #475569;
    }
    .no-profile span { font-size: 3rem; }
    .no-profile p { margin: 0; font-size: 0.9rem; }
    .action-buttons {
      padding: 16px 22px; display: flex; gap: 16px; border-top: 1px solid #334155;
      background: #1e293b; flex-shrink: 0;
    }
    .btn-unsold, .btn-pick {
      flex: 1; padding: 14px; border-radius: 12px; border: 2px solid;
      font-size: 1.05rem; font-weight: 700; cursor: pointer; transition: all 0.2s;
    }
    .btn-unsold { background: rgba(239,68,68,0.1); color: #ef4444; border-color: #ef4444; }
    .btn-unsold:hover:not(:disabled) { background: rgba(239,68,68,0.22); }
    .btn-pick { background: rgba(34,197,94,0.1); color: #22c55e; border-color: #22c55e; }
    .btn-pick:hover:not(:disabled) { background: rgba(34,197,94,0.22); }
    .btn-unsold:disabled, .btn-pick:disabled { opacity: 0.35; cursor: not-allowed; }

    /* No player state */
    .no-player-state {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 12px; color: #475569; text-align: center; padding: 40px;
    }
    .no-player-icon { font-size: 3rem; }
    .no-player-msg { font-size: 1rem; color: #94a3b8; margin: 0; }
    .no-player-sub { font-size: 0.85rem; color: #64748b; margin: 0; }
    .no-player-sub strong { color: #f59e0b; }

    /* Completed */
    .completed-screen {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 16px; padding: 40px; text-align: center;
    }
    .trophy { font-size: 4rem; }
    .completed-screen h2 { font-size: 2rem; font-weight: 800; color: #f8fafc; margin: 0; }
    .completed-screen p { color: #94a3b8; margin: 0; }
    .comp-stats { display: flex; gap: 32px; margin-top: 8px; }
    .comp-stat { text-align: center; }
    .comp-val { display: block; font-size: 2.5rem; font-weight: 800; color: #22c55e; }
    .comp-label { display: block; font-size: 0.82rem; color: #64748b; }
    .btn-save {
      background: #22c55e; color: #0f172a; border: none; border-radius: 10px;
      padding: 14px 28px; font-size: 1rem; font-weight: 700; cursor: pointer;
      transition: opacity 0.2s; margin-top: 8px;
    }
    .btn-save:hover { opacity: 0.85; }

    /* Right panel */
    .team-card {
      padding: 10px 12px; border-radius: 10px; margin-bottom: 8px;
      background: #1e293b; border: 1px solid #334155; transition: all 0.2s;
    }
    .team-card.current-team { border-color: #22c55e; background: rgba(34,197,94,0.07); }
    .team-card.done-team { border-color: rgba(34,197,94,0.4); opacity: 0.72; }
    .tc-header { display: flex; align-items: center; gap: 10px; }
    .tc-seq {
      width: 26px; height: 26px; border-radius: 50%; background: #334155; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 0.78rem; font-weight: 700; color: #94a3b8;
    }
    .done-check { color: #22c55e; font-size: 0.9rem; }
    .tc-info { flex: 1; min-width: 0; }
    .tc-name { display: block; font-size: 0.9rem; font-weight: 700; color: #f8fafc; }
    .tc-captain { display: block; font-size: 0.72rem; color: #94a3b8; }
    .tc-slots { font-size: 0.78rem; color: #64748b; flex-shrink: 0; }
    .tc-members { margin-top: 8px; padding-top: 8px; border-top: 1px solid #334155; }
    .tc-member { font-size: 0.78rem; color: #94a3b8; padding: 2px 0; }

    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center; z-index: 999;
    }
    .confirm-box {
      background: #1e293b; border: 1px solid #334155; border-radius: 14px;
      padding: 28px; max-width: 420px; width: 90%;
    }
    .confirm-box h3 { font-size: 1.2rem; color: #f8fafc; margin: 0 0 10px; }
    .confirm-box p { color: #94a3b8; font-size: 0.9rem; margin: 0 0 20px; line-height: 1.5; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 12px; }
    .btn-ghost {
      background: transparent; border: 1px solid #334155; color: #94a3b8;
      border-radius: 8px; padding: 8px 18px; cursor: pointer; font-size: 0.9rem; transition: all 0.2s;
    }
    .btn-ghost:hover { border-color: #94a3b8; color: #f8fafc; }
    .btn-danger {
      background: #ef4444; color: white; border: none;
      border-radius: 8px; padding: 8px 18px; cursor: pointer; font-size: 0.9rem; transition: opacity 0.2s;
    }
    .btn-danger:hover { opacity: 0.85; }
  `]
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

      // Add to team
      const teams = a.teams.map(t =>
        t.teamId === teamId ? { ...t, memberIds: [...t.memberIds, playerId] } : t
      );

      // Remove from whichever pool the player is in
      let availablePlayers = [...a.availablePlayers];
      let unsoldPlayers = [...a.unsoldPlayers];
      if (a.phase === 'active') {
        availablePlayers = availablePlayers.filter(p => p !== playerId);
      } else {
        unsoldPlayers = unsoldPlayers.filter(p => p !== playerId);
      }

      // Check if this team is now complete
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
        // Move from main pool to unsold pool
        availablePlayers = availablePlayers.filter(p => p !== playerId);
        unsoldPlayers = [...unsoldPlayers, playerId];
      }
      // In unsold_phase: player STAYS in the pool — no removal

      const { nextIndex, phase } = this.nextTurn(a.teamOrder, a.currentTeamIndex, a.completedTeamIds, availablePlayers, unsoldPlayers);
      // Avoid repeating the same player immediately — exclude current from next pick
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
    // Only complete when ALL teams are done — never auto-complete due to empty pools
    const active = teamOrder.filter(id => !completedTeamIds.includes(id));
    if (active.length === 0) return { nextIndex: currentIndex, phase: 'completed' };

    // Advance to next incomplete team
    let nextIndex = (currentIndex + 1) % teamOrder.length;
    for (let s = 0; s < teamOrder.length; s++) {
      if (!completedTeamIds.includes(teamOrder[nextIndex])) break;
      nextIndex = (nextIndex + 1) % teamOrder.length;
    }

    // Determine phase by what's available
    if (available.length > 0) return { nextIndex, phase: 'active' };
    if (unsold.length > 0) return { nextIndex, phase: 'unsold_phase' };
    // Both pools empty but teams still incomplete → show empty state, user marks complete
    return { nextIndex, phase: 'active' };
  }

  /**
   * Pick next player randomly.
   * @param exclude — player ID to avoid picking (so the same player doesn't repeat immediately)
   */
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

    // All remaining unsold players (both pools combined)
    const unsoldIds = [...a.availablePlayers, ...a.unsoldPlayers];

    const record: AuctionHistoryRecord = {
      createdAt: a.createdAt,
      completedAt: new Date().toISOString(),
      coreMembersCount: a.coreMembersCount,
      teamSummaries: a.teams.map(team => ({
        teamId: team.teamId,
        teamName: team.teamName,
        captainName: team.captainName,
        memberNames: team.memberIds.map(mid => a.playerSnapshot[mid]?.name || `#${mid}`),
        isFull: team.memberIds.length >= a.coreMembersCount - 1
      })),
      unsoldPlayerNames: unsoldIds.map(pid => a.playerSnapshot[pid]?.name || `#${pid}`),
      totalPlayers: Object.keys(a.playerSnapshot).length
    };

    await this.db.saveAuctionHistory(record);
    await this.db.clearCurrentAuction();
    this.auctionCompleted.emit();
  }
}
