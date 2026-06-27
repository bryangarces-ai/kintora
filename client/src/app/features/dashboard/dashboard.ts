import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { Memory, Person } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink],
  template: `
    <section class="space-y-8">
      <div>
        <h2 class="text-2xl font-bold sm:text-3xl">Welcome back 👋</h2>
        <p class="mt-1 text-slate-500">
          Everything you want to remember, in one calm place.
        </p>
      </div>

      <!-- Stat cards -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        @for (s of stats(); track s.path) {
          <a
            [routerLink]="s.path"
            class="rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div class="text-2xl">{{ s.icon }}</div>
            <div class="mt-2 text-3xl font-bold">{{ s.count }}</div>
            <div class="text-sm text-slate-500">{{ s.label }}</div>
          </a>
        }
      </div>

      <!-- Recent memories -->
      <div>
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-lg font-semibold">Recent memories</h3>
          <a routerLink="/memories" class="text-sm font-medium text-indigo-600 hover:underline">
            View all →
          </a>
        </div>

        @if (loading()) {
          <p class="text-slate-400">Loading…</p>
        } @else if (recent().length === 0) {
          <div class="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <p class="text-slate-500">No memories yet.</p>
            <a
              routerLink="/memories"
              class="mt-3 inline-block rounded-full bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Add your first memory
            </a>
          </div>
        } @else {
          <div class="grid gap-4 sm:grid-cols-2">
            @for (m of recent(); track m.id) {
              <a
                routerLink="/memories"
                class="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:shadow-md"
              >
                @if (cover(m); as src) {
                  <img [src]="src" [alt]="m.title" class="h-40 w-full object-cover" />
                } @else {
                  <div class="flex h-40 w-full items-center justify-center bg-slate-100 text-4xl">
                    📷
                  </div>
                }
                <div class="p-4">
                  <h4 class="font-semibold">{{ m.title }}</h4>
                  @if (m.memory_date) {
                    <p class="text-sm text-slate-500">{{ m.memory_date }}</p>
                  }
                </div>
              </a>
            }
          </div>
        }
      </div>

      <!-- Birthdays -->
      @if (birthdays().length > 0) {
        <div>
          <h3 class="mb-3 text-lg font-semibold">🎂 Birthdays</h3>
          <div class="space-y-2">
            @for (p of birthdays(); track p.id) {
              <a
                [routerLink]="['/people', p.id]"
                class="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50"
              >
                <span class="font-medium">{{ p.name }}</span>
                <span class="text-sm text-slate-500">{{ p.birthday }}</span>
              </a>
            }
          </div>
        </div>
      }
    </section>
  `,
})
export class Dashboard {
  private api = inject(ApiService);

  protected loading = signal(true);
  protected recent = signal<Memory[]>([]);
  protected birthdays = signal<Person[]>([]);
  protected stats = signal<
    { label: string; count: number; icon: string; path: string }[]
  >([
    { label: 'People', count: 0, icon: '👥', path: '/people' },
    { label: 'Memories', count: 0, icon: '📷', path: '/memories' },
    { label: 'Info', count: 0, icon: '⭐', path: '/facts' },
    { label: 'Events', count: 0, icon: '🗓️', path: '/timeline' },
  ]);

  constructor() {
    forkJoin({
      people: this.api.getPeople(),
      memories: this.api.getMemories(),
      facts: this.api.getFacts(),
      timeline: this.api.getTimeline(),
    }).subscribe({
      next: ({ people, memories, facts, timeline }) => {
        this.stats.set([
          { label: 'People', count: people.length, icon: '👥', path: '/people' },
          { label: 'Memories', count: memories.length, icon: '📷', path: '/memories' },
          { label: 'Info', count: facts.length, icon: '⭐', path: '/facts' },
          { label: 'Events', count: timeline.length, icon: '🗓️', path: '/timeline' },
        ]);
        this.recent.set(memories.slice(0, 4));
        this.birthdays.set(people.filter((p) => !!p.birthday).slice(0, 5));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  cover(m: Memory): string | null {
    const img = m.media?.find((x) => x.media_type === 'image');
    return img ? this.api.mediaUrl(img.file_path) : null;
  }
}
