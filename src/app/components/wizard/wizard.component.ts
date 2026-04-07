import {
  Component, OnInit, Output, EventEmitter, signal, computed, inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DbService } from '../../services/db.service';
import { Team, Player, ActiveAuction, AuctionTeamEntry } from '../../models/models';

interface WizardPlayer extends Player {
  _tempId: number;
}

interface TeamInput {
  idx: number;
  name: string;
  existingId?: number;
  /** Stable key used within wizard for captain assignment. equals existingId for DB teams, or 1000+idx for new ones */
  tempKey: number;
}

@Component({
  selector: 'app-wizard',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './wizard.component.html',
  styleUrls: ['./wizard.component.css']
})
export class WizardComponent implements OnInit {
  @Output() auctionStarted = new EventEmitter<ActiveAuction>();

  private db = inject(DbService);

  steps = [{ num: 1 }, { num: 2 }, { num: 3 }];
  step = signal(1);
  finishing = signal(false);

  teamCount = 4;
  teamCountOptions = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  teamInputs = signal<TeamInput[]>([]);
  step1Error = signal('');

  coreMembersCount = signal(3);
  coreMemberOptions = [2, 3, 4, 5, 6];

  // _teamKey is the tempKey used for captain team assignment within wizard
  players = signal<(WizardPlayer & { _teamKey?: number })[]>([]);
  newPlayer: { name?: string; cricherosUsername?: string; cricherosId?: string; isCaptain?: boolean; teamKey?: number } = {};
  addPlayerError = signal('');
  step3Error = signal('');

  private existingTeams: Team[] = [];
  private nextTempId = 1;

  availableTeamsForNewCaptain = computed(() => {
    const usedKeys = new Set(
      this.players().filter(p => p.isCaptain && p._teamKey != null).map(p => p._teamKey!)
    );
    return this.teamInputs()
      .filter(t => t.name.trim())
      .filter(t => !usedKeys.has(t.tempKey));
  });

  async ngOnInit() {
    await this.db.init();
    this.existingTeams = await this.db.getTeams();
    const existingPlayers = await this.db.getPlayers();
    this.initTeamInputs();

    // Load players; map their saved teamId to tempKey (for existing teams, tempKey == teamId)
    this.players.set(
      existingPlayers.map(p => ({
        ...p,
        _tempId: this.nextTempId++,
        _teamKey: p.isCaptain ? p.teamId : undefined
      }))
    );
  }

  initTeamInputs() {
    const inputs: TeamInput[] = Array.from({ length: this.teamCount }, (_, i) => {
      const existing = this.existingTeams[i];
      return {
        idx: i,
        name: existing?.name || '',
        existingId: existing?.id,
        // For existing teams: tempKey = real DB id; for new teams: high number to avoid collision
        tempKey: existing?.id ?? (1000 + i)
      };
    });
    this.teamInputs.set(inputs);
  }

  onTeamCountChange(n: number) {
    this.teamCount = +n;
    this.initTeamInputs();
  }

  onCaptainToggle() {
    if (!this.newPlayer.isCaptain) {
      this.newPlayer.teamKey = undefined;
    }
  }

  getTeamNameByKey(tempKey: number): string {
    return this.teamInputs().find(t => t.tempKey === tempKey)?.name || '?';
  }

  addPlayer() {
    this.addPlayerError.set('');
    if (!this.newPlayer.name?.trim()) {
      this.addPlayerError.set('Player name is required');
      return;
    }
    if (this.newPlayer.isCaptain) {
      if (this.newPlayer.teamKey == null) {
        this.addPlayerError.set('Select a team for this captain');
        return;
      }
      const alreadyCaptain = this.players().find(
        p => p.isCaptain && p._teamKey === this.newPlayer.teamKey
      );
      if (alreadyCaptain) {
        this.addPlayerError.set(`${this.getTeamNameByKey(this.newPlayer.teamKey)} already has a captain`);
        return;
      }
    }
    const p = {
      name: this.newPlayer.name!.trim(),
      cricherosUsername: this.newPlayer.cricherosUsername?.trim() || undefined,
      cricherosId: this.newPlayer.cricherosId?.trim() || undefined,
      isCaptain: this.newPlayer.isCaptain || false,
      isActive: true,
      _tempId: this.nextTempId++,
      _teamKey: this.newPlayer.isCaptain ? this.newPlayer.teamKey : undefined
    };
    this.players.update(list => [...list, p]);
    this.newPlayer = {};
  }

