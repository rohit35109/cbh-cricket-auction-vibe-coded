import { Injectable } from '@angular/core';
import { Team, Player, ActiveAuction, AuctionHistoryRecord, ActiveWeeklyAuction, WeeklyMatchRecord } from '../models/models';

@Injectable({ providedIn: 'root' })
export class DbService {
  private db!: IDBDatabase;
  private readonly DB_NAME = 'CricketAuctionDB';
  private readonly DB_VERSION = 2;
  private initPromise: Promise<void> | null = null;

  init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('teams')) {
          db.createObjectStore('teams', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('players')) {
          db.createObjectStore('players', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('currentAuction')) {
          db.createObjectStore('currentAuction', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('auctionHistory')) {
          db.createObjectStore('auctionHistory', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('currentWeeklyAuction')) {
          db.createObjectStore('currentWeeklyAuction', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('weeklyMatchHistory')) {
          db.createObjectStore('weeklyMatchHistory', { keyPath: 'id', autoIncrement: true });
        }
      };
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
    return this.initPromise;
  }

  private tx<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(storeName, mode);
      const store = tx.objectStore(storeName);
      const req = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // Teams
  getTeams(): Promise<Team[]> {
    return this.tx<Team[]>('teams', 'readonly', s => s.getAll());
  }
  saveTeam(team: Team): Promise<IDBValidKey> {
    return team.id
      ? this.tx('teams', 'readwrite', s => s.put(team))
      : this.tx('teams', 'readwrite', s => s.add(team));
  }
  deleteTeam(id: number): Promise<undefined> {
    return this.tx<undefined>('teams', 'readwrite', s => s.delete(id));
  }

  // Players
  getPlayers(): Promise<Player[]> {
    return this.tx<Player[]>('players', 'readonly', s => s.getAll());
  }
  savePlayer(player: Player): Promise<IDBValidKey> {
    return player.id
      ? this.tx('players', 'readwrite', s => s.put(player))
      : this.tx('players', 'readwrite', s => s.add(player));
  }
  deletePlayer(id: number): Promise<undefined> {
    return this.tx<undefined>('players', 'readwrite', s => s.delete(id));
  }

  // Current Auction (stored with fixed id=1)
  getCurrentAuction(): Promise<ActiveAuction | undefined> {
    return this.tx<ActiveAuction | undefined>('currentAuction', 'readonly', s => s.get(1));
  }
  saveCurrentAuction(auction: ActiveAuction): Promise<IDBValidKey> {
    const data = { ...auction, id: 1 };
    return this.tx('currentAuction', 'readwrite', s => s.put(data));
  }
  clearCurrentAuction(): Promise<undefined> {
    return this.tx<undefined>('currentAuction', 'readwrite', s => s.delete(1));
  }

  // Auction History
  getAuctionHistory(): Promise<AuctionHistoryRecord[]> {
    return this.tx<AuctionHistoryRecord[]>('auctionHistory', 'readonly', s => s.getAll());
  }
  saveAuctionHistory(record: AuctionHistoryRecord): Promise<IDBValidKey> {
    return this.tx('auctionHistory', 'readwrite', s => s.add(record));
  }

  // Current Weekly Auction (stored with fixed id=1)
  getCurrentWeeklyAuction(): Promise<ActiveWeeklyAuction | undefined> {
    return this.tx<ActiveWeeklyAuction | undefined>('currentWeeklyAuction', 'readonly', s => s.get(1));
  }
  saveCurrentWeeklyAuction(auction: ActiveWeeklyAuction): Promise<IDBValidKey> {
    const data = { ...auction, id: 1 };
    return this.tx('currentWeeklyAuction', 'readwrite', s => s.put(data));
  }
  clearCurrentWeeklyAuction(): Promise<undefined> {
    return this.tx<undefined>('currentWeeklyAuction', 'readwrite', s => s.delete(1));
  }

  // Weekly Match History
  getWeeklyMatchHistory(): Promise<WeeklyMatchRecord[]> {
    return this.tx<WeeklyMatchRecord[]>('weeklyMatchHistory', 'readonly', s => s.getAll());
  }
  saveWeeklyMatch(record: WeeklyMatchRecord): Promise<IDBValidKey> {
    return this.tx('weeklyMatchHistory', 'readwrite', s => s.add(record));
  }
}
