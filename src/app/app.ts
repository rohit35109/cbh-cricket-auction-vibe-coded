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
  templateUrl: './app.html',
  styleUrls: ['./app.css']
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
