import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { Fact } from '../../core/models';

const CATEGORIES = ['medical', 'contact', 'preference', 'other'];
const ICONS: Record<string, string> = {
  medical: '🩺',
  contact: '📇',
  preference: '❤️',
  other: '📌',
};

@Component({
  selector: 'app-facts',
  imports: [FormsModule],
  template: `
    <section class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-2xl font-bold sm:text-3xl">Important Info</h2>
          <p class="text-sm text-slate-500">Medical details, contacts, preferences — quick to find.</p>
        </div>
        <button type="button" (click)="openCreate()"
          class="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
          + Add info
        </button>
      </div>

      @if (loading()) {
        <p class="text-slate-400">Loading…</p>
      } @else if (facts().length === 0) {
        <div class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div class="text-4xl">⭐</div>
          <p class="mt-2 text-slate-500">No info saved yet.</p>
        </div>
      } @else {
        @for (group of grouped(); track group.category) {
          <div>
            <h3 class="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              <span>{{ icon(group.category) }}</span> {{ group.category }}
            </h3>
            <div class="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
              @for (f of group.items; track f.id) {
                <div class="flex items-center justify-between gap-3 px-4 py-3">
                  <div class="min-w-0">
                    <p class="text-sm text-slate-500">{{ f.label }}</p>
                    <p class="font-medium break-words">{{ f.value }}</p>
                  </div>
                  <div class="flex flex-shrink-0 gap-1">
                    <button (click)="openEdit(f)" class="rounded-full p-1.5 text-sm hover:bg-slate-100" title="Edit">✏️</button>
                    <button (click)="remove(f)" class="rounded-full p-1.5 text-sm hover:bg-red-50" title="Delete">🗑️</button>
                  </div>
                </div>
              }
            </div>
          </div>
        }
      }
    </section>

    @if (showForm()) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" (click)="closeForm()">
        <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" (click)="$event.stopPropagation()">
          <h3 class="text-lg font-bold">{{ editing() ? 'Edit info' : 'Add info' }}</h3>
          <form class="mt-4 space-y-4" (ngSubmit)="save()">
            <div>
              <label class="block text-sm font-medium text-slate-700">Category</label>
              <select [(ngModel)]="form.category" name="category"
                class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                @for (c of categories; track c) { <option [value]="c">{{ c }}</option> }
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700">Label *</label>
              <input [(ngModel)]="form.label" name="label" required placeholder="e.g. Blood type, Home address"
                class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700">Value *</label>
              <textarea [(ngModel)]="form.value" name="value" rows="2" required
                class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"></textarea>
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
export class Facts {
  private api = inject(ApiService);

  protected facts = signal<Fact[]>([]);
  protected loading = signal(true);
  protected showForm = signal(false);
  protected editing = signal<Fact | null>(null);
  protected saving = signal(false);
  protected error = signal('');
  protected categories = CATEGORIES;

  protected form: { category: string; label: string; value: string } = {
    category: 'other',
    label: '',
    value: '',
  };

  protected grouped = computed(() => {
    const map = new Map<string, Fact[]>();
    for (const f of this.facts()) {
      const cat = f.category || 'other';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(f);
    }
    return [...map.entries()].map(([category, items]) => ({ category, items }));
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getFacts().subscribe({
      next: (f) => {
        this.facts.set(f);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  icon(c: string): string {
    return ICONS[c] ?? '📌';
  }

  openCreate(): void {
    this.editing.set(null);
    this.form = { category: 'other', label: '', value: '' };
    this.error.set('');
    this.showForm.set(true);
  }

  openEdit(f: Fact): void {
    this.editing.set(f);
    this.form = { category: f.category || 'other', label: f.label, value: f.value };
    this.error.set('');
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  save(): void {
    if (!this.form.label.trim() || !this.form.value.trim()) {
      this.error.set('Label and value are required.');
      return;
    }
    this.saving.set(true);
    const editing = this.editing();
    const req = editing
      ? this.api.updateFact(editing.id, this.form)
      : this.api.createFact(this.form);

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

  remove(f: Fact): void {
    if (!confirm(`Delete "${f.label}"?`)) return;
    this.api.deleteFact(f.id).subscribe(() => this.load());
  }
}
