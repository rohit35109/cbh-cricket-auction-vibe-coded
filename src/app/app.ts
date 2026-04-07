import {
  Component, OnInit, signal, inject, ViewChild
} from '@angular/core';
import { DbService } from './services/db.service';
import { ActiveAuction, ActiveWeeklyAuction } from './models/models';
import { WizardComponent } from './components/wizard/wizard.component';
import { AuctionScreenComponent } from './components/auction-screen/auction-screen.component';
import { HistoryModalComponent } from './components/history-modal/history-modal.component';
import { WeeklyWizardComponent } from './components/weekly-wizard/weekly-wizard.component';
import { WeeklyAuctionComponent } from './components/weekly-auction/weekly-auction.component';
import { ManageComponent } from './components/manage/manage.component';

type View = 'landing' | 'auction' | 'weekly-auction';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [WizardComponent, AuctionScreenComponent, HistoryModalComponent, WeeklyWizardComponent, WeeklyAuctionComponent, ManageComponent],
  template: `
    <div class="app-shell">

      <!-- ══ LANDING ══ -->
      @if (view() === 'landing') {
        <div class="landing">
          <div class="landing-bg">
            <div class="landing-card">
              <div class="landing-logo">🏏</div>
              <h1 class="landing-title">Cricket Auction</h1>
              <p class="landing-sub">
                Internal team auction platform — pick your squad, own your game.
              </p>

              <div class="landing-actions">

                <!-- Main auction controls -->
                <div class="action-group">
                  <span class="group-label">Main Auction</span>
                  @if (hasActiveAuction()) {
                    <button class="btn-resume" (click)="resumeAuction()">▶ Resume Auction</button>
                    <button class="btn-start-new" (click)="startNew()">+ Start New Auction</button>
                  } @else {
                    <button class="btn-start" (click)="showWizard.set(true)">+ Start New Auction</button>
                  }
                </div>

                <!-- Weekly auction controls -->
                <div class="action-group">
                  <span class="group-label">Weekly Match</span>
                  @if (hasActiveWeeklyAuction()) {
                    <button class="btn-weekly-resume" (click)="resumeWeeklyAuction()">▶ Resume Weekly Auction</button>
                    <button class="btn-weekly" (click)="showWeeklyWizard.set(true)">⚡ New Weekly Auction</button>
                  } @else {
                    <button class="btn-weekly" (click)="showWeeklyWizard.set(true)">⚡ Weekly Auction</button>
                  }
                </div>

                <!-- Management -->
                <div class="action-group">
                  <span class="group-label">Manage</span>
                  <div class="manage-row">
                    <button class="btn-manage" (click)="showManage.set(true)">
                      👥 Teams &amp; Players
                    </button>
                    <button class="btn-history" (click)="showHistory.set(true)">
                      📜 History
                    </button>
                  </div>
                </div>

              </div>

              @if (hasActiveAuction()) {
                <div class="resume-hint">
                  <span class="hint-dot"></span>
                  A main auction is in progress — resume it or start fresh.
                </div>
              }
              @if (hasActiveWeeklyAuction()) {
                <div class="resume-hint weekly-hint">
                  <span class="hint-dot weekly-dot"></span>
                  A weekly auction is in progress.
                </div>
              }
            </div>
          </div>
        </div>
      }

      <!-- ══ MAIN AUCTION SCREEN ══ -->
      @if (view() === 'auction') {
        <app-auction-screen
          #auctionScreen
          (auctionCompleted)="onAuctionCompleted()"
        />
      }

      <!-- ══ WEEKLY AUCTION SCREEN ══ -->
      @if (view() === 'weekly-auction') {
        <app-weekly-auction
          #weeklyAuctionScreen
          (auctionCompleted)="onWeeklyAuctionCompleted()"
        />
      }

      <!-- ══ MAIN AUCTION WIZARD ══ -->
      @if (showWizard()) {
        <app-wizard (auctionStarted)="onAuctionStarted($event)" />
      }

      <!-- ══ WEEKLY WIZARD ══ -->
      @if (showWeeklyWizard()) {
        <app-weekly-wizard
          (cancel)="showWeeklyWizard.set(false)"
          (started)="onWeeklyAuctionStarted($event)"
        />
      }

      <!-- ══ HISTORY MODAL ══ -->
      @if (showHistory()) {
        <app-history-modal (close)="showHistory.set(false)" />
      }

      <!-- ══ MANAGE MODAL ══ -->
      @if (showManage()) {
        <app-manage (close)="showManage.set(false)" />
      }

      <!-- ══ CONFIRM: Start new main auction ══ -->
      @if (showNewConfirm()) {
        <div class="modal-overlay">
          <div class="confirm-box">
            <h3>Start a New Auction?</h3>
            <p>
              There is an active auction in progress. Starting a new one will
              <strong>discard the current session</strong>. This cannot be undone.
            </p>
            <div class="confirm-actions">
              <button class="btn-ghost" (click)="showNewConfirm.set(false)">Cancel</button>
              <button class="btn-danger" (click)="confirmStartNew()">Yes, Start New</button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .app-shell { width: 100vw; height: 100vh; overflow: hidden; background: #0f172a; }

    .landing { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
    .landing-bg {
      width: 100%; height: 100%;
      background: radial-gradient(ellipse at center, #0d2137 0%, #0f172a 70%);
      display: flex; align-items: center; justify-content: center;
    }
    .landing-card {
      text-align: center; padding: 48px 40px;
      background: rgba(30,41,59,0.6); border: 1px solid #334155;
      border-radius: 20px; max-width: 480px; width: 90%;
      backdrop-filter: blur(12px);
    }
    .landing-logo { font-size: 4rem; margin-bottom: 12px; }
    .landing-title {
      font-size: 2.4rem; font-weight: 800; color: #f8fafc; margin: 0 0 10px;
      letter-spacing: -0.02em;
    }
    .landing-sub { color: #64748b; font-size: 1rem; margin: 0 0 32px; line-height: 1.5; }
    .landing-actions { display: flex; flex-direction: column; gap: 14px; }

    /* Action groups */
    .action-group {
      border: 1px solid #1e293b; border-radius: 12px;
      padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;
    }
    .group-label { font-size: 0.7rem; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 2px; }

    /* Buttons */
    .btn-start, .btn-resume {
      width: 100%; padding: 13px 20px; border-radius: 10px;
      font-size: 0.95rem; font-weight: 600; cursor: pointer; border: none;
      background: #22c55e; color: #0f172a; transition: all 0.2s;
    }
    .btn-start:hover, .btn-resume:hover { opacity: 0.88; transform: translateY(-1px); }
    .btn-start-new {
      width: 100%; padding: 11px 20px; border-radius: 10px;
      font-size: 0.9rem; font-weight: 600; cursor: pointer;
      background: transparent; border: 1px solid #334155; color: #94a3b8; transition: all 0.2s;
    }
    .btn-start-new:hover { border-color: #22c55e; color: #22c55e; }

    .btn-weekly {
      width: 100%; padding: 13px 20px; border-radius: 10px;
      font-size: 0.95rem; font-weight: 600; cursor: pointer;
      background: rgba(167,139,250,0.1); border: 1px solid #a78bfa;
      color: #a78bfa; transition: all 0.2s;
    }
    .btn-weekly:hover { background: rgba(167,139,250,0.2); transform: translateY(-1px); }
    .btn-weekly-resume {
      width: 100%; padding: 13px 20px; border-radius: 10px;
      font-size: 0.95rem; font-weight: 600; cursor: pointer; border: none;
      background: #a78bfa; color: #0f172a; transition: all 0.2s;
    }
    .btn-weekly-resume:hover { opacity: 0.88; transform: translateY(-1px); }

    .manage-row { display: flex; gap: 8px; }
    .btn-manage {
      flex: 1; padding: 12px 14px; border-radius: 10px;
      font-size: 0.88rem; font-weight: 600; cursor: pointer;
      background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.4); color: #93c5fd; transition: all 0.2s;
    }
    .btn-manage:hover { background: rgba(59,130,246,0.18); }
    .btn-history {
      flex: 1; padding: 12px 14px; border-radius: 10px;
      font-size: 0.88rem; font-weight: 600; cursor: pointer;
      background: transparent; border: 1px solid #334155; color: #64748b; transition: all 0.2s;
    }
    .btn-history:hover { border-color: #475569; color: #94a3b8; }

    .resume-hint {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      margin-top: 16px; font-size: 0.78rem; color: #64748b;
    }
    .weekly-hint { margin-top: 6px; }
    .hint-dot {
      width: 8px; height: 8px; border-radius: 50%; background: #22c55e;
      animation: pulse 2s infinite; flex-shrink: 0;
    }
    .weekly-dot { background: #a78bfa; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.75);
      backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center; z-index: 2000;
    }
    .confirm-box {
      background: #1e293b; border: 1px solid #334155; border-radius: 14px;
      padding: 28px; max-width: 420px; width: 90%;
    }
    .confirm-box h3 { font-size: 1.2rem; color: #f8fafc; margin: 0 0 10px; }
    .confirm-box p { color: #94a3b8; font-size: 0.9rem; margin: 0 0 22px; line-height: 1.5; }
    .confirm-box strong { color: #f87171; }
    .confirm-actions { display: flex; justify-content: flex-end; gap: 10px; }
    .btn-ghost {
      background: transparent; border: 1px solid #334155; color: #94a3b8;
      border-radius: 8px; padding: 9px 18px; font-size: 0.9rem; cursor: pointer; transition: all 0.2s;
    }
    .btn-ghost:hover { border-color: #94a3b8; color: #f8fafc; }
    .btn-danger {
      background: #ef4444; color: white; border: none;
      border-radius: 8px; padding: 9px 18px; font-size: 0.9rem; cursor: pointer; transition: opacity 0.2s;
    }
    .btn-danger:hover { opacity: 0.85; }
  `]
})
export class App implements OnInit {
  @ViewChild('auctionScreen') auctionScreenRef!: AuctionScreenComponent;
  @ViewChild('weeklyAuctionScreen') weeklyAuctionScreenRef!: WeeklyAuctionComponent;

