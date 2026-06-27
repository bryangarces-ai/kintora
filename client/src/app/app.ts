import { Component, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly query = signal('');
  protected readonly mobileNavOpen = signal(false);

  protected readonly nav = [
    { path: '/', label: 'Home', icon: '🏠', exact: true },
    { path: '/recall', label: 'Recall', icon: '🌅', exact: false },
    { path: '/people', label: 'People', icon: '👥', exact: false },
    { path: '/memories', label: 'Memories', icon: '📷', exact: false },
    { path: '/facts', label: 'Important Info', icon: '⭐', exact: false },
    { path: '/timeline', label: 'Timeline', icon: '🗓️', exact: false },
    { path: '/connections', label: 'Connections', icon: '🕸️', exact: false },
    { path: '/obsidian', label: 'Obsidian Map', icon: '🪨', exact: false },
    { path: '/backup', label: 'Backup', icon: '💾', exact: false },
    { path: '/about', label: 'About', icon: 'ℹ️', exact: false },
  ];

  constructor(private router: Router) {}

  submitSearch(): void {
    const q = this.query().trim();
    if (!q) return;
    this.router.navigate(['/search'], { queryParams: { q } });
    this.mobileNavOpen.set(false);
  }
}
