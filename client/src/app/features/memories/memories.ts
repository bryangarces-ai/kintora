import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { SpeechService } from '../../core/speech.service';
import { Fact, Link, Memory, Person, TimelineEvent } from '../../core/models';

@Component({
  selector: 'app-memories',
  imports: [FormsModule],
  template: `
    <section class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold sm:text-3xl">Memories</h2>
        <button type="button" (click)="openCreate()"
          class="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
          + Add memory
        </button>
      </div>

      @if (loading()) {
        <p class="text-slate-400">Loading…</p>
      } @else if (memories().length === 0) {
        <div class="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div class="text-4xl">📷</div>
          <p class="mt-2 text-slate-500">No memories yet. Capture a moment worth keeping.</p>
        </div>
      } @else {
        <div class="grid gap-5 sm:grid-cols-2">
          @for (m of memories(); track m.id) {
            <article class="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              @if (images(m).length > 0) {
                <div class="flex gap-1 overflow-x-auto bg-slate-100">
                  @for (src of images(m); track src) {
                    <img [src]="src" class="h-48 w-full flex-shrink-0 object-cover" [class.w-full]="images(m).length === 1" />
                  }
                </div>
              }
              <div class="p-4">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <h3 class="font-semibold">{{ m.title }}</h3>
                    @if (m.memory_date) { <p class="text-sm text-slate-500">{{ m.memory_date }}</p> }
                  </div>
                  <div class="flex gap-1">
                    @if (speech.supported) {
                      <button (click)="readMemory(m)" class="rounded-full p-1.5 text-sm hover:bg-slate-100" title="Read aloud">🔊</button>
                    }
                    <button (click)="openEdit(m)" class="rounded-full p-1.5 text-sm hover:bg-slate-100" title="Edit">✏️</button>
                    <button (click)="remove(m)" class="rounded-full p-1.5 text-sm hover:bg-red-50" title="Delete">🗑️</button>
                  </div>
                </div>
                @if (m.description) { <p class="mt-2 whitespace-pre-line text-slate-700">{{ m.description }}</p> }

                @for (a of audio(m); track a) {
                  <audio controls [src]="a" class="mt-3 w-full"></audio>
                }

                @if (m.people && m.people.length > 0) {
                  <div class="mt-3 flex flex-wrap gap-1.5">
                    @for (p of m.people; track p.id) {
                      <span class="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{{ p.name }}</span>
                    }
                  </div>
                }
              </div>
            </article>
          }
        </div>
      }
    </section>

    @if (showForm()) {
      <div class="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" (click)="closeForm()">
        <div class="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" (click)="$event.stopPropagation()">
          <h3 class="text-lg font-bold">{{ editing() ? 'Edit memory' : 'Add memory' }}</h3>
          <form class="mt-4 space-y-4" (ngSubmit)="save()">
            <div>
              <label class="block text-sm font-medium text-slate-700">Title *</label>
              <input [(ngModel)]="form.title" name="title" required
                class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700">Date</label>
              <input type="date" [(ngModel)]="form.memory_date" name="memory_date"
                class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-700">Description</label>
              <textarea [(ngModel)]="form.description" name="description" rows="3"
                class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"></textarea>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700">Who's in this memory?</label>
              <div class="mt-1 flex flex-wrap gap-2">
                @for (p of people(); track p.id) {
                  <button type="button" (click)="togglePerson(p.id)"
                    class="rounded-full border px-3 py-1.5 text-sm transition"
                    [class.bg-indigo-600]="selected().has(p.id)"
                    [class.text-white]="selected().has(p.id)"
                    [class.border-indigo-600]="selected().has(p.id)"
                    [class.border-slate-300]="!selected().has(p.id)"
                    [class.text-slate-700]="!selected().has(p.id)">
                    {{ p.name }}
                  </button>
                } @empty {
                  <p class="text-sm text-slate-400">Add people first to tag them.</p>
                }
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700">Related events</label>
              <div class="mt-1 flex flex-wrap gap-2">
                @for (e of allEvents(); track e.id) {
                  <button type="button" (click)="toggleEvent(e.id)"
                    class="rounded-full border px-3 py-1.5 text-sm transition"
                    [class.bg-violet-600]="selectedEvents().has(e.id)"
                    [class.text-white]="selectedEvents().has(e.id)"
                    [class.border-violet-600]="selectedEvents().has(e.id)"
                    [class.border-slate-300]="!selectedEvents().has(e.id)"
                    [class.text-slate-700]="!selectedEvents().has(e.id)">
                    {{ e.title }}
                  </button>
                } @empty {
                  <p class="text-sm text-slate-400">No events yet.</p>
                }
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700">Related info</label>
              <div class="mt-1 flex flex-wrap gap-2">
                @for (f of allFacts(); track f.id) {
                  <button type="button" (click)="toggleFact(f.id)"
                    class="rounded-full border px-3 py-1.5 text-sm transition"
                    [class.bg-emerald-600]="selectedFacts().has(f.id)"
                    [class.text-white]="selectedFacts().has(f.id)"
                    [class.border-emerald-600]="selectedFacts().has(f.id)"
                    [class.border-slate-300]="!selectedFacts().has(f.id)"
                    [class.text-slate-700]="!selectedFacts().has(f.id)">
                    {{ f.label }}
                  </button>
                } @empty {
                  <p class="text-sm text-slate-400">No info entries yet.</p>
                }
              </div>
            </div>

            <div>
              <label class="block text-sm font-medium text-slate-700">Photos / audio</label>
              <input type="file" accept="image/*,audio/*" multiple (change)="onFiles($event)" class="mt-1 w-full text-sm" />
            </div>

            @if (canRecord) {
              <div>
                <label class="block text-sm font-medium text-slate-700">Voice note</label>
                <div class="mt-1 flex items-center gap-3">
                  <button type="button" (click)="toggleRecording()"
                    class="rounded-full px-4 py-2 text-sm font-medium text-white"
                    [class.bg-red-600]="recording()"
                    [class.bg-slate-700]="!recording()">
                    {{ recording() ? '⏹ Stop recording' : '🎙 Record voice note' }}
                  </button>
                  @if (recording()) {
                    <span class="flex items-center gap-1.5 text-sm text-red-600">
                      <span class="h-2.5 w-2.5 animate-pulse rounded-full bg-red-600"></span> Recording…
                    </span>
                  }
                </div>
                @if (recordedUrl(); as url) {
                  <audio controls [src]="url" class="mt-2 w-full"></audio>
                  <p class="mt-1 text-xs text-slate-400">Saved with this memory when you press Save.</p>
                }
              </div>
            }

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
export class Memories {
  protected api = inject(ApiService);
  protected speech = inject(SpeechService);

  // Voice-note recording (offline; MediaRecorder → attached as an audio file).
  protected recording = signal(false);
  protected recordedUrl = signal<string | null>(null);
  protected readonly canRecord =
    typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];

  protected memories = signal<Memory[]>([]);
  protected people = signal<Person[]>([]);
  protected allEvents = signal<TimelineEvent[]>([]);
  protected allFacts = signal<Fact[]>([]);
  protected loading = signal(true);
  protected showForm = signal(false);
  protected editing = signal<Memory | null>(null);
  protected saving = signal(false);
  protected error = signal('');
  protected selected = signal<Set<number>>(new Set());
  protected selectedEvents = signal<Set<number>>(new Set());
  protected selectedFacts = signal<Set<number>>(new Set());

  // Links the memory being edited already has, so save() can diff and delete.
  private existingLinks: Link[] = [];

  protected form: { title: string; memory_date: string; description: string } = {
    title: '',
    memory_date: '',
    description: '',
  };
  private files: File[] = [];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    forkJoin({
      memories: this.api.getMemories(),
      people: this.api.getPeople(),
      events: this.api.getTimeline(),
      facts: this.api.getFacts(),
    }).subscribe({
      next: ({ memories, people, events, facts }) => {
        this.memories.set(memories);
        this.people.set(people);
        this.allEvents.set(events);
        this.allFacts.set(facts);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  images(m: Memory): string[] {
    return (m.media ?? [])
      .filter((x) => x.media_type === 'image')
      .map((x) => this.api.mediaUrl(x.file_path)!)
      .filter(Boolean);
  }
  audio(m: Memory): string[] {
    return (m.media ?? [])
      .filter((x) => x.media_type === 'audio')
      .map((x) => this.api.mediaUrl(x.file_path)!)
      .filter(Boolean);
  }

  togglePerson(id: number): void {
    const next = new Set(this.selected());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selected.set(next);
  }

  toggleEvent(id: number): void {
    const next = new Set(this.selectedEvents());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selectedEvents.set(next);
  }

  toggleFact(id: number): void {
    const next = new Set(this.selectedFacts());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selectedFacts.set(next);
  }

  openCreate(): void {
    this.editing.set(null);
    this.form = { title: '', memory_date: '', description: '' };
    this.selected.set(new Set());
    this.selectedEvents.set(new Set());
    this.selectedFacts.set(new Set());
    this.existingLinks = [];
    this.files = [];
    this.clearRecording();
    this.error.set('');
    this.showForm.set(true);
  }

  openEdit(m: Memory): void {
    this.editing.set(m);
    this.form = {
      title: m.title,
      memory_date: m.memory_date ?? '',
      description: m.description ?? '',
    };
    this.selected.set(new Set((m.people ?? []).map((p) => p.id)));
    this.selectedEvents.set(new Set());
    this.selectedFacts.set(new Set());
    this.existingLinks = [];
    this.files = [];
    this.clearRecording();
    this.error.set('');
    this.showForm.set(true);

    // Pull the memory's current event/fact links to prefill the pickers and to
    // diff against on save.
    this.api.getLinks('memory', m.id).subscribe((links) => {
      this.existingLinks = links;
      this.selectedEvents.set(
        new Set(links.filter((l) => l.other_type === 'event').map((l) => l.other_id))
      );
      this.selectedFacts.set(
        new Set(links.filter((l) => l.other_type === 'fact').map((l) => l.other_id))
      );
    });
  }

  closeForm(): void {
    this.clearRecording();
    this.showForm.set(false);
  }

  onFiles(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.files = input.files ? Array.from(input.files) : [];
  }

  // ---- voice notes -----------------------------------------------------
  async toggleRecording(): Promise<void> {
    if (this.recording()) {
      this.mediaRecorder?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.chunks = [];
      const rec = new MediaRecorder(stream);
      this.mediaRecorder = rec;
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) this.chunks.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(this.chunks, { type: rec.mimeType || 'audio/webm' });
        const ext = (rec.mimeType || 'audio/webm').includes('ogg') ? 'ogg' : 'webm';
        const file = new File([blob], `voice-note-${Date.now()}.${ext}`, {
          type: blob.type,
        });
        // Replace any previous recording for this form, keep picked files.
        this.files = [...this.files.filter((f) => !f.name.startsWith('voice-note-')), file];
        this.recordedUrl.set(URL.createObjectURL(blob));
        this.recording.set(false);
      };
      rec.start();
      this.recording.set(true);
      this.error.set('');
    } catch (_) {
      this.error.set('Could not access the microphone. Check the app’s mic permission.');
    }
  }

  private clearRecording(): void {
    if (this.recording()) this.mediaRecorder?.stop();
    const url = this.recordedUrl();
    if (url) URL.revokeObjectURL(url);
    this.recordedUrl.set(null);
  }

  // ---- read aloud ------------------------------------------------------
  readMemory(m: Memory): void {
    const parts = [m.title];
    if (m.memory_date) parts.push(`Dated ${m.memory_date}.`);
    if (m.description) parts.push(m.description);
    this.speech.toggle(parts.join('. '));
  }

  save(): void {
    if (!this.form.title.trim()) {
      this.error.set('Title is required.');
      return;
    }
    const fd = new FormData();
    fd.append('title', this.form.title.trim());
    fd.append('memory_date', this.form.memory_date);
    fd.append('description', this.form.description);
    fd.append('personIds', JSON.stringify([...this.selected()]));
    for (const f of this.files) fd.append('photos', f);

    this.saving.set(true);
    const editing = this.editing();
    const req = editing
      ? this.api.updateMemory(editing.id, fd)
      : this.api.createMemory(fd);

    req.subscribe({
      next: (saved) => {
        // Reconcile event/fact links once the memory has an id.
        const desired = [
          ...[...this.selectedEvents()].map((id) => ({ type: 'event' as const, id })),
          ...[...this.selectedFacts()].map((id) => ({ type: 'fact' as const, id })),
        ];
        this.api.syncLinks('memory', saved.id, desired, this.existingLinks).subscribe({
          next: () => {
            this.saving.set(false);
            this.showForm.set(false);
            this.load();
          },
          error: () => {
            // Memory saved; only the links failed. Surface it but keep the memory.
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

  remove(m: Memory): void {
    if (!confirm(`Delete "${m.title}"? This cannot be undone.`)) return;
    this.api.deleteMemory(m.id).subscribe(() => this.load());
  }
}
