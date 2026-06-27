r"""
Kintora — Screenshot Blur Tool
==============================

Drag boxes over any personal data (names, faces, addresses, etc.) and this
pixelates + blurs those areas so a screenshot is safe to post publicly.

Your ORIGINAL files are never modified. A new copy is saved next to each one
named  <name>-blurred.png

How to use
----------
1. Snip each Kintora screen with  Win + Shift + S  and save the PNGs into the
   folder:  tools\shots\   (or anywhere — see below).
2. Run:   python tools\blur-screenshots.py
   (or drag a folder / image onto it:  python tools\blur-screenshots.py "C:\path")
3. For each image:
     - LEFT-CLICK and DRAG to draw a box over something to hide.
     - Draw as many boxes as you want.
     - Press  U  to undo the last box.
     - Press  C  to clear all boxes.
     - Press  S  (or ENTER) to SAVE the blurred copy and go to the next image.
     - Press  N  to skip this image (no save).
     - Press  ESC  to quit.

No internet, no uploads — runs 100% on your computer.
"""

import os
import sys
import glob
import tkinter as tk
from tkinter import filedialog
from PIL import Image, ImageFilter, ImageTk

VALID_EXT = (".png", ".jpg", ".jpeg", ".bmp", ".webp")
MAX_VIEW_W = 1280   # on-screen preview cap (the SAVED image stays full-res)
MAX_VIEW_H = 800


def collect_images(arg):
    """Return a list of image paths from a file, a folder, or a picker."""
    if arg and os.path.isfile(arg):
        return [arg]
    if arg and os.path.isdir(arg):
        folder = arg
    else:
        # default folder, else ask
        default = os.path.join(os.path.dirname(os.path.abspath(__file__)), "shots")
        if os.path.isdir(default) and any(
            f.lower().endswith(VALID_EXT) for f in os.listdir(default)
        ):
            folder = default
        else:
            root = tk.Tk(); root.withdraw()
            folder = filedialog.askdirectory(title="Pick the folder with your screenshots")
            root.destroy()
            if not folder:
                return []
    files = []
    for ext in VALID_EXT:
        files.extend(glob.glob(os.path.join(folder, "*" + ext)))
        files.extend(glob.glob(os.path.join(folder, "*" + ext.upper())))
    # don't re-process our own output
    files = sorted(set(f for f in files if "-blurred" not in os.path.basename(f).lower()))
    return files


def censor_region(img, box):
    """Pixelate then heavily blur a region so text/faces are unrecoverable."""
    x0, y0, x1, y1 = box
    x0, x1 = sorted((max(0, x0), min(img.width, x1)))
    y0, y1 = sorted((max(0, y0), min(img.height, y1)))
    if x1 - x0 < 2 or y1 - y0 < 2:
        return
    region = img.crop((x0, y0, x1, y1))
    w, h = region.size
    # 1) pixelate: shrink hard then scale back up (destroys text)
    small = region.resize((max(1, w // 18), max(1, h // 18)), Image.BILINEAR)
    region = small.resize((w, h), Image.NEAREST)
    # 2) soften the blocks so it looks like a clean privacy blur
    region = region.filter(ImageFilter.GaussianBlur(radius=6))
    img.paste(region, (x0, y0))


class BlurApp:
    def __init__(self, files):
        self.files = files
        self.idx = 0
        self.boxes = []          # boxes in ORIGINAL image coordinates
        self.start = None
        self.rect_id = None

        self.win = tk.Tk()
        self.win.title("Kintora — Blur Screenshots")
        self.win.configure(bg="#0f172a")

        self.info = tk.Label(self.win, bg="#0f172a", fg="#e2e8f0",
                             font=("Segoe UI", 11), pady=6)
        self.info.pack(fill="x")

        self.canvas = tk.Canvas(self.win, bg="#1e293b", highlightthickness=0,
                                cursor="crosshair")
        self.canvas.pack()

        self.canvas.bind("<Button-1>", self.on_down)
        self.canvas.bind("<B1-Motion>", self.on_move)
        self.canvas.bind("<ButtonRelease-1>", self.on_up)
        self.win.bind("<Key>", self.on_key)

        self.load_current()
        self.win.mainloop()

    # ---- image handling ----
    def load_current(self):
        self.boxes = []
        path = self.files[self.idx]
        self.orig = Image.open(path).convert("RGB")
        # compute preview scale
        self.scale = min(MAX_VIEW_W / self.orig.width,
                         MAX_VIEW_H / self.orig.height, 1.0)
        self.vw = int(self.orig.width * self.scale)
        self.vh = int(self.orig.height * self.scale)
        self.refresh()

    def refresh(self):
        """Render preview with current boxes applied (so user sees the result)."""
        preview = self.orig.copy()
        for b in self.boxes:
            censor_region(preview, b)
        disp = preview.resize((self.vw, self.vh), Image.LANCZOS)
        self.tkimg = ImageTk.PhotoImage(disp)
        self.canvas.config(width=self.vw, height=self.vh)
        self.canvas.delete("all")
        self.canvas.create_image(0, 0, anchor="nw", image=self.tkimg)
        name = os.path.basename(self.files[self.idx])
        self.info.config(
            text=f"[{self.idx+1}/{len(self.files)}]  {name}   "
                 f"|  drag=blur   U=undo   C=clear   S/Enter=save   N=skip   Esc=quit   "
                 f"({len(self.boxes)} blurred)"
        )

    # ---- mouse: draw boxes in VIEW coords, store in ORIGINAL coords ----
    def on_down(self, e):
        self.start = (e.x, e.y)
        self.rect_id = self.canvas.create_rectangle(
            e.x, e.y, e.x, e.y, outline="#38bdf8", width=2)

    def on_move(self, e):
        if self.rect_id:
            self.canvas.coords(self.rect_id, self.start[0], self.start[1], e.x, e.y)

    def on_up(self, e):
        if not self.start:
            return
        x0, y0 = self.start
        x1, y1 = e.x, e.y
        self.start = None
        self.rect_id = None
        # to original coords
        s = self.scale
        box = (int(x0 / s), int(y0 / s), int(x1 / s), int(y1 / s))
        if abs(box[2] - box[0]) > 3 and abs(box[3] - box[1]) > 3:
            self.boxes.append(box)
        self.refresh()

    # ---- keys ----
    def on_key(self, e):
        k = e.keysym.lower()
        if k == "escape":
            self.win.destroy()
        elif k == "u":
            if self.boxes:
                self.boxes.pop()
                self.refresh()
        elif k == "c":
            self.boxes = []
            self.refresh()
        elif k in ("s", "return"):
            self.save_current()
            self.next_image()
        elif k == "n":
            self.next_image()

    def save_current(self):
        out = self.orig.copy()
        for b in self.boxes:
            censor_region(out, b)
        src = self.files[self.idx]
        root_, ext = os.path.splitext(src)
        dest = root_ + "-blurred.png"
        out.save(dest)
        print(f"Saved: {dest}  ({len(self.boxes)} regions blurred)")

    def next_image(self):
        self.idx += 1
        if self.idx >= len(self.files):
            print("\nAll done! Blurred copies are saved next to the originals.")
            self.win.destroy()
        else:
            self.load_current()


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else None
    files = collect_images(arg)
    if not files:
        print("No screenshots found.")
        print(r"Put your .png snips in  tools\shots\  and run this again,")
        print(r"or:  python tools\blur-screenshots.py \"C:\path\to\folder\"")
        return
    print(f"Found {len(files)} image(s). Opening editor...")
    BlurApp(files)


if __name__ == "__main__":
    main()
