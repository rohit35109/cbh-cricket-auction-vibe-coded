import {
  Component, OnInit, Output, EventEmitter, signal, computed, inject
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DbService } from '../../services/db.service';
import { Team, Player } from '../../models/models';

type Tab = 'players' | 'teams';

interface PlayerRow extends Player {
  id: number;
  teamName: string;
  editing: boolean;
  editName: string;
  editUsername: string;
  editCricherosId: string;
  editTeamId: number | null;
  editIsCaptain: boolean;
}

interface TeamRow extends Team {
  id: number;
  captainName: string;
  playerCount: number;
  editing: boolean;
  editName: string;
  changingCaptain: boolean;
}

@Component({
  selector: 'app-manage',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './manage.component.html',
  styleUrls: ['./manage.component.css']
})
export class ManageComponent implements OnInit {
  @Output() close = new EventEmitter<void>();

  private db = inject(DbService);

  tab = signal<Tab>('players');
  loading = signal(true);

  allPlayers = signal<Player[]>([]);
  allTeams = signal<Team[]>([]);

  // Add player form
  showAddPlayer = signal(false);
  addPlayerError = signal('');
  newPlayer = { name: '', teamId: null as number | null, cricherosUsername: '', cricherosId: '', isCaptain: false };

  // Add team form
  showAddTeam = signal(false);
  addTeamError = signal('');
  newTeamName = '';

  // Inactive toggles
  showInactive = signal(false);
  showInactiveTeams = signal(false);

  // Derived lists
  activeTeams = computed(() => this.allTeams().filter(t => t.isActive));
  inactiveTeams = computed(() => this.allTeams().filter(t => !t.isActive) as TeamRow[]);

  activePlayers = computed((): PlayerRow[] => {
    return this.allPlayers()
      .filter(p => p.isActive)
      .map(p => ({
        ...p,
        id: p.id!,
        teamName: this.teamName(p.teamId),
        editing: false,
        editName: p.name,
        editUsername: p.cricherosUsername || '',
        editCricherosId: p.cricherosId || '',
        editTeamId: p.teamId ?? null,
        editIsCaptain: p.isCaptain
      }));
  });

  inactivePlayers = computed((): PlayerRow[] => {
    return this.allPlayers()
      .filter(p => !p.isActive)
      .map(p => ({
        ...p,
        id: p.id!,
        teamName: this.teamName(p.teamId),
        editing: false,
        editName: p.name,
        editUsername: p.cricherosUsername || '',
        editCricherosId: p.cricherosId || '',
        editTeamId: p.teamId ?? null,
        editIsCaptain: p.isCaptain
      }));
  });

  teamRows = computed((): TeamRow[] => {
    return this.allTeams().map(t => ({
      ...t,
      id: t.id!,
      captainName: this.captainNameForTeam(t.id!),
      playerCount: this.allPlayers().filter(p => p.isActive && p.teamId === t.id).length,
      editing: false,
      editName: t.name,
      changingCaptain: false
    }));
  });

  async ngOnInit() {
    await this.reload();
  }

  private async reload() {
    const [teams, players] = await Promise.all([this.db.getTeams(), this.db.getPlayers()]);
    this.allTeams.set(teams);
    this.allPlayers.set(players);
    this.loading.set(false);
  }

  private teamName(teamId: number | undefined): string {
    if (!teamId) return '';
    return this.allTeams().find(t => t.id === teamId)?.name || '';
  }

  private captainNameForTeam(teamId: number): string {
    return this.allPlayers().find(p => p.isActive && p.teamId === teamId && p.isCaptain)?.name || '—';
  }

  playersForTeam(teamId: number): PlayerRow[] {
    return this.activePlayers().filter(p => p.teamId === teamId);
  }

