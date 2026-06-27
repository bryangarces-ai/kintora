import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/dashboard/dashboard').then((m) => m.Dashboard),
    title: 'Kintora',
  },
  {
    path: 'recall',
    loadComponent: () =>
      import('./features/recall/recall').then((m) => m.Recall),
    title: 'Recall',
  },
  {
    path: 'people',
    loadComponent: () =>
      import('./features/people/people').then((m) => m.People),
    title: 'People',
  },
  {
    path: 'people/:id',
    loadComponent: () =>
      import('./features/people/person-detail').then((m) => m.PersonDetail),
    title: 'Person',
  },
  {
    path: 'memories',
    loadComponent: () =>
      import('./features/memories/memories').then((m) => m.Memories),
    title: 'Memories',
  },
  {
    path: 'facts',
    loadComponent: () =>
      import('./features/facts/facts').then((m) => m.Facts),
    title: 'Important Info',
  },
  {
    path: 'timeline',
    loadComponent: () =>
      import('./features/timeline/timeline').then((m) => m.Timeline),
    title: 'Timeline',
  },
  {
    path: 'connections',
    loadComponent: () =>
      import('./features/connections/connections').then((m) => m.Connections),
    title: 'Connections',
  },
  {
    path: 'obsidian',
    loadComponent: () =>
      import('./features/obsidian/obsidian').then((m) => m.Obsidian),
    title: 'Obsidian Map',
  },
  {
    path: 'backup',
    loadComponent: () =>
      import('./features/backup/backup').then((m) => m.Backup),
    title: 'Backup & Restore',
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./features/about/about').then((m) => m.About),
    title: 'About Kintora',
  },
  {
    path: 'search',
    loadComponent: () =>
      import('./features/search/search').then((m) => m.Search),
    title: 'Search',
  },
  { path: '**', redirectTo: '' },
];
