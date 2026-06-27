import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../core/api.service';
import { ObsidianExportResult, ObsidianStatus } from '../../core/models';

@Component({
  selector: 'app-obsidian',
  imports: [DatePipe],
  template: `
    <section class="space-y-6">
      <div>
        <h2 class="text-2xl font-bold sm:text-3xl">Obsidian Map</h2>
        <p class="mt-1 text-slate-500">
          Export your vault as an Obsidian-ready folder — notes, links, and photos —
          so you can explore it in Obsidian's graph and (later) with an AI helper.
        </p>
      </div>

      <!-- Export card -->
      <div class="rounded-2xl border border-slate-200 bg-white p-6">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 class="font-semibold">Generate the Obsidian vault</h3>
            @if (status()?.exists && status()?.lastExport) {
              <p class="text-sm text-slate-500">
                Last exported {{ status()!.lastExport | date: 'medium' }}
              </p>
            } @else {
              <p class="text-sm text-slate-500">Not exported yet.</p>
            }
          </div>
          <button type="button" (click)="exportNow()" [disabled]="exporting()"
            class="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
            {{ exporting() ? 'Exporting…' : '🪨 Export to Obsidian' }}
          </button>
        </div>

        @if (error()) {
          <p class="mt-3 text-sm text-red-600">{{ error() }}</p>
        }

        @if (result(); as r) {
          <div class="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
            <p class="font-medium">✓ Exported successfully</p>
            <p class="mt-1">
              {{ r.counts.people }} people · {{ r.counts.memories }} memories ·
              {{ r.counts.facts }} info · {{ r.counts.events }} events
            </p>
          </div>
        }

        @if (status()?.exists || result()) {
          <div class="mt-4">
            <p class="text-sm font-medium text-slate-700">Vault folder:</p>
            <code class="mt-1 block break-all rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
              {{ vaultPath() }}
            </code>
          </div>
        }
      </div>

      <!-- How to open in Obsidian -->
      <div class="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 class="mb-3 font-semibold">How to open it in Obsidian</h3>
        <ol class="list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>
            Install Obsidian (free) from
            <a href="https://obsidian.md" target="_blank" rel="noopener"
              class="font-medium text-indigo-600 hover:underline">obsidian.md</a>.
          </li>
          <li>Open Obsidian → <strong>Open folder as vault</strong>.</li>
          <li>Choose the <strong>Vault folder</strong> path shown above.</li>
          <li>
            Click the <strong>graph view</strong> icon (the connected-circles icon
            in the left sidebar) to see your memories as a web.
          </li>
        </ol>
      </div>

      <!-- Notes / caveats -->
      <div class="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <h3 class="mb-2 font-semibold">Good to know</h3>
        <ul class="list-disc space-y-1.5 pl-5">
          <li>
            This is a <strong>one-way snapshot</strong>. Re-exporting overwrites the
            folder, so make changes here in Kintora and export again — don't
            hand-edit the Obsidian notes.
          </li>
          <li>
            Everything stays <strong>on your computer</strong>. Exporting does not
            send anything to the internet.
          </li>
          <li>
            <strong>Future AI:</strong> once it's in Obsidian, you could connect an
            LLM (e.g. Claude) to ask questions about your memories. Note that
            cloud AI would send those notes off your device — a local model keeps it
            fully private.
          </li>
        </ul>
      </div>
    </section>
  `,
})
export class Obsidian {
  private api = inject(ApiService);

  protected status = signal<ObsidianStatus | null>(null);
  protected result = signal<ObsidianExportResult | null>(null);
  protected exporting = signal(false);
  protected error = signal('');

  // Prefer the freshest path we know (from a just-finished export, else status).
  protected vaultPath = () => this.result()?.path ?? this.status()?.path ?? '';

  constructor() {
    this.api.getObsidianStatus().subscribe({
      next: (s) => this.status.set(s),
      error: () => {},
    });
  }

  exportNow(): void {
    this.exporting.set(true);
    this.error.set('');
    this.result.set(null);
    this.api.exportObsidian().subscribe({
      next: (r) => {
        this.result.set(r);
        this.exporting.set(false);
        // Refresh status so the "last exported" line updates.
        this.api.getObsidianStatus().subscribe((s) => this.status.set(s));
      },
      error: (err) => {
        this.exporting.set(false);
        this.error.set(err?.error?.error ?? 'Export failed.');
      },
    });
  }
}