  // ── Add Player ─────────────────────────────────────────────────
  async addPlayer() {
    this.addPlayerError.set('');
    if (!this.newPlayer.name.trim()) { this.addPlayerError.set('Name is required.'); return; }

    if (this.newPlayer.isCaptain && this.newPlayer.teamId) {
      await this.removeCaptainFromTeam(this.newPlayer.teamId);
    }

    await this.db.savePlayer({
      name: this.newPlayer.name.trim(),
      teamId: this.newPlayer.teamId ?? undefined,
      cricherosUsername: this.newPlayer.cricherosUsername.trim() || undefined,
      cricherosId: this.newPlayer.cricherosId.trim() || undefined,
      isCaptain: this.newPlayer.isCaptain,
      isActive: true
    });

    this.newPlayer = { name: '', teamId: null, cricherosUsername: '', cricherosId: '', isCaptain: false };
    this.showAddPlayer.set(false);
    await this.reload();
  }

  // ── Edit Player ────────────────────────────────────────────────
  startEditPlayer(p: PlayerRow) {
    this.activePlayers().forEach(ap => { if (ap.id !== p.id) ap.editing = false; });
    p.editing = !p.editing;
  }

  cancelEditPlayer(p: PlayerRow) { p.editing = false; }

  async saveEditPlayer(p: PlayerRow) {
    if (!p.editName.trim()) return;

    if (p.editIsCaptain && p.editTeamId) {
      const existingCap = this.allPlayers().find(
        x => x.isCaptain && x.teamId === p.editTeamId && x.id !== p.id && x.isActive
      );
      if (existingCap) {
        await this.db.savePlayer({ ...existingCap, isCaptain: false });
      }
    }

    await this.db.savePlayer({
      ...this.allPlayers().find(x => x.id === p.id)!,
      name: p.editName.trim(),
      teamId: p.editTeamId ?? undefined,
      cricherosUsername: p.editUsername.trim() || undefined,
      cricherosId: p.editCricherosId.trim() || undefined,
      isCaptain: p.editIsCaptain
    });

    p.editing = false;
    await this.reload();
  }

  // ── Deactivate / Reactivate Player ────────────────────────────
  async deactivatePlayer(p: PlayerRow) {
    const player = this.allPlayers().find(x => x.id === p.id)!;
    await this.db.savePlayer({ ...player, isActive: false, isCaptain: false });
    await this.reload();
  }

  async reactivatePlayer(p: PlayerRow) {
    const player = this.allPlayers().find(x => x.id === p.id)!;
    await this.db.savePlayer({ ...player, isActive: true });
    await this.reload();
  }

  // ── Teams ──────────────────────────────────────────────────────
  async addTeam() {
    this.addTeamError.set('');
    if (!this.newTeamName.trim()) { this.addTeamError.set('Team name is required.'); return; }
    await this.db.saveTeam({ name: this.newTeamName.trim(), isActive: true });
    this.newTeamName = '';
    this.showAddTeam.set(false);
    await this.reload();
  }

  async saveTeamName(t: TeamRow) {
    if (!t.editName.trim()) return;
    const team = this.allTeams().find(x => x.id === t.id)!;
    await this.db.saveTeam({ ...team, name: t.editName.trim() });
    t.editing = false;
    await this.reload();
  }

  async deactivateTeam(t: TeamRow) {
    const team = this.allTeams().find(x => x.id === t.id)!;
    await this.db.saveTeam({ ...team, isActive: false });
    await this.reload();
  }

  async reactivateTeam(t: TeamRow) {
    const team = this.allTeams().find(x => x.id === t.id)!;
    await this.db.saveTeam({ ...team, isActive: true });
    await this.reload();
  }

  async setCaptain(t: TeamRow, p: PlayerRow) {
    await this.removeCaptainFromTeam(t.id);
    const player = this.allPlayers().find(x => x.id === p.id)!;
    await this.db.savePlayer({ ...player, isCaptain: true, teamId: t.id });
    t.changingCaptain = false;
    await this.reload();
  }

  private async removeCaptainFromTeam(teamId: number) {
    const currentCap = this.allPlayers().find(p => p.isCaptain && p.teamId === teamId && p.isActive);
    if (currentCap) {
      await this.db.savePlayer({ ...currentCap, isCaptain: false });
    }
  }

  onOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains('overlay')) this.close.emit();
  }
}
