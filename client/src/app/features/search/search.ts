import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { switchMap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { SearchResult, SearchResultType } from '../../core/models';

const META: Record<SearchResultType, { icon: string; label: string }> = {
  person: { icon: '👥', label: 'Person' },
  memory: { icon: '📷', label: 'Memory' },
  fact: { icon: '⭐', label: 'Info' },
  event: { icon: '🗓️', label: 'Event' },
};

@Component({
  selector: 'app-search',
  template: `
    <section class="space-y-6">
      <h2 class="text-2xl font-bold sm:text-3xl">
        Search results
        @if (query()) { <span class="text-slate-400">for "{{ query() }}"</span> }
      </h2>

      @if (loading()) {
        <p class="text-slate-400">Searching…</p>
      } @else if (results().length === 0) {
        <div class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div class="text-4xl">🔍</div>
          <p class="mt-2 text-slate-500">No matches found.</p>
        </div>
      } @else {
        <div class="space-y-2">
          @for (r of results(); track r.type + '-' + r.id) {
            <button type="button" (click)="go(r)"
              class="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50">
              <span class="text-2xl">{{ meta(r.type).icon }}</span>
              <div class="min-w-0 flex-1">
                <p class="font-medium">{{ r.title }}</p>
                @if (r.subtitle) { <p class="truncate text-sm text-slate-500">{{ r.subtitle }}</p> }
              </div>
              <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">{{ meta(r.type).label }}</span>
            </button>
          }
        </div>
      }
    </section>
  `,
})
export class Search {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected results = signal<SearchResult[]>([]);
  protected loading = signal(true);
  protected query = signal('');

  constructor() {
    this.route.queryParamMap
      .pipe(
        switchMap((params) => {
          const q = params.get('q') ?? '';
          this.query.set(q);
          this.loading.set(true);
          return this.api.search(q);
        })
      )
      .subscribe({
        next: (r) => {
          this.results.set(r);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  meta(t: SearchResultType) {
    return META[t];
  }

  go(r: SearchResult): void {
    switch (r.type) {
      case 'person':
        this.router.navigate(['/people', r.id]);
        break;
      case 'memory':
        this.router.navigate(['/memories']);
        break;
      case 'fact':
        this.router.navigate(['/facts']);
        break;
      case 'event':
        this.router.navigate(['/timeline']);
        break;
    }
  }
}