  private db = inject(DbService);

  view = signal<View>('landing');
  showWizard = signal(false);
  showWeeklyWizard = signal(false);
  showHistory = signal(false);
  showManage = signal(false);
  showNewConfirm = signal(false);
  hasActiveAuction = signal(false);
  hasActiveWeeklyAuction = signal(false);

  private activeAuction: ActiveAuction | null = null;
  private activeWeeklyAuction: ActiveWeeklyAuction | null = null;

  async ngOnInit() {
    await this.db.init();

    const current = await this.db.getCurrentAuction();
    if (current && current.status === 'active') {
      this.activeAuction = current;
      this.hasActiveAuction.set(true);
    }

    const weekly = await this.db.getCurrentWeeklyAuction();
    if (weekly && weekly.status === 'active') {
      this.activeWeeklyAuction = weekly;
      this.hasActiveWeeklyAuction.set(true);
    }
  }

  // ── Main Auction ────────────────────────────────────────────────────
  resumeAuction() {
    if (!this.activeAuction) return;
    this.view.set('auction');
    setTimeout(() => {
      this.auctionScreenRef?.loadAuction(this.activeAuction!);
    }, 50);
  }

  startNew() {
    if (this.hasActiveAuction()) {
      this.showNewConfirm.set(true);
    } else {
      this.showWizard.set(true);
    }
  }

