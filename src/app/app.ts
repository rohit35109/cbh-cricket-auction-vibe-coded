import {
  Component, OnInit, signal, inject, ViewChild
} from '@angular/core';
import { DbService } from './services/db.service';
import { ActiveAuction } from './models/models';
import { WizardComponent } from './components/wizard/wizard.component';
import { AuctionScreenComponent } from './components/auction-screen/auction-screen.component';
import { HistoryModalComponent } from './components/history-modal/history-modal.component';

type View = 'landing' | 'auction';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [WizardComponent, AuctionScreenComponent, HistoryModalComponent],
  template: `
    <div class="app-shell">

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
                @if (hasActiveAuction()) {
                  <button class="btn-resume" (click)="resumeAuction()">
                    ▶ Resume Auction
                  </button>
                  <button class="btn-start-new" (click)="startNew()">
                    + Start New Auction
                  </button>
                } @else {
                  <button class="btn-start" (click)="showWizard.set(true)">
                    + Start New Auction
                  </button>
                }

                <button class="btn-history" (click)="showHistory.set(true)">
                  📜 View History
                </button>
              </div>

              @if (hasActiveAuction()) {
                <div class="resume-hint">
                  <span class="hint-dot"></span>
                  An auction is in progress — resume it or start fresh.
                </div>
              }
            </div>
          </div>
        </div>
      }

      @if (view() === 'auction') {
        <app-auction-screen
          #auctionScreen
          (auctionCompleted)="onAuctionCompleted()"
        />
      }

      @if (showWizard()) {
        <app-wizard (auctionStarted)="onAuctionStarted($event)" />
      }

      @if (showHistory()) {
        <app-history-modal (close)="showHistory.set(false)" />
      }

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
      border-radius: 20px; max-width: 460px; width: 90%;
      backdrop-filter: blur(12px);
    }
    .landing-logo { font-size: 4rem; margin-bottom: 12px; }
    .landing-title {
      font-size: 2.4rem; font-weight: 800; color: #f8fafc; margin: 0 0 10px;
      letter-spacing: -0.02em;
    }
    .landing-sub { color: #64748b; font-size: 1rem; margin: 0 0 36px; line-height: 1.5; }
    .landing-actions { display: flex; flex-direction: column; gap: 12px; }

    .btn-start, .btn-resume {
      width: 100%; padding: 14px 20px; border-radius: 10px;
      font-size: 1rem; font-weight: 600; cursor: pointer; border: none;
      background: #22c55e; color: #0f172a; transition: all 0.2s;
    }
    .btn-start:hover, .btn-resume:hover { opacity: 0.88; transform: translateY(-1px); }
    .btn-start-new {
      width: 100%; padding: 14px 20px; border-radius: 10px;
      font-size: 1rem; font-weight: 600; cursor: pointer;
      background: transparent; border: 1px solid #334155; color: #94a3b8; transition: all 0.2s;
    }
    .btn-start-new:hover { border-color: #22c55e; color: #22c55e; }
    .btn-history {
      width: 100%; padding: 14px 20px; border-radius: 10px;
      font-size: 1rem; font-weight: 600; cursor: pointer;
      background: transparent; border: 1px solid #334155; color: #64748b; transition: all 0.2s;
    }
    .btn-history:hover { border-color: #475569; color: #94a3b8; }

    .resume-hint {
      display: flex; align-items: center; justify-content: center; gap: 8px;
      margin-top: 18px; font-size: 0.8rem; color: #64748b;
    }
    .hint-dot {
      width: 8px; height: 8px; border-radius: 50%; background: #22c55e;
      animation: pulse 2s infinite;
    }
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

  private db = inject(DbService);

  view = signal<View>('landing');
  showWizard = signal(false);
  showHistory = signal(false);
  showNewConfirm = signal(false);
  hasActiveAuction = signal(false);

  private activeAuction: ActiveAuction | null = null;

  async ngOnInit() {
    await this.db.init();
    const current = await this.db.getCurrentAuction();
    if (current && current.status === 'active') {
      this.activeAuction = current;
      this.hasActiveAuction.set(true);
    }
  }

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
}
