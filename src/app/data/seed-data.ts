/**
 * Seed data — loaded automatically when IndexedDB is empty (new browser/device).
 * To add/edit players or teams, update this file and clear IndexedDB to re-seed.
 */

export interface SeedTeam {
  name: string;
  isActive: boolean;
}

export interface SeedPlayer {
  name: string;
  cricherosUsername: string;
  cricherosId: string;
  isCaptain: boolean;
  /** Name of the team this player captains (must match a SeedTeam name exactly) */
  teamName?: string;
  isActive: boolean;
}

// ─────────────────────────────────────────────
//  TEAMS
// ─────────────────────────────────────────────
export const SEED_TEAMS: SeedTeam[] = [
  { name: 'Viper',    isActive: true },
  { name: 'Lions',    isActive: true },
  { name: 'Anaconda', isActive: true },
  { name: 'Wasp',     isActive: true },
  { name: 'Panther',  isActive: true },
  { name: 'Bear',     isActive: true },
  { name: 'Dragon',   isActive: true },
  { name: 'Fox',      isActive: true },
];

// ─────────────────────────────────────────────
//  PLAYERS
// ─────────────────────────────────────────────
export const SEED_PLAYERS: SeedPlayer[] = [
  { name: 'Rohit Dubey',      cricherosUsername: 'rohit-dubey',           cricherosId: '91421',     isCaptain: true,  teamName: 'Panther',  isActive: true },
  { name: 'Adarsh',           cricherosUsername: 'adarsh',                cricherosId: '447287',    isCaptain: false,                       isActive: true },
  { name: 'Ashish Pandey',    cricherosUsername: 'ashish-10',             cricherosId: '447281',    isCaptain: true,  teamName: 'Dragon',   isActive: true },
  { name: 'Chintu',           cricherosUsername: 'chintu-rajput',         cricherosId: '9610439',   isCaptain: false,                       isActive: true },
  { name: 'Deepak Jangra',    cricherosUsername: 'deepak-jangra',         cricherosId: '20251523',  isCaptain: false,                       isActive: true },
  { name: 'Gulshan Pandey',   cricherosUsername: 'gulshan-kumar-pandey',  cricherosId: '104076',    isCaptain: true,  teamName: 'Fox',      isActive: true },
  { name: 'Hemanth Kausik',   cricherosUsername: 'hemant-kaushik',        cricherosId: '25143192',  isCaptain: false,                       isActive: true },
  { name: 'Lucky',            cricherosUsername: 'lucky',                 cricherosId: '16426707',  isCaptain: false,                       isActive: true },
  { name: 'Nitin',            cricherosUsername: 'nitin',                 cricherosId: '33366081',  isCaptain: false,                       isActive: true },
  { name: 'Naresh Chaudhary', cricherosUsername: 'naresh-chaudhary',      cricherosId: '12388879',  isCaptain: false,                       isActive: true },
  { name: 'Pradeep Sharma',   cricherosUsername: 'pradeep',               cricherosId: '8248317',   isCaptain: false,                       isActive: true },
  { name: 'Praveen Mishra',   cricherosUsername: 'praveen-mishra',        cricherosId: '447820',    isCaptain: false,                       isActive: true },
  { name: 'VB Praveen',       cricherosUsername: 'praveen-vb',            cricherosId: '1146477',   isCaptain: true,  teamName: 'Wasp',     isActive: true },
  { name: 'Pushpreet Singh',  cricherosUsername: 'pushpreet-singh',       cricherosId: '22481623',  isCaptain: false,                       isActive: true },
  { name: 'Santhosh Singh',   cricherosUsername: 'santhosh-singh',        cricherosId: '4643976',   isCaptain: false,                       isActive: true },
  { name: 'Sandeep Sharma',   cricherosUsername: 'sandeep-sharma',        cricherosId: '5859422',   isCaptain: false,                       isActive: true },
  { name: 'Sachin Saini',     cricherosUsername: 'sachin-saini',          cricherosId: '31196670',  isCaptain: true,  teamName: 'Lions',    isActive: true },
  { name: 'Satender Sharma',  cricherosUsername: 'satender-sharma',       cricherosId: '4053311',   isCaptain: true,  teamName: 'Viper',    isActive: true },
  { name: 'Shrish Shukla',    cricherosUsername: 'shrish-shukla',         cricherosId: '104284',    isCaptain: true,  teamName: 'Anaconda', isActive: true },
  { name: 'Sonu Kumar',       cricherosUsername: 'sonu-kumar',            cricherosId: '4053312',   isCaptain: false,                       isActive: true },
  { name: 'Vignesh',          cricherosUsername: 'vignesh',               cricherosId: '3719735',   isCaptain: false,                       isActive: true },
  { name: 'Vivek Tripathi',   cricherosUsername: 'vivek-tripathi',        cricherosId: '104071',    isCaptain: true,  teamName: 'Bear',     isActive: true },
  { name: 'Bunty Taranagar',  cricherosUsername: 'bunty-taranagar',       cricherosId: '10255320',  isCaptain: false,                       isActive: true },
  { name: 'Rishab Bisani',    cricherosUsername: 'rishabh-bisani',        cricherosId: '1216648',   isCaptain: false,                       isActive: true },
];
