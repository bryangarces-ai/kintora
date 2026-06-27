import { Component, inject, signal, viewChild, ElementRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';

@Component({
  selector: 'app-backup',
  imports: [FormsModule],
  template: `
    <section class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold sm:text-3xl">Backup &amp; Security</h2>
        <p class="mt-1 text-slate-500">
          Your vault is <strong>encrypted on this computer</strong>. Save an
          encrypted copy somewhere safe — and bring it all back if you ever need to.
        </p>
      </div>

      <!-- Vault security -->
      <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <h3 class="font-semibold text-emerald-900">🔒 Vault encryption</h3>
        <p class="mt-1 text-sm text-emerald-900">
          Everything in your vault — the database and all photos and voice notes —
          is encrypted on disk. It unlocks automatically on this computer.
        </p>

        <div class="mt-4 rounded-xl border border-emerald-200 bg-white p-4">
          @if (hasPassphrase()) {
            <p class="text-sm font-medium text-slate-800">
              ✅ A passphrase is set. You'll be asked for it if you ever open this
              vault on another computer.
            </p>
            <div class="mt-4 grid gap-3 sm:max-w-md">
              <input
                type="password"
                placeholder="Current passphrase"
                [ngModel]="curPass()"
                (ngModelChange)="curPass.set($event)"
                class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="password"
                placeholder="New passphrase (leave blank to only remove)"
                [ngModel]="newPass()"
                (ngModelChange)="newPass.set($event)"
                class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  (click)="savePassphrase()"
                  [disabled]="secBusy()"
                  class="rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Change passphrase
                </button>
                <button
                  type="button"
                  (click)="removePassphrase()"
                  [disabled]="secBusy()"
                  class="rounded-full border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Remove passphrase
                </button>
              </div>
            </div>
          } @else {
            <p class="text-sm text-slate-700">
              Add an optional <strong>passphrase</strong> for extra protection and so
              you can recover your vault on another computer. Keep it somewhere safe —
              it can't be reset for you.
            </p>
            <div class="mt-4 grid gap-3 sm:max-w-md">
              <input
                type="password"
                placeholder="Choose a passphrase (min 6 characters)"
                [ngModel]="newPass()"
                (ngModelChange)="newPass.set($event)"
                class="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                (click)="savePassphrase()"
                [disabled]="secBusy()"
                class="w-fit rounded-full bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Set passphrase
              </button>
            </div>
          }

          @if (secError()) {
            <p class="mt-3 text-sm text-red-600">{{ secError() }}</p>
          }
          @if (secDone()) {
            <p class="mt-3 text-sm text-emerald-700">{{ secDone() }}</p>
          }
        </div>
      </div>

      <!-- Backup card -->
      <div class="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 class="font-semibold">Back up now</h3>
        <p class="mt-1 text-sm text-slate-500">
          Creates one encrypted <code>.kvault</code> file with your database and all
          your photos. Choose a passphrase to protect it — you'll need it to restore.
        </p>
        <div class="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="password"
            placeholder="Backup passphrase (min 6 characters)"
            [ngModel]="backupPass()"
            (ngModelChange)="backupPass.set($event)"
            class="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-72"
          />
          <button
            type="button"
            (click)="downloadNow()"
            [disabled]="backingUp()"
            class="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {{ backingUp() ? 'Preparing…' : '💾 Download backup' }}
          </button>
        </div>
        @if (backupError()) {
          <p class="mt-3 text-sm text-red-600">{{ backupError() }}</p>
        }
      </div>

      <!-- Restore card -->
      <div class="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 class="font-semibold">Restore from a backup</h3>
        <p class="mt-1 text-sm text-slate-500">
          Choose a <code>.kvault</code> backup and enter its passphrase. This
          <strong>replaces</strong> everything currently in the app.
        </p>

        <input
          #fileInput
          type="file"
          accept=".kvault"
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
          <div class="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="password"
              placeholder="Backup passphrase"
              [ngModel]="restorePass()"
              (ngModelChange)="restorePass.set($event)"
              class="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-72"
            />
            <button
              type="button"
              (click)="restoreNow()"
              [disabled]="restoring()"
              class="rounded-full bg-red-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {{ restoring() ? 'Restoring…' : 'Restore and replace my data' }}
            </button>
          </div>
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
            The backup file stays <strong>on your computer</strong> and is encrypted
            with your passphrase. Nothing is sent to the internet.
          </li>
          <li>
            <strong>Don't lose the backup passphrase</strong> — without it, the backup
            can't be opened. It can't be reset for you.
          </li>
          <li>
            Restoring <strong>overwrites</strong> your current memories. Before it does,
            the app automatically saves a safety copy of what was there.
          </li>
        </ul>
      </div>
    </section>
  `,
})
export class Backup implements OnInit {
  private api = inject(ApiService);

  // Vault security (passphrase) state.
  protected hasPassphrase = signal(false);
  protected secBusy = signal(false);
  protected secError = signal('');
  protected secDone = signal('');
  protected newPass = signal('');
  protected curPass = signal('');

  // Backup.
  protected backupPass = signal('');
  protected backingUp = signal(false);
  protected backupError = signal('');

  // Restore.
  protected chosenFile = signal<File | null>(null);
  protected restorePass = signal('');
  protected restoring = signal(false);
  protected error = signal('');
  protected done = signal<string>('');

  protected fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  ngOnInit(): void {
    this.api.getSecurityStatus().subscribe({
      next: (s) => this.hasPassphrase.set(s.hasPassphrase),
      error: () => {},
    });
  }

  savePassphrase(): void {
    const np = this.newPass();
    if (this.hasPassphrase() && !np) {
      // "Change" with an empty new passphrase is treated as remove.
      this.removePassphrase();
      return;
    }
    if (!np || np.length < 6) {
      this.secError.set('Choose a passphrase of at least 6 characters.');
      return;
    }
    this.secBusy.set(true);
    this.secError.set('');
    this.secDone.set('');
    this.api.setPassphrase(np, this.curPass() || undefined).subscribe({
      next: (s) => {
        this.secBusy.set(false);
        this.hasPassphrase.set(s.hasPassphrase);
        this.secDone.set('Passphrase saved.');
        this.newPass.set('');
        this.curPass.set('');
      },
      error: (e) => {
        this.secBusy.set(false);
        this.secError.set(e?.error?.error ?? 'Could not save the passphrase.');
      },
    });
  }

  removePassphrase(): void {
    const cur = this.curPass();
    if (!cur) {
      this.secError.set('Enter your current passphrase to remove it.');
      return;
    }
    this.secBusy.set(true);
    this.secError.set('');
    this.secDone.set('');
    this.api.removePassphrase(cur).subscribe({
      next: () => {
        this.secBusy.set(false);
        this.hasPassphrase.set(false);
        this.secDone.set('Passphrase removed.');
        this.curPass.set('');
        this.newPass.set('');
      },
      error: (e) => {
        this.secBusy.set(false);
        this.secError.set(e?.error?.error ?? 'Could not remove the passphrase.');
      },
    });
  }

  downloadNow(): void {
    const pass = this.backupPass();
    if (!pass || pass.length < 6) {
      this.backupError.set('Enter a passphrase of at least 6 characters to protect the backup.');
      return;
    }
    this.backingUp.set(true);
    this.backupError.set('');
    this.api.downloadBackup(pass).subscribe({
      next: (blob) => {
        this.backingUp.set(false);
        const date = new Date().toISOString().slice(0, 10);
        this.saveBlob(blob, `kintora-backup-${date}.kvault`);
      },
      error: () => {
        this.backingUp.set(false);
        this.backupError.set('Could not create the backup.');
      },
    });
  }

  onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.chosenFile.set(input.files?.[0] ?? null);
    this.error.set('');
    this.done.set('');
  }

  restoreNow(): void {
    const file = this.chosenFile();
    if (!file) return;
    const pass = this.restorePass();
    if (!pass) {
      this.error.set('Enter the passphrase for this backup.');
      return;
    }
    const ok = window.confirm(
      'This will replace ALL current data in Kintora with the contents of ' +
        'this backup. A safety copy of your current data will be saved first.\n\n' +
        'Continue?'
    );
    if (!ok) return;

    this.restoring.set(true);
    this.error.set('');
    this.api.restoreBackup(file, pass).subscribe({
      next: (r) => {
        this.done.set(r.safetyBackup);
        setTimeout(() => window.location.reload(), 1500);
      },
      error: (err) => {
        this.restoring.set(false);
        this.error.set(err?.error?.error ?? 'Restore failed. Your data was not changed.');
      },
    });
  }

  private saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}
