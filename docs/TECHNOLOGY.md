# Memory Vault — The Technology, Explained Simply

This document explains what the app is built with, in plain language. No
programming background needed. If a term sounds technical, there's a everyday
analogy right next to it.

---

## The big picture (a restaurant analogy)

Think of the app like a small **restaurant**:

- The **kitchen** prepares and stores all the food. You never see it directly.
- The **dining room** is what you actually see and interact with — the menu,
  the table, the waiter taking your order.
- A **waiter** carries requests from your table to the kitchen and brings food
  back.

In our app:

- The **kitchen** is called the **backend** (it stores and manages your data).
- The **dining room** is called the **frontend** (the screens you see and click).
- The **waiter** is the **internet connection between them** (here, just your own
  computer talking to itself).

```
   YOU
    │  click, type, drag
    ▼
┌──────────────────────────┐        ┌──────────────────────────┐
│   FRONTEND (dining room)  │  ───▶  │   BACKEND (kitchen)       │
│   what you see & touch    │  ◀───  │   stores your memories    │
└──────────────────────────┘  asks  └──────────────────────────┘
                              & gets             │
                              answers            ▼
                                        ┌──────────────────┐
                                        │  Your data files  │
                                        │ (the actual vault)│
                                        └──────────────────┘
```

**Important:** both the kitchen and the dining room run **on your own computer**.
Nothing is sent to the internet. Your memories never leave your machine.

---

## The backend (the kitchen)

This is the part that quietly stores everything and hands it back when asked.

| Technology | What it is, in plain words | Why we use it |
|---|---|---|
| **Node.js** | A program that lets the computer run instructions written in the JavaScript language — outside of a web browser. Think of it as the **stove and ovens** the kitchen runs on. | It's free, reliable, and runs on Windows, Mac, and Linux. |
| **Express** | A helper that organizes how the kitchen takes orders ("give me all people", "save this new memory"). Think of it as the **order-ticket system** that keeps requests tidy. | It's the standard, well-tested way to build this kind of order system. |
| **SQLite** (via a piece called *better-sqlite3*) | The **filing cabinet** where all your text data lives — people, memories, facts, events, and how they connect. It's a single file on your computer. | No setup, no separate database server, and the whole thing is just one file you can copy to back it up. |
| **Multer** | The **photo & audio handler**. When you attach a picture or voice clip, this is the part that receives the file and files it away safely. | It's the standard tool for handling uploaded files. |

**Where your data actually lives:** a folder called `server/data/`. Inside it:
- `memory-vault.db` — the filing cabinet (all your typed information).
- `uploads/` — your photos and audio clips.

That single folder **is** your vault. Copy it to a USB drive and you've backed up
everything. Put it back and everything returns.

---

## The frontend (the dining room)

This is everything you see and interact with — the menus, buttons, forms, and the
3D galaxy view.

| Technology | What it is, in plain words | Why we use it |
|---|---|---|
| **Angular** | The framework that builds all the screens, buttons, and forms and keeps them in sync with your data. Think of it as the **dining room's furniture, layout, and staff** all working together. | It's a mature, well-supported system made by Google for building exactly this kind of app. |
| **TypeScript** | The **language** the app is written in. It's like regular app-writing language but with a built-in spell-checker that catches mistakes before they ever reach you. | Fewer bugs, safer changes over time. |
| **Tailwind CSS** | The **interior decorator** — it controls colors, spacing, rounded corners, and the overall clean look. | Lets us style everything consistently and quickly. |
| **3D Force-Graph + Three.js** | The **planetarium projector**. This is what draws the "Connections" page as a glowing 3D galaxy you can spin, zoom, and click. *Three.js* does the 3D drawing; *3D Force-Graph* arranges your entries like stars and links. | Gives that immersive, space-like map of how your memories connect. |

---

## How the two halves talk (the waiter)

When you, say, open the **People** page:

1. The **dining room (frontend)** says: *"Waiter, bring me the list of people."*
2. The request travels to the **kitchen (backend)** as a small web message.
3. The kitchen opens the **filing cabinet (SQLite)**, grabs the people, and sends
   them back.
4. The dining room receives them and arranges them neatly on your screen.

This back-and-forth is called an **API** (just a fancy word for "the menu of
things the kitchen knows how to do"). Examples on the menu: *list people*,
*save a memory*, *delete an event*, *search everything*, *get the connections map*.

All of this happens in a fraction of a second, entirely inside your computer.

---

## Why it's built this way (the principles)

- **Private & offline.** No cloud, no accounts, no internet required. Your
  memories stay on your machine — by design.
- **Easy to back up.** Everything important is in one folder you can copy.
- **Built to last & grow.** The kitchen and dining room are kept separate, so we
  can improve one without breaking the other (for example, adding a future
  "recall mode" or AI helper) .
- **Standard, well-supported tools.** Everything used here is widely adopted and
  free, so the app can keep working and improving for years.

---

## A quick glossary

- **Backend** — the behind-the-scenes part that stores and manages data (the kitchen).
- **Frontend** — the part you see and click (the dining room).
- **Database** — an organized filing cabinet for information (here, SQLite).
- **API** — the list of requests the backend understands (the menu).
- **Server** — a program that waits for requests and responds (here, runs on your own PC).
- **Framework / library** — a ready-made toolkit so we don't rebuild everything from scratch.

---

## How it runs on your computer

Two small programs start up locally:

- The **kitchen** listens quietly at an address only your computer can reach
  (`localhost:3000`).
- The **dining room** opens in your web browser at `localhost:4200`.

You just open the browser page and use the app like any website — except it's
100% yours, running entirely on your own machine.
