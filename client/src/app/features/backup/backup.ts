import { Component, inject, signal, viewChild, ElementRef } from '@angular/core';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-backup',
  template: `
    <section class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold sm:text-3xl">Backup &amp; Restore</h2>
        <p class="mt-1 text-slate-500">
          Save your whole vault to a single file you can keep somewhere safe — and
          bring it all back if you ever need to.
        </p>
      </div>

      <!-- Backup card -->
      <div class="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 class="font-semibold">Back up now</h3>
        <p class="mt-1 text-sm text-slate-500">
          Creates one <code>.zip</code> file containing your database and all your
          photos. Save it to a USB drive or another computer for safekeeping.
        </p>
        <a
          [href]="downloadUrl"
          download
          class="mt-4 inline-block rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          💾 Download backup
        </a>
      </div>

      <!-- Restore card -->
      <div class="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 class="font-semibold">Restore from a backup</h3>
        <p class="mt-1 text-sm text-slate-500">
          Choose a backup <code>.zip</code> to bring back. This <strong>replaces</strong>
          everything currently in the app with the contents of that file.
        </p>

        <input
          #fileInput
          type="file"
          accept=".zip"
          class="hidden"
          (change)="onFileChosen($event)"
        />

        <div class="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            (click)="fileInput.click()"
            [disabled]="restoring()"
            class="rounded-full border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Choose backup file…
          </button>
          @if (chosenFile(); as f) {
            <span class="text-sm text-slate-600">{{ f.name }}</span>
          }
        </div>

        @if (chosenFile()) {
          <button
            type="button"
            (click)="restoreNow()"
            [disabled]="restoring()"
            class="mt-4 rounded-full bg-red-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {{ restoring() ? 'Restoring…' : 'Restore and replace my data' }}
          </button>
        }

        @if (error()) {
          <p class="mt-3 text-sm text-red-600">{{ error() }}</p>
        }
        @if (done()) {
          <div class="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
            <p class="font-medium">✓ Restore complete — reloading…</p>
            <p class="mt-1">
              A safety copy of your previous data was saved as
              <code>{{ done() }}</code> inside your vault folder, just in case.
            </p>
          </div>
        }
      </div>

      <!-- Notes -->
      <div class="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <h3 class="mb-2 font-semibold">Good to know</h3>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>
            The backup file stays <strong>on your computer</strong> (it downloads to
            wherever you choose). Nothing is sent to the internet.
          </li>
          <li>
            Restoring <strong>overwrites</strong> your current memories. Before it does,
            the app automatically saves a safety copy of what was there.
          </li>
          <li>Keep a recent backup on a separate drive — that's your real safety net.</li>
        </ul>
      </div>
    </section>
  `,
})
export class Backup {
  private api = inject(ApiService);

  protected readonly downloadUrl = this.api.backupDownloadUrl();
  protected chosenFile = signal<File | null>(null);
  protected restoring = signal(false);
  protected error = signal('');
  protected done = signal<string>('');

  protected fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.chosenFile.set(input.files?.[0] ?? null);
    this.error.set('');
    this.done.set('');
  }

  restoreNow(): void {
    const file = this.chosenFile();
    if (!file) return;
    const ok = window.confirm(
      'This will replace ALL current data in Kintora with the contents of ' +
        'this backup. A safety copy of your current data will be saved first.\n\n' +
        'Continue?'
    );
    if (!ok) return;

    this.restoring.set(true);
    this.error.set('');
    this.api.restoreBackup(file).subscribe({
      next: (r) => {
        this.done.set(r.safetyBackup);
        // Reload so every page re-fetches the restored data.
        setTimeout(() => window.location.reload(), 1500);
      },
      error: (err) => {
        this.restoring.set(false);
        this.error.set(err?.error?.error ?? 'Restore failed. Your data was not changed.');
      },
    });
  }
}
