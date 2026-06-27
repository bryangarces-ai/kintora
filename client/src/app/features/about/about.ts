import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-about',
  imports: [RouterLink],
  template: `
    <section class="mx-auto max-w-2xl space-y-8 pb-12">
      <!-- Hero -->
      <div class="rounded-3xl border border-slate-200 bg-gradient-to-b from-indigo-50 to-white p-8 text-center">
        <img src="favicon.ico" alt="Kintora" class="mx-auto h-20 w-20 rounded-2xl shadow-sm" />
        <h2 class="mt-4 text-3xl font-bold sm:text-4xl">Kintora</h2>
        <p class="mt-2 text-lg text-slate-600">Your people, your moments — kept close.</p>
        <p class="mt-1 text-sm text-slate-400">Version {{ version }}</p>
      </div>

      <!-- What it is -->
      <div class="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 class="font-semibold">What Kintora is</h3>
        <p class="mt-2 text-slate-700">
          A calm, private place to remember the people in your life, the moments
          that matter, important facts, and the events of your story — so they're
          never lost, and so a future you (or someone helping you) can always find
          them.
        </p>
      </div>

      <!-- Privacy -->
      <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <h3 class="font-semibold text-emerald-900">🔒 Private by design</h3>
        <ul class="mt-2 list-disc space-y-1.5 pl-5 text-emerald-900">
          <li>Everything stays <strong>on your own computer</strong>.</li>
          <li>No internet connection is used — nothing is uploaded or shared.</li>
          <li>No account, no sign-up, no tracking.</li>
          <li>Even voice notes and read-aloud run locally on your device.</li>
        </ul>
      </div>

      <!-- Features -->
      <div class="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 class="mb-3 font-semibold">What's inside</h3>
        <div class="grid grid-cols-1 gap-2 text-slate-700 sm:grid-cols-2">
          @for (f of features; track f.label) {
            <a [routerLink]="f.path" class="flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-slate-50">
              <span class="text-xl">{{ f.icon }}</span>
              <span>{{ f.label }}</span>
            </a>
          }
        </div>
      </div>

      <!-- Your data -->
      <div class="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 class="font-semibold">Your data &amp; backups</h3>
        <p class="mt-2 text-slate-700">
          All your entries and photos live in a private <strong>Kintora vault</strong>
          folder on this computer. To keep them safe, use
          <a routerLink="/backup" class="font-medium text-indigo-600 hover:underline">Backup &amp; Restore</a>
          to save a copy to a USB drive or another computer now and then.
        </p>
      </div>

      <!-- Made with care -->
      <p class="text-center text-sm text-slate-400">
        Made with care, to hold on to what matters. 💜
      </p>
    </section>
  `,
})
export class About {
  protected readonly version = '1.0.0';

  protected readonly features = [
    { icon: '🌅', label: 'Recall — your daily briefing', path: '/recall' },
    { icon: '👥', label: 'People', path: '/people' },
    { icon: '📷', label: 'Memories (with voice notes)', path: '/memories' },
    { icon: '⭐', label: 'Important Info', path: '/facts' },
    { icon: '🗓️', label: 'Timeline', path: '/timeline' },
    { icon: '🕸️', label: 'Connections (3D graph)', path: '/connections' },
    { icon: '🪨', label: 'Obsidian Map', path: '/obsidian' },
    { icon: '💾', label: 'Backup & Restore', path: '/backup' },
  ];
}
