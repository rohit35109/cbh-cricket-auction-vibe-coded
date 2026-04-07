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
  template: `
    <div class="wa-root">

      <!-- Top bar -->
      <div class="top-bar">
        <div class="top-bar-left">
          <span class="logo">⚡ Weekly Auction</span>
          @if (auction()) {
            <span class="phase-badge phase-{{ auction()!.phase }}">{{ phaseLabel() }}</span>
          }
        </div>
        <div class="top-bar-right">
          @if (auction()?.phase === 'picking') {
            <span class="pool-stat">Pool: {{ auction()!.pool.length }} remaining</span>
          }
          @if (auction()?.phase === 'picking' || auction()?.phase === 'swap') {
            <button class="btn-finish" (click)="showFinishConfirm.set(true)">Mark Complete</button>
          }
        </div>
      </div>

      <!-- TOSS PHASE -->
      @if (auction()?.phase === 'toss') {
        <div class="center-screen">
          <div class="toss-card">
            <h2 class="toss-title">Coin Toss</h2>
            <p class="toss-sub">
              @if (!flipDone()) { Flip to decide who picks first }
              @else { 🎉 <strong>{{ flipWinnerName() }}</strong> wins the toss! }
            </p>

            <!-- Teams row with coin in middle -->
            <div class="toss-row">

              <!-- Team 1 = HEADS -->
              <div class="toss-team-block" [class.toss-winner]="flipDone() && flipWinnerTeamId() === auction()!.team1.teamId">
                <div class="toss-side-label">HEADS</div>
                <div class="toss-team-name">{{ auction()!.team1.teamName }}</div>
                <div class="toss-captain">👑 {{ auction()!.team1.captainName }}</div>
              </div>

              <!-- Coin -->
              <div class="coin-area">
                <div class="coin-wrap" [class.flipping]="isFlipping()" [class.heads]="flipDone() && flipResult() === 'heads'" [class.tails]="flipDone() && flipResult() === 'tails'">
                  <div class="coin-face coin-front">🪙</div>
                  <div class="coin-face coin-back">🪙</div>
                </div>
                @if (!isFlipping() && !flipDone()) {
                  <button class="btn-flip" (click)="flipCoin()">Flip!</button>
                }
                @if (isFlipping()) {
                  <p class="flip-status">Flipping…</p>
                }
                @if (flipDone()) {
                  <button class="btn-confirm-toss" (click)="confirmTossWinner()">
                    Start Picking →
                  </button>
                }
              </div>

              <!-- Team 2 = TAILS -->
              <div class="toss-team-block" [class.toss-winner]="flipDone() && flipWinnerTeamId() === auction()!.team2.teamId">
                <div class="toss-side-label">TAILS</div>
                <div class="toss-team-name">{{ auction()!.team2.teamName }}</div>
                <div class="toss-captain">👑 {{ auction()!.team2.captainName }}</div>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- PICKING PHASE -->
      @if (auction()?.phase === 'picking') {
        <div class="pick-layout">

          <!-- LEFT: Pool -->
          <div class="panel panel-left">
            <div class="panel-header">
              <span>Available Players</span>
              <span class="count-badge">{{ auction()!.pool.length }}</span>
            </div>
            <div class="panel-scroll">
              @for (pid of auction()!.pool; track pid) {
                <div class="player-chip" [class.core-chip]="isCorePlayer(pid)">
                  <div class="pc-row">
                    <span class="pc-name">{{ getPlayer(pid)?.name }}</span>
                    @if (isCorePlayer(pid)) { <span class="core-tag">Core</span> }
                  </div>
                  @if (getPlayer(pid)?.cricherosUsername) {
                    <span class="pc-sub">&#64;{{ getPlayer(pid)!.cricherosUsername }}</span>
                  }
                  @if (getPlayer(pid)?.isTemp) {
                    <span class="temp-tag">Temp</span>
                  }
                </div>
              }
              @if (auction()!.pool.length === 0) {
                <div class="empty-panel">All players picked!</div>
              }
            </div>
          </div>

          <!-- MIDDLE: Current pick turn -->
          <div class="panel panel-mid">
            @if (currentPickTeam()) {
              <div class="pick-turn-header">
                <div class="pick-turn-info">
                  <span class="pick-turn-label">Captain's Choice</span>
                  <span class="pick-captain-name">{{ currentPickTeam()!.captainName }}</span>
                  <span class="pick-team-name">{{ currentPickTeam()!.teamName }}</span>
                </div>
                <div class="pick-slots">
                  <span class="slots-label">Picked</span>
                  <span class="slots-val">{{ currentPickTeam()!.pickedIds.length }}</span>
                </div>
              </div>

              @if (auction()!.pool.length > 0) {
                <div class="pick-list-container">
                  <p class="pick-list-hint">Select a player to pick:</p>
                  <div class="pick-list">
                    @for (pid of auction()!.pool; track pid) {
                      <div class="pick-list-item"
                        [class.highlighted]="highlightedPid() === pid"
                        (mouseenter)="highlightedPid.set(pid)"
                        (mouseleave)="highlightedPid.set(null)"
                        (click)="pickPlayer(pid)">
                        <div class="pli-left">
                          <span class="pli-name">{{ getPlayer(pid)?.name }}</span>
                          <div class="pli-tags">
                            @if (isCorePlayer(pid)) { <span class="core-tag sm">Core</span> }
                            @if (getPlayer(pid)?.isTemp) { <span class="temp-tag sm">Temp</span> }
                            @if (getPlayer(pid)?.cricherosUsername) {
                              <span class="pli-user">&#64;{{ getPlayer(pid)!.cricherosUsername }}</span>
                            }
                          </div>
                        </div>
                        <button class="btn-pick-player" (click)="pickPlayer(pid); $event.stopPropagation()">
                          Pick ✓
                        </button>
                      </div>
                    }
                  </div>
                </div>
              } @else {
                <div class="no-pool-state">
                  <span class="np-icon">🏏</span>
                  <p>All available players have been picked.</p>
                  <button class="btn-proceed-swap" (click)="proceedToSwap()">Proceed to Swap Phase →</button>
                </div>
              }
            }
          </div>

          <!-- RIGHT: Teams -->
          <div class="panel panel-right">
            <div class="panel-header"><span>Teams</span></div>
            <div class="panel-scroll">
              @for (team of bothTeams(); track team.teamId) {
                <div class="team-card" [class.current-team]="team.teamId === auction()!.currentPickTeamId">
                  <div class="tc-header">
                    <div class="tc-info">
                      <span class="tc-name">{{ team.teamName }}</span>
                      <span class="tc-captain">👑 {{ team.captainName }}</span>
                    </div>
                    @if (team.teamId === auction()!.currentPickTeamId) {
                      <span class="picking-now">Picking</span>
                    }
                  </div>
                  @if (team.pickedIds.length > 0) {
                    <div class="tc-members">
                      @for (pid of team.pickedIds; track pid) {
                        <div class="tc-member">
                          • {{ getPlayer(pid)?.name }}
                          @if (isCorePlayerForTeam(pid, team.teamId)) { <span class="core-dot">●</span> }
                        </div>
                      }
                    </div>
                  } @else {
                    <div class="tc-empty">No picks yet</div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- SWAP PHASE -->
      @if (auction()?.phase === 'swap') {
        <div class="center-screen">
          <div class="swap-card">
            <div class="swap-header">
              <h2 class="swap-title">🔄 Swap Phase</h2>
              <p class="swap-sub">Up to 2 total swaps between teams. Non-core players only.</p>
              <div class="swap-count-row">
                <span class="swap-used">Swaps used: {{ auction()!.swapCount }} / 2</span>
                @if (auction()!.swapCount >= 2) {
                  <span class="swap-maxed">Max swaps reached</span>
                }
              </div>
            </div>

            <div class="swap-teams-row">
              <!-- Team 1 non-core picks -->
              <div class="swap-team-panel">
                <div class="swap-team-name">{{ auction()!.team1.teamName }}</div>
                @for (pid of nonCorePicks(auction()!.team1); track pid) {
                  <div class="swap-player-item"
                    [class.selected-swap]="swapSelection().team1Pid === pid"
                    (click)="selectSwapPlayer(1, pid)">
                    <span>{{ getPlayer(pid)?.name }}</span>
                    @if (getPlayer(pid)?.isTemp) { <span class="temp-tag sm">Temp</span> }
                  </div>
                }
                @if (nonCorePicks(auction()!.team1).length === 0) {
                  <div class="swap-empty">No non-core players to swap</div>
                }
              </div>

              <div class="swap-arrow-col">
                <div class="swap-arrow">⇄</div>
                @if (swapSelection().team1Pid && swapSelection().team2Pid) {
                  <button class="btn-do-swap" (click)="executeSwap()" [disabled]="auction()!.swapCount >= 2">
                    Swap
                  </button>
                }
              </div>

              <!-- Team 2 non-core picks -->
              <div class="swap-team-panel">
                <div class="swap-team-name">{{ auction()!.team2.teamName }}</div>
                @for (pid of nonCorePicks(auction()!.team2); track pid) {
                  <div class="swap-player-item"
                    [class.selected-swap]="swapSelection().team2Pid === pid"
                    (click)="selectSwapPlayer(2, pid)">
                    <span>{{ getPlayer(pid)?.name }}</span>
                    @if (getPlayer(pid)?.isTemp) { <span class="temp-tag sm">Temp</span> }
                  </div>
                }
                @if (nonCorePicks(auction()!.team2).length === 0) {
                  <div class="swap-empty">No non-core players to swap</div>
                }
              </div>
            </div>

            <div class="swap-footer-actions">
              <button class="btn-finish-swap" (click)="showFinishConfirm.set(true)">
                ✅ Finish &amp; Save Match
              </button>
            </div>
          </div>
        </div>
      }

      <!-- COMPLETED PHASE -->
      @if (auction()?.phase === 'completed') {
        <div class="center-screen">
          <div class="completed-card">
            <div class="comp-trophy">🏆</div>
            <h2 class="comp-title">Match Saved!</h2>
            <p class="comp-sub">Weekly auction completed successfully.</p>
            <button class="btn-back-home" (click)="auctionCompleted.emit()">← Back to Home</button>
          </div>
        </div>
      }

      <!-- Finish confirm modal -->
      @if (showFinishConfirm()) {
        <div class="modal-overlay">
          <div class="confirm-box">
            <h3>Complete Weekly Auction?</h3>
            <p>This will save the match result and return to the home screen.</p>
            <div class="modal-actions">
              <button class="btn-ghost" (click)="showFinishConfirm.set(false)">Cancel</button>
              <button class="btn-confirm" (click)="finishAndSave()">Yes, Save Match</button>
            </div>
          </div>
        </div>
      }

      <!-- Swap confirm modal (when max reached but trying again) -->
      @if (swapMaxMsg()) {
        <div class="toast-msg">{{ swapMaxMsg() }}</div>
      }

    </div>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
    .wa-root { display: flex; flex-direction: column; height: 100vh; overflow: hidden; background: #0f172a; }

    /* Top bar */
    .top-bar {
      height: 52px; min-height: 52px; background: #1e293b; border-bottom: 1px solid #334155;
      display: flex; align-items: center; justify-content: space-between; padding: 0 20px; flex-shrink: 0;
    }
    .top-bar-left, .top-bar-right { display: flex; align-items: center; gap: 14px; }
    .logo { font-size: 1.05rem; font-weight: 700; color: #f8fafc; }
    .phase-badge { padding: 3px 10px; border-radius: 99px; font-size: 0.72rem; font-weight: 600; }
    .phase-toss { background: #f59e0b; color: #0f172a; }
    .phase-picking { background: #22c55e; color: #0f172a; }
    .phase-swap { background: #a78bfa; color: #0f172a; }
    .phase-completed { background: #475569; color: #f8fafc; }
    .pool-stat { font-size: 0.78rem; color: #64748b; }
    .btn-finish {
      background: transparent; border: 1px solid #f59e0b; color: #f59e0b;
      border-radius: 8px; padding: 6px 14px; font-size: 0.78rem; cursor: pointer; transition: all 0.2s;
    }
    .btn-finish:hover { background: rgba(245,158,11,0.1); }

    /* Center screen layout */
    .center-screen {
      flex: 1; display: flex; align-items: center; justify-content: center; overflow: auto; padding: 24px;
    }

    /* Toss */
    .toss-card {
      background: #1e293b; border: 1px solid #334155; border-radius: 16px;
      padding: 36px 40px; text-align: center; max-width: 620px; width: 100%;
    }
    .toss-title { font-size: 1.8rem; font-weight: 800; color: #f8fafc; margin: 0 0 8px; }
    .toss-sub { color: #94a3b8; margin: 0 0 32px; font-size: 0.95rem; min-height: 1.4em; }
    .toss-sub strong { color: #22c55e; }

    /* Toss row layout */
    .toss-row { display: flex; align-items: center; gap: 24px; }
    .toss-team-block {
      flex: 1; padding: 18px 14px; border-radius: 12px; border: 2px solid #334155;
      background: #0f172a; display: flex; flex-direction: column; align-items: center; gap: 6px;
      transition: all 0.4s;
    }
    .toss-team-block.toss-winner {
      border-color: #22c55e; background: rgba(34,197,94,0.08);
      box-shadow: 0 0 20px rgba(34,197,94,0.2);
    }
    .toss-side-label { font-size: 0.65rem; font-weight: 800; letter-spacing: 0.12em; color: #475569; text-transform: uppercase; }
    .toss-team-name { font-size: 1.05rem; font-weight: 700; color: #f8fafc; text-align: center; }
    .toss-captain { font-size: 0.78rem; color: #64748b; }

    /* Coin */
    .coin-area {
      display: flex; flex-direction: column; align-items: center; gap: 16px; flex-shrink: 0; width: 130px;
    }
    .coin-wrap {
      width: 100px; height: 100px; position: relative;
      transform-style: preserve-3d; perspective: 600px;
    }
    .coin-face {
      position: absolute; inset: 0; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 3.2rem; backface-visibility: hidden;
      background: radial-gradient(circle at 35% 35%, #fde68a, #f59e0b);
      box-shadow: 0 4px 20px rgba(245,158,11,0.45);
    }
    .coin-back { transform: rotateY(180deg); }

    /* Flipping animation */
    .coin-wrap.flipping {
      animation: coinFlip 2s cubic-bezier(0.4, 0.0, 0.2, 1) forwards;
    }
    .coin-wrap.heads { transform: rotateY(0deg); }
    .coin-wrap.tails { transform: rotateY(180deg); }
    @keyframes coinFlip {
      0%   { transform: rotateY(0deg); }
      15%  { transform: rotateY(360deg); }
      30%  { transform: rotateY(720deg); }
      50%  { transform: rotateY(1080deg); }
      70%  { transform: rotateY(1440deg); }
      85%  { transform: rotateY(1620deg); }
      100% { transform: rotateY(var(--flip-end, 1800deg)); }
    }

    .btn-flip {
      background: #f59e0b; border: none; color: #0f172a;
      border-radius: 10px; padding: 10px 22px; font-size: 1rem; font-weight: 800;
      cursor: pointer; transition: all 0.2s; letter-spacing: 0.02em;
    }
    .btn-flip:hover { background: #fbbf24; transform: translateY(-1px); }
    .flip-status { font-size: 0.82rem; color: #64748b; margin: 0; animation: blink 0.7s infinite; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
    .btn-confirm-toss {
      background: #22c55e; border: none; color: #0f172a;
      border-radius: 10px; padding: 10px 18px; font-size: 0.9rem; font-weight: 700;
      cursor: pointer; transition: all 0.2s;
    }
    .btn-confirm-toss:hover { opacity: 0.85; }

    /* Pick layout */
    .pick-layout { flex: 1; display: flex; overflow: hidden; }
    .panel { display: flex; flex-direction: column; border-right: 1px solid #334155; overflow: hidden; }
    .panel-left { width: 25%; min-width: 180px; }
    .panel-mid { flex: 1; border-right: none; }
    .panel-right { width: 26%; min-width: 180px; }
    .panel-header {
      padding: 10px 14px; background: #1e293b; border-bottom: 1px solid #334155;
      font-size: 0.8rem; font-weight: 600; color: #94a3b8;
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    .count-badge { background: #334155; color: #94a3b8; padding: 2px 8px; border-radius: 99px; font-size: 0.7rem; }
    .panel-scroll { flex: 1; overflow-y: auto; padding: 8px; }
    .empty-panel { text-align: center; color: #475569; padding: 16px 8px; font-size: 0.8rem; }

    /* Pool cards (left) */
    .player-chip {
      padding: 8px 10px; border-radius: 8px; margin-bottom: 5px;
      background: #1e293b; border: 1px solid #334155;
    }
    .player-chip.core-chip { border-color: rgba(245,158,11,0.4); background: rgba(245,158,11,0.04); }
    .pc-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
    .pc-name { font-size: 0.83rem; color: #e2e8f0; font-weight: 500; }
    .pc-sub { font-size: 0.7rem; color: #64748b; display: block; margin-top: 1px; }
    .core-tag {
      font-size: 0.62rem; background: rgba(245,158,11,0.2); color: #f59e0b;
      padding: 1px 6px; border-radius: 99px; font-weight: 600;
    }
    .core-tag.sm { font-size: 0.6rem; }
    .temp-tag {
      font-size: 0.62rem; background: rgba(167,139,250,0.2); color: #a78bfa;
      padding: 1px 6px; border-radius: 99px; font-weight: 600;
    }
    .temp-tag.sm { font-size: 0.6rem; }

    /* Middle pick turn */
    .pick-turn-header {
      padding: 14px 22px; background: #1e293b; border-bottom: 1px solid #334155;
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    .pick-turn-info { display: flex; flex-direction: column; gap: 2px; }
    .pick-turn-label { font-size: 0.7rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.06em; }
    .pick-captain-name { font-size: 1.55rem; font-weight: 800; color: #f8fafc; }
    .pick-team-name { font-size: 0.82rem; color: #22c55e; }
    .pick-slots { text-align: center; }
    .slots-label { display: block; font-size: 0.7rem; color: #64748b; }
    .slots-val { font-size: 2rem; font-weight: 800; color: #22c55e; }

    /* Pick list */
    .pick-list-container { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
    .pick-list-hint { font-size: 0.8rem; color: #64748b; margin: 12px 22px 6px; flex-shrink: 0; }
    .pick-list { flex: 1; overflow-y: auto; padding: 0 14px 14px; }
    .pick-list-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px; border-radius: 10px; margin-bottom: 6px;
      background: #1e293b; border: 1px solid #334155; cursor: pointer; transition: all 0.2s;
    }
    .pick-list-item:hover, .pick-list-item.highlighted { border-color: #22c55e; background: rgba(34,197,94,0.07); }
    .pli-left { display: flex; flex-direction: column; gap: 4px; }
    .pli-name { font-size: 0.95rem; font-weight: 600; color: #f8fafc; }
    .pli-tags { display: flex; align-items: center; gap: 6px; }
    .pli-user { font-size: 0.72rem; color: #64748b; }
    .btn-pick-player {
      background: rgba(34,197,94,0.1); border: 1px solid #22c55e; color: #22c55e;
      border-radius: 8px; padding: 6px 14px; font-size: 0.8rem; font-weight: 600;
      cursor: pointer; transition: all 0.2s; white-space: nowrap;
    }
    .btn-pick-player:hover { background: rgba(34,197,94,0.22); }

    /* No pool state */
    .no-pool-state {
      flex: 1; display: flex; flex-direction: column; align-items: center;
      justify-content: center; gap: 14px; color: #475569; text-align: center; padding: 40px;
    }
    .np-icon { font-size: 3rem; }
    .no-pool-state p { font-size: 0.95rem; color: #94a3b8; margin: 0; }
    .btn-proceed-swap {
      background: rgba(167,139,250,0.15); border: 1px solid #a78bfa; color: #a78bfa;
      border-radius: 10px; padding: 10px 22px; font-size: 0.9rem; font-weight: 600;
      cursor: pointer; transition: all 0.2s;
    }
    .btn-proceed-swap:hover { background: rgba(167,139,250,0.25); }

    /* Right panel teams */
    .team-card {
      padding: 10px 12px; border-radius: 10px; margin-bottom: 8px;
      background: #1e293b; border: 1px solid #334155; transition: all 0.2s;
    }
    .team-card.current-team { border-color: #22c55e; background: rgba(34,197,94,0.06); }
    .tc-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
    .tc-info { display: flex; flex-direction: column; }
    .tc-name { font-size: 0.9rem; font-weight: 700; color: #f8fafc; }
    .tc-captain { font-size: 0.72rem; color: #94a3b8; }
    .picking-now { font-size: 0.7rem; background: rgba(34,197,94,0.2); color: #22c55e; padding: 2px 8px; border-radius: 99px; font-weight: 600; }
    .tc-members { border-top: 1px solid #334155; padding-top: 6px; }
    .tc-member { font-size: 0.78rem; color: #94a3b8; padding: 2px 0; display: flex; align-items: center; gap: 5px; }
    .core-dot { color: #f59e0b; font-size: 0.5rem; }
    .tc-empty { font-size: 0.75rem; color: #475569; padding-top: 4px; }

    /* Swap phase */
    .swap-card {
      background: #1e293b; border: 1px solid #334155; border-radius: 16px;
      padding: 32px 36px; max-width: 760px; width: 100%;
    }
    .swap-header { text-align: center; margin-bottom: 24px; }
    .swap-title { font-size: 1.5rem; font-weight: 800; color: #f8fafc; margin: 0 0 6px; }
    .swap-sub { color: #64748b; margin: 0 0 10px; font-size: 0.88rem; }
    .swap-count-row { display: flex; align-items: center; justify-content: center; gap: 14px; }
    .swap-used { font-size: 0.82rem; color: #94a3b8; }
    .swap-maxed { font-size: 0.78rem; background: rgba(239,68,68,0.15); color: #ef4444; padding: 2px 10px; border-radius: 99px; }
    .swap-teams-row { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px; }
    .swap-team-panel { flex: 1; }
    .swap-team-name { font-size: 0.9rem; font-weight: 700; color: #f8fafc; margin-bottom: 10px; text-align: center; }
    .swap-player-item {
      padding: 10px 14px; border-radius: 8px; margin-bottom: 6px;
      background: #0f172a; border: 2px solid #334155; cursor: pointer;
      transition: all 0.2s; display: flex; align-items: center; justify-content: space-between;
      font-size: 0.85rem; color: #e2e8f0;
    }
    .swap-player-item:hover { border-color: #a78bfa; background: rgba(167,139,250,0.06); }
    .swap-player-item.selected-swap { border-color: #a78bfa; background: rgba(167,139,250,0.15); }
    .swap-empty { font-size: 0.8rem; color: #475569; text-align: center; padding: 16px 0; }
    .swap-arrow-col { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 12px; padding-top: 30px; }
    .swap-arrow { font-size: 1.8rem; color: #475569; }
    .btn-do-swap {
      background: #a78bfa; border: none; color: #0f172a;
      border-radius: 8px; padding: 8px 18px; font-size: 0.85rem; font-weight: 700;
      cursor: pointer; transition: opacity 0.2s;
    }
    .btn-do-swap:hover:not(:disabled) { opacity: 0.85; }
    .btn-do-swap:disabled { opacity: 0.35; cursor: not-allowed; }
    .swap-footer-actions { text-align: center; }
    .btn-finish-swap {
      background: #22c55e; border: none; color: #0f172a;
      border-radius: 10px; padding: 12px 28px; font-size: 0.95rem; font-weight: 700;
      cursor: pointer; transition: opacity 0.2s;
    }
    .btn-finish-swap:hover { opacity: 0.85; }

    /* Completed */
    .completed-card {
      background: #1e293b; border: 1px solid #334155; border-radius: 16px;
      padding: 48px; text-align: center;
    }
    .comp-trophy { font-size: 4rem; margin-bottom: 14px; }
    .comp-title { font-size: 2rem; font-weight: 800; color: #f8fafc; margin: 0 0 8px; }
    .comp-sub { color: #64748b; margin: 0 0 24px; }
    .btn-back-home {
      background: #22c55e; border: none; color: #0f172a;
      border-radius: 10px; padding: 12px 28px; font-size: 0.95rem; font-weight: 700;
      cursor: pointer; transition: opacity 0.2s;
    }
    .btn-back-home:hover { opacity: 0.85; }

    /* Modal */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center; z-index: 999;
    }
    .confirm-box {
      background: #1e293b; border: 1px solid #334155; border-radius: 14px;
      padding: 28px; max-width: 400px; width: 90%;
    }
    .confirm-box h3 { font-size: 1.15rem; color: #f8fafc; margin: 0 0 10px; }
    .confirm-box p { color: #94a3b8; font-size: 0.88rem; margin: 0 0 20px; line-height: 1.5; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 12px; }
    .btn-ghost {
      background: transparent; border: 1px solid #334155; color: #94a3b8;
      border-radius: 8px; padding: 8px 16px; cursor: pointer; font-size: 0.88rem; transition: all 0.2s;
    }
    .btn-ghost:hover { border-color: #94a3b8; color: #f8fafc; }
    .btn-confirm {
      background: #22c55e; color: #0f172a; border: none;
      border-radius: 8px; padding: 8px 18px; cursor: pointer; font-size: 0.88rem; font-weight: 700; transition: opacity 0.2s;
    }
    .btn-confirm:hover { opacity: 0.85; }

    /* Toast */
    .toast-msg {
      position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
      background: #1e293b; border: 1px solid #ef4444; color: #ef4444;
      padding: 10px 22px; border-radius: 10px; font-size: 0.85rem; z-index: 1001;
    }
  `]
})
export class WeeklyAuctionComponent implements OnInit, OnDestroy {
  @Output() auctionCompleted = new EventEmitter<void>();

