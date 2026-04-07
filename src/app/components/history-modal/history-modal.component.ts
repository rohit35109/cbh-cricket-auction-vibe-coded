import {
  Component, OnInit, Output, EventEmitter, signal, computed, inject
} from '@angular/core';
import { DbService } from '../../services/db.service';
import { AuctionHistoryRecord, WeeklyMatchRecord } from '../../models/models';

@Component({
  selector: 'app-history-modal',
  standalone: true,
  templateUrl: './history-modal.component.html',
  styleUrls: ['./history-modal.component.css']
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
