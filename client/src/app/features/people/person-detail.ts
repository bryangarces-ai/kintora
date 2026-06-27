import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import {
  EntityType,
  Fact,
  Link,
  Memory,
  Person,
  TimelineEvent,
} from '../../core/models';

const TYPE_META: Record<EntityType, { icon: string; label: string }> = {
  person: { icon: '👥', label: 'Person' },
  memory: { icon: '📷', label: 'Memory' },
  fact: { icon: '⭐', label: 'Info' },
  event: { icon: '🗓️', label: 'Event' },
};

@Component({
  selector: 'app-person-detail',
  imports: [RouterLink, FormsModule],
  template: `
    <section class="space-y-6">
      <a routerLink="/people" class="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
        ← Back to people
      </a>

      @if (loading()) {
        <p class="text-slate-400">Loading…</p>
      } @else if (person(); as p) {
        <div class="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 text-center sm:flex-row sm:text-left">
          @if (api.mediaUrl(p.photo_path); as src) {
            <img [src]="src" [alt]="p.name" class="h-28 w-28 rounded-full object-cover" />
          } @else {
            <div class="flex h-28 w-28 items-center justify-center rounded-full bg-indigo-100 text-3xl font-bold text-indigo-600">
              {{ initials(p.name) }}
            </div>
          }
          <div>
            <h2 class="text-2xl font-bold">{{ p.name }}</h2>
            @if (p.relationship) { <p class="text-slate-600">{{ p.relationship }}</p> }
            @if (p.birthday) { <p class="text-sm text-slate-500">🎂 {{ p.birthday }}</p> }
          </div>
        </div>

        @if (p.notes) {
          <div class="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 class="mb-2 font-semibold">Notes</h3>
            <p class="whitespace-pre-line text-slate-700">{{ p.notes }}</p>
          </div>
        }

        <!-- Connections -->
        <div class="rounded-2xl border border-slate-200 bg-white p-5">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="font-semibold">🕸️ Connections</h3>
            <button type="button" (click)="toggleAdd()"
              class="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
              {{ showAdd() ? 'Cancel' : '+ Add connection' }}
            </button>
          </div>

          @if (showAdd()) {
            <div class="mb-4 flex flex-wrap items-end gap-2 rounded-xl bg-slate-50 p-3">
              <div>
                <label class="block text-xs font-medium text-slate-500">Type</label>
                <select [(ngModel)]="addType" (ngModelChange)="addId.set(null)"
                  class="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="memory">Memory</option>
                  <option value="fact">Info</option>
                  <option value="event">Event</option>
                  <option value="person">Person</option>
                </select>
              </div>
              <div class="flex-1">
                <label class="block text-xs font-medium text-slate-500">Item</label>
                <select [ngModel]="addId()" (ngModelChange)="addId.set($event)"
                  class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option [ngValue]="null" disabled>Choose…</option>
                  @for (o of options(); track o.id) {
                    <option [ngValue]="o.id">{{ o.label }}</option>
                  }
                </select>
              </div>
              <button type="button" (click)="addConnection()" [disabled]="addId() === null"
                class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                Add
              </button>
            </div>
          }

          @if (links().length === 0) {
            <p class="text-sm text-slate-500">No connections yet. Tag this person to memories, events, or info.</p>
          } @else {
            <div class="flex flex-wrap gap-2">
              @for (l of links(); track l.id) {
                <span class="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-3 pr-1 text-sm">
                  <button type="button" (click)="go(l.other_type, l.other_id)" class="hover:underline">
                    {{ meta(l.other_type).icon }} {{ l.other_label }}
                  </button>
                  <button type="button" (click)="removeLink(l)" title="Remove"
                    class="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-red-100 hover:text-red-600">
                    ×
                  </button>
                </span>
              }
            </div>
          }
        </div>

        <div>
          <h3 class="mb-3 font-semibold">Memories with {{ p.name }}</h3>
          @if (!p.memories || p.memories.length === 0) {
            <p class="text-slate-500">No memories tagged with {{ p.name }} yet.</p>
          } @else {
            <div class="grid gap-4 sm:grid-cols-2">
              @for (m of p.memories; track m.id) {
                <a routerLink="/memories" class="rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-md">
                  <h4 class="font-semibold">{{ m.title }}</h4>
                  @if (m.memory_date) { <p class="text-sm text-slate-500">{{ m.memory_date }}</p> }
                  @if (m.description) { <p class="mt-1 line-clamp-2 text-sm text-slate-600">{{ m.description }}</p> }
                </a>
              }
            </div>
          }
        </div>
      } @else {
        <p class="text-slate-500">Person not found.</p>
      }
    </section>
  `,
})
export class PersonDetail {
  protected api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  private personId = Number(this.route.snapshot.paramMap.get('id'));

  protected person = signal<Person | null>(null);
  protected loading = signal(true);
  protected links = signal<Link[]>([]);

  // "Add connection" panel state + the source lists to pick from.
  protected showAdd = signal(false);
  protected addType = signal<EntityType>('memory');
  protected addId = signal<number | null>(null);
  private people = signal<Person[]>([]);
  private memories = signal<Memory[]>([]);
  private facts = signal<Fact[]>([]);
  private events = signal<TimelineEvent[]>([]);

  constructor() {
    forkJoin({
      person: this.api.getPerson(this.personId),
      links: this.api.getLinks('person', this.personId),
      people: this.api.getPeople(),
      memories: this.api.getMemories(),
      facts: this.api.getFacts(),
      events: this.api.getTimeline(),
    }).subscribe({
      next: ({ person, links, people, memories, facts, events }) => {
        this.person.set(person);
        this.links.set(links);
        this.people.set(people);
        this.memories.set(memories);
        this.facts.set(facts);
        this.events.set(events);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  initials(name: string): string {
    return name.split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  }

  meta(t: EntityType) {
    return TYPE_META[t];
  }

  // Options for the "Item" dropdown: entries of the chosen type, excluding this
  // person and anything already linked.
  options(): { id: number; label: string }[] {
    const type = this.addType();
    const linkedIds = new Set(
      this.links().filter((l) => l.other_type === type).map((l) => l.other_id)
    );
    let list: { id: number; label: string }[] = [];
    if (type === 'memory') list = this.memories().map((m) => ({ id: m.id, label: m.title }));
    else if (type === 'fact') list = this.facts().map((f) => ({ id: f.id, label: f.label }));
    else if (type === 'event') list = this.events().map((e) => ({ id: e.id, label: e.title }));
    else if (type === 'person')
      list = this.people()
        .filter((p) => p.id !== this.personId)
        .map((p) => ({ id: p.id, label: p.name }));
    return list.filter((o) => !linkedIds.has(o.id));
  }

  toggleAdd(): void {
    this.showAdd.set(!this.showAdd());
    this.addId.set(null);
  }

  addConnection(): void {
    const id = this.addId();
    if (id === null) return;
    this.api
      .createLink({
        source_type: 'person',
        source_id: this.personId,
        target_type: this.addType(),
        target_id: id,
      })
      .subscribe(() => {
        this.addId.set(null);
        this.refreshLinks();
      });
  }

  removeLink(l: Link): void {
    this.api.deleteLink(l.id).subscribe(() => this.refreshLinks());
  }

  private refreshLinks(): void {
    this.api.getLinks('person', this.personId).subscribe((links) => this.links.set(links));
  }

  go(type: EntityType, id: number): void {
    switch (type) {
      case 'person':
        this.router.navigate(['/people', id]);
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