  async confirmStartNew() {
    await this.db.clearCurrentAuction();
    this.activeAuction = null;
    this.hasActiveAuction.set(false);
    this.showNewConfirm.set(false);
    this.showWizard.set(true);
  }

  onAuctionStarted(auction: ActiveAuction) {
    this.activeAuction = auction;
    this.hasActiveAuction.set(true);
    this.showWizard.set(false);
    this.view.set('auction');
    setTimeout(() => {
      this.auctionScreenRef?.loadAuction(auction);
    }, 50);
  }

  onAuctionCompleted() {
    this.activeAuction = null;
    this.hasActiveAuction.set(false);
    this.view.set('landing');
  }

  // ── Weekly Auction ──────────────────────────────────────────────────
  resumeWeeklyAuction() {
    if (!this.activeWeeklyAuction) return;
    this.view.set('weekly-auction');
    setTimeout(() => {
      this.weeklyAuctionScreenRef?.loadAuction(this.activeWeeklyAuction!);
    }, 50);
  }

  onWeeklyAuctionStarted(auction: ActiveWeeklyAuction) {
    this.activeWeeklyAuction = auction;
    this.hasActiveWeeklyAuction.set(true);
    this.showWeeklyWizard.set(false);
    this.view.set('weekly-auction');
    setTimeout(() => {
      this.weeklyAuctionScreenRef?.loadAuction(auction);
    }, 50);
  }

  onWeeklyAuctionCompleted() {
    this.activeWeeklyAuction = null;
    this.hasActiveWeeklyAuction.set(false);
    this.view.set('landing');
  }
}
