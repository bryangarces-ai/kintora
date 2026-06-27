import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { Link, Person, TimelineEvent } from '../../core/models';

@Component({
  selector: 'app-timeline',
  imports: [FormsModule],
  template: `
    <section class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold sm:text-3xl">Timeline</h2>
        <button type="button" (click)="openCreate()"
          class="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
          + Add event
        </button>
      </div>

      @if (loading()) {
        <p class="text-slate-400">Loading…</p>
      } @else if (events().length === 0) {
        <div class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div class="text-4xl">🗓️</div>
          <p class="mt-2 text-slate-500">No events yet. Build a timeline of life's milestones.</p>
        </div>
      } @else {
        <ol class="relative ml-3 border-l-2 border-indigo-100">
          @for (e of events(); track e.id) {
            <li class="mb-8 ml-6">
              <span class="absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 ring-4 ring-white"></span>
              <div class="rounded-2xl border border-slate-200 bg-white p-4">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <time class="text-sm font-medium text-indigo-600">{{ e.event_date }}</time>
                    <h3 class="font-semibold">{{ e.title }}</h3>
                  </div>
                  <div class="flex gap-1">
                    <button (click)="openEdit(e)" class="rounded-full p-1.5 text-sm hover:bg-slate-100" title="Edit">✏️</button>
                    <button (click)="remove(e)" class="rounded-full p-1.5 text-sm hover:bg-red-50" title="Delete">🗑️</button>
                  </div>
                </div>
                @if (api.mediaUrl(e.photo_path); as src) {
                  <img [src]="src" [alt]="e.title" class="mt-3 max-h-64 w-full rounded-lg object-cover" />
                }
                @if (e.description) { <p class="mt-2 whitespace-pre-line text-slate-700">{{ e.description }}</p> }
              </div>
            </li>
          }
        </ol>
      }
    </section>

    @if (showForm()) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" (click)="closeForm()">
        <div class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" (click)="$event.stopPropagation()">
          <h3 class="text-lg font-bold">{{ editing() ? 'Edit event' : 'Add event' }}</h3>
          <form class="mt-4 space-y-4" (ngSubmit)="save()">
            <div>
              <label class="block text-sm font-medium text-slate-700">Date *</label>
              <input type="date" [(ngModel)]="form.event_date" name="event_date" required
                class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700">Title *</label>
              <input [(ngModel)]="form.title" name="title" required
                class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700">Description</label>
              <textarea [(ngModel)]="form.description" name="description" rows="3"
                class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"></textarea>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700">People involved</label>
              <div class="mt-1 flex flex-wrap gap-2">
                @for (p of allPeople(); track p.id) {
                  <button type="button" (click)="togglePerson(p.id)"
                    class="rounded-full border px-3 py-1.5 text-sm transition"
                    [class.bg-indigo-600]="selectedPeople().has(p.id)"
                    [class.text-white]="selectedPeople().has(p.id)"
                    [class.border-indigo-600]="selectedPeople().has(p.id)"
                    [class.border-slate-300]="!selectedPeople().has(p.id)"
                    [class.text-slate-700]="!selectedPeople().has(p.id)">
                    {{ p.name }}
                  </button>
                } @empty {
                  <p class="text-sm text-slate-400">No people yet.</p>
                }
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700">Photo</label>
              <input type="file" accept="image/*" (change)="onFile($event)" class="mt-1 w-full text-sm" />
            </div>

            @if (error()) { <p class="text-sm text-red-600">{{ error() }}</p> }

            <div class="flex justify-end gap-2 pt-2">
              <button type="button" (click)="closeForm()" class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
              <button type="submit" [disabled]="saving()" class="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                {{ saving() ? 'Saving…' : 'Save' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class Timeline {
  protected api = inject(ApiService);

  protected events = signal<TimelineEvent[]>([]);
  protected allPeople = signal<Person[]>([]);
  protected loading = signal(true);
  protected showForm = signal(false);
  protected editing = signal<TimelineEvent | null>(null);
  protected saving = signal(false);
  protected error = signal('');
  protected selectedPeople = signal<Set<number>>(new Set());

  // Links the event being edited already has, so save() can diff and delete.
  private existingLinks: Link[] = [];

  protected form: { event_date: string; title: string; description: string } = {
    event_date: '',
    title: '',
    description: '',
  };
  private file: File | null = null;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    forkJoin({ events: this.api.getTimeline(), people: this.api.getPeople() }).subscribe({
      next: ({ events, people }) => {
        this.events.set(events);
        this.allPeople.set(people);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  togglePerson(id: number): void {
    const next = new Set(this.selectedPeople());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selectedPeople.set(next);
  }

  openCreate(): void {
    this.editing.set(null);
    this.form = { event_date: '', title: '', description: '' };
    this.selectedPeople.set(new Set());
    this.existingLinks = [];
    this.file = null;
    this.error.set('');
    this.showForm.set(true);
  }

  openEdit(e: TimelineEvent): void {
    this.editing.set(e);
    this.form = {
      event_date: e.event_date,
      title: e.title,
      description: e.description ?? '',
    };
    this.selectedPeople.set(new Set());
    this.existingLinks = [];
    this.file = null;
    this.error.set('');
    this.showForm.set(true);

    // Prefill the people picker from the event's current person links.
    this.api.getLinks('event', e.id).subscribe((links) => {
      this.existingLinks = links;
      this.selectedPeople.set(
        new Set(links.filter((l) => l.other_type === 'person').map((l) => l.other_id))
      );
    });
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  onFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.file = input.files?.[0] ?? null;
  }

  save(): void {
    if (!this.form.event_date || !this.form.title.trim()) {
      this.error.set('Date and title are required.');
      return;
    }
    const fd = new FormData();
    fd.append('event_date', this.form.event_date);
    fd.append('title', this.form.title.trim());
    fd.append('description', this.form.description);
    if (this.file) fd.append('photo', this.file);

    this.saving.set(true);
    const editing = this.editing();
    const req = editing
      ? this.api.updateEvent(editing.id, fd)
      : this.api.createEvent(fd);

    req.subscribe({
      next: (saved) => {
        const desired = [...this.selectedPeople()].map((id) => ({
          type: 'person' as const,
          id,
        }));
        this.api.syncLinks('event', saved.id, desired, this.existingLinks).subscribe({
          next: () => {
            this.saving.set(false);
            this.showForm.set(false);
            this.load();
          },
          error: () => {
            this.saving.set(false);
            this.showForm.set(false);
            this.load();
          },
        });
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error ?? 'Could not save.');
      },
    });
  }

  remove(e: TimelineEvent): void {
    if (!confirm(`Delete "${e.title}"?`)) return;
    this.api.deleteEvent(e.id).subscribe(() => this.load());
  }
}
