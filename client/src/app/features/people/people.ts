import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { Person } from '../../core/models';

@Component({
  selector: 'app-people',
  imports: [RouterLink, FormsModule],
  template: `
    <section class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold sm:text-3xl">People</h2>
        <button
          type="button"
          (click)="openCreate()"
          class="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          + Add person
        </button>
      </div>

      @if (loading()) {
        <p class="text-slate-400">Loading…</p>
      } @else if (people().length === 0) {
        <div class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div class="text-4xl">👥</div>
          <p class="mt-2 text-slate-500">No people yet. Add the important people in your life.</p>
        </div>
      } @else {
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          @for (p of people(); track p.id) {
            <div class="group relative rounded-2xl border border-slate-200 bg-white p-4 text-center transition hover:shadow-md">
              <a [routerLink]="['/people', p.id]" class="block">
                @if (api.mediaUrl(p.photo_path); as src) {
                  <img [src]="src" [alt]="p.name" class="mx-auto h-24 w-24 rounded-full object-cover" />
                } @else {
                  <div class="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-indigo-100 text-3xl font-bold text-indigo-600">
                    {{ initials(p.name) }}
                  </div>
                }
                <h3 class="mt-3 font-semibold">{{ p.name }}</h3>
                @if (p.relationship) {
                  <p class="text-sm text-slate-500">{{ p.relationship }}</p>
                }
              </a>
              <div class="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
                <button (click)="openEdit(p)" class="rounded-full bg-white/90 p-1.5 text-sm shadow hover:bg-slate-100" title="Edit">✏️</button>
                <button (click)="remove(p)" class="rounded-full bg-white/90 p-1.5 text-sm shadow hover:bg-red-50" title="Delete">🗑️</button>
              </div>
            </div>
          }
        </div>
      }
    </section>

    <!-- Add / edit modal -->
    @if (showForm()) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" (click)="closeForm()">
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" (click)="$event.stopPropagation()">
          <h3 class="text-lg font-bold">{{ editing() ? 'Edit person' : 'Add person' }}</h3>
          <form class="mt-4 space-y-4" (ngSubmit)="save()">
            <div>
              <label class="block text-sm font-medium text-slate-700">Name *</label>
              <input [(ngModel)]="form.name" name="name" required
                class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700">Relationship</label>
              <input [(ngModel)]="form.relationship" name="relationship" placeholder="e.g. wife, son, friend"
                class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700">Birthday</label>
              <input type="date" [(ngModel)]="form.birthday" name="birthday"
                class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700">Notes</label>
              <textarea [(ngModel)]="form.notes" name="notes" rows="3"
                class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"></textarea>
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
export class People {
  protected api = inject(ApiService);

  protected people = signal<Person[]>([]);
  protected loading = signal(true);
  protected showForm = signal(false);
  protected editing = signal<Person | null>(null);
  protected saving = signal(false);
  protected error = signal('');

  protected form: { name: string; relationship: string; birthday: string; notes: string } = {
    name: '',
    relationship: '',
    birthday: '',
    notes: '',
  };
  private file: File | null = null;

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getPeople().subscribe({
      next: (p) => {
        this.people.set(p);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  initials(name: string): string {
    return name
      .split(/\s+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  openCreate(): void {
    this.editing.set(null);
    this.form = { name: '', relationship: '', birthday: '', notes: '' };
    this.file = null;
    this.error.set('');
    this.showForm.set(true);
  }

  openEdit(p: Person): void {
    this.editing.set(p);
    this.form = {
      name: p.name,
      relationship: p.relationship ?? '',
      birthday: p.birthday ?? '',
      notes: p.notes ?? '',
    };
    this.file = null;
    this.error.set('');
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  onFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.file = input.files?.[0] ?? null;
  }

  save(): void {
    if (!this.form.name.trim()) {
      this.error.set('Name is required.');
      return;
    }
    const fd = new FormData();
    fd.append('name', this.form.name.trim());
    fd.append('relationship', this.form.relationship);
    fd.append('birthday', this.form.birthday);
    fd.append('notes', this.form.notes);
    if (this.file) fd.append('photo', this.file);

    this.saving.set(true);
    const editing = this.editing();
    const req = editing
      ? this.api.updatePerson(editing.id, fd)
      : this.api.createPerson(fd);

    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.error ?? 'Could not save.');
      },
    });
  }

  remove(p: Person): void {
    if (!confirm(`Delete ${p.name}? This cannot be undone.`)) return;
    this.api.deletePerson(p.id).subscribe(() => this.load());
  }
}