  removePlayer(tempId: number) {
    this.players.update(list => list.filter(p => p._tempId !== tempId));
  }

  toggleActive(p: WizardPlayer) {
    this.players.update(list =>
      list.map(pl => pl._tempId === p._tempId ? { ...pl, isActive: !pl.isActive } : pl)
    );
  }

  nextStep() {
    this.step1Error.set('');
    if (this.step() === 1) {
      const names = this.teamInputs().map(t => t.name.trim());
      if (names.some(n => !n)) { this.step1Error.set('All team names are required'); return; }
      if (new Set(names).size !== names.length) { this.step1Error.set('Team names must be unique'); return; }
    }
    this.step.update(s => s + 1);
  }

  prevStep() { this.step.update(s => s - 1); }

  async finish() {
    this.step3Error.set('');
    const activePlayers = this.players().filter(p => p.isActive !== false);
    const captains = activePlayers.filter(p => p.isCaptain && p._teamKey != null);
    const inputs = this.teamInputs();

    if (captains.length !== this.teamCount) {
      this.step3Error.set(
        `Each team needs exactly one captain. Found ${captains.length} captains for ${this.teamCount} teams.`
      );
      return;
    }
    const captainKeys = new Set(captains.map(c => c._teamKey));
    if (captainKeys.size !== captains.length) {
      this.step3Error.set('Multiple captains are assigned to the same team');
      return;
    }

    this.finishing.set(true);
    try {
      // Save teams and build tempKey → real DB id map
      const savedTeams: Array<{ id: number; name: string; tempKey: number }> = [];
      for (let i = 0; i < this.teamCount; i++) {
        const inp = inputs[i];
        const teamData: Team = { name: inp.name.trim(), isActive: true };
        let realId: number;
        if (inp.existingId) {
          teamData.id = inp.existingId;
          await this.db.saveTeam(teamData);
          realId = inp.existingId;
        } else {
          realId = (await this.db.saveTeam(teamData)) as number;
        }
        savedTeams.push({ id: realId, name: teamData.name, tempKey: inp.tempKey });
      }

      const tempKeyToId: { [key: number]: number } = {};
      savedTeams.forEach(t => { tempKeyToId[t.tempKey] = t.id; });

      // Save players
      const savedPlayers: Player[] = [];
      for (const wp of this.players()) {
        const realTeamId = wp.isCaptain && wp._teamKey != null
          ? (tempKeyToId[wp._teamKey] ?? wp.teamId)
          : undefined;

        const playerData: Player = {
          name: wp.name,
          cricherosUsername: wp.cricherosUsername,
          cricherosId: wp.cricherosId,
          isCaptain: wp.isCaptain,
          teamId: realTeamId,
          isActive: wp.isActive
        };
        let savedId: number;
        if (wp.id) {
          playerData.id = wp.id;
          await this.db.savePlayer(playerData);
          savedId = wp.id;
        } else {
          savedId = (await this.db.savePlayer(playerData)) as number;
        }
        savedPlayers.push({ ...playerData, id: savedId });
      }

      // Build player snapshot
      const playerSnapshot: { [id: number]: Player } = {};
      savedPlayers.forEach(p => { playerSnapshot[p.id!] = p; });

      // Build auction team entries
      const auctionTeams: AuctionTeamEntry[] = savedTeams.map(st => {
        const captain = savedPlayers.find(p => p.isCaptain && p.teamId === st.id);
        return {
          teamId: st.id,
          teamName: st.name,
          captainId: captain?.id || 0,
          captainName: captain?.name || 'Unknown',
          memberIds: []
        };
      });

      // Non-captain active players are available for auction
      const availablePlayers = savedPlayers
        .filter(p => !p.isCaptain && p.isActive)
        .map(p => p.id!);

      const auction: ActiveAuction = {
        createdAt: new Date().toISOString(),
        status: 'active',
        coreMembersCount: this.coreMembersCount(),
        teams: auctionTeams,
        teamOrder: [],
        currentTeamIndex: 0,
        availablePlayers,
        unsoldPlayers: [],
        completedTeamIds: [],
        currentPlayerId: null,
        phase: 'shuffling',
        playerSnapshot
      };

      await this.db.saveCurrentAuction(auction);
      this.auctionStarted.emit(auction);
    } catch (err) {
      console.error(err);
      this.step3Error.set('Failed to save. Please try again.');
    } finally {
      this.finishing.set(false);
    }
  }
}
