import { Injectable, signal } from '@angular/core';

// Read-aloud (text-to-speech) using the browser's built-in speechSynthesis.
// This runs entirely on the device with the OS's installed voices — nothing is
// sent to the internet, in keeping with the app's offline-only promise.
@Injectable({ providedIn: 'root' })
export class SpeechService {
  readonly supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  // True while something is being read aloud (drives button labels).
  readonly speaking = signal(false);

  speak(text: string): void {
    if (!this.supported || !text.trim()) return;
    // Stop anything currently playing first.
    window.speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95; // a touch slower — easier to follow
    u.onend = () => this.speaking.set(false);
    u.onerror = () => this.speaking.set(false);
    this.speaking.set(true);
    window.speechSynthesis.speak(u);
  }

  stop(): void {
    if (!this.supported) return;
    window.speechSynthesis.cancel();
    this.speaking.set(false);
  }

  /** Convenience: stop if currently reading, otherwise read the given text. */
  toggle(text: string): void {
    if (this.speaking()) this.stop();
    else this.speak(text);
  }
}