  private db = inject(DbService);
  private cdr = inject(ChangeDetectorRef);

  auction = signal<ActiveWeeklyAuction | null>(null);
  highlightedPid = signal<string | null>(null);
  showFinishConfirm = signal(false);
  swapMaxMsg = signal('');
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

  async ngOnInit() {
    const existing = await this.db.getCurrentWeeklyAuction();
    if (existing) this.auction.set(existing);
  }

  ngOnDestroy() {
    if (this.swapToastTimer) clearTimeout(this.swapToastTimer);
  }

  /** Called from parent when a new auction is started via wizard */
  loadAuction(a: ActiveWeeklyAuction) {
    this.auction.set(a);
  }

  getPlayer(pid: string): WeeklyPlayer | undefined {
    return this.auction()?.playerIndex[pid];
  }

  /** Is this player ID a core player (in either team's core lists)? */
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

    // Let the CSS animation play for 2s, then reveal result
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

    // Add to current team's pickedIds
    const team1 = a.currentPickTeamId === a.team1.teamId
      ? { ...a.team1, pickedIds: [...a.team1.pickedIds, pid] }
      : a.team1;
    const team2 = a.currentPickTeamId === a.team2.teamId
      ? { ...a.team2, pickedIds: [...a.team2.pickedIds, pid] }
      : a.team2;

    // Alternate pick team
    const nextTeamId = a.currentPickTeamId === a.team1.teamId ? a.team2.teamId : a.team1.teamId;

    const updated: ActiveWeeklyAuction = {
      ...a, pool, team1, team2,
      currentPickTeamId: pool.length > 0 ? nextTeamId : a.currentPickTeamId,
      phase: pool.length > 0 ? 'picking' : 'picking' // stays picking until manually advanced
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
