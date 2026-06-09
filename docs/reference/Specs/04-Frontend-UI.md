# InTheFlow: Frontend & Electron UI Specification

This document details the user interface layout, typography, navigation, window styling, and glassmorphic aesthetics designed for the React dashboard running inside Electron.

---

## 1. Visual Design & Theme System (Aesthetics)

InTheFlow utilizes a premium, state-of-the-art **glassmorphic dark-mode interface** with harmonized HSL colors, smooth gradients, and subtle hover animations to keep the user focused and relaxed ("in the flow").

### CSS Design Tokens (`index.css`)
```css
:root {
  /* Colors */
  --bg-primary: HSL(224, 25%, 10%);       /* Very deep slate blue */
  --bg-secondary: HSL(224, 20%, 15%);     /* Deep card backing */
  --glass-bg: HSLA(224, 25%, 16%, 0.65);   /* Semi-transparent slate */
  --glass-border: HSLA(0, 0%, 100%, 0.08); /* Faint white border for glass edge */
  
  --accent-purple: HSL(262, 83%, 65%);     /* Vibrant indigo/purple */
  --accent-cyan: HSL(190, 95%, 48%);       /* Flow cyan */
  --accent-green: HSL(142, 70%, 45%);      /* Success green */
  --accent-yellow: HSL(48, 95%, 48%);      /* Warning/Pending orange-yellow */
  --accent-red: HSL(350, 89%, 60%);        /* Blocker red */

  --text-primary: HSL(0, 0%, 95%);
  --text-secondary: HSL(220, 15%, 70%);

  /* Font */
  --font-sans: 'Inter', system-ui, sans-serif;
  
  /* Animations */
  --transition-smooth: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

body {
  margin: 0;
  font-family: var(--font-sans);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
}
```

### Aesthetic Standards
* **Glassmorphism**: Every panel, card, and modal uses `backdrop-filter: blur(12px)` and a 1px border using `--glass-border`.
* **Micro-Animations**: All interactive buttons, cards, and sidebar links scale slightly (`transform: scale(1.015)`) and glow with a subtle drop-shadow when hovered.
* **Typography**: The interface utilizes Google Fonts' `Inter` or `Outfit` weights for headers and task lists.

---

## 2. Layout Structure & Core Views

The application layout is structured as a vertical sidebar navigation on the left, and a main dashboard content panel on the right.

```
┌────────────────────────────────────────────────────────┐
│ [Titlebar]                       [-] [o] [x]           │
├─────────┬──────────────────────────────────────────────┤
│ InThe-  │ Dashboard                                    │
│  Flow   │                                              │
│ ─────── │  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│ (o) Dsh │  │ Completed│  │Time spent│  │Friction  │    │
│ [ ] Brd │  │    28    │  │ 12.5 hrs │  │ Low (12) │    │
│ [ ] Bkl │  └──────────┘  └──────────┘  └──────────┘    │
│ [ ] Hub │                                              │
│ [ ] Set │  ┌────────────────────────────────────────┐  │
│         │  │ AI Flow Suggestion                     │  │
│         │  │ "Focus on: AI Chat page implementation"│  │
│         │  └────────────────────────────────────────┘  │
└─────────┴──────────────────────────────────────────────┘
```

### A. Sidebar Navigation
* **Brand Logo**: Styled with a flowing cyan gradient text: `InTheFlow`.
* **Global Actions**:
  * **Refresh Data**: A manual trigger button with a spinning animation to safely re-fetch database state from the backend without automatic polling side-effects during form entry.
* **Menu Links**:
  * **Dashboard**: Key productivity metrics and task recommendations.
  * **Kanban Board**: Visual drag-and-drop board for active sprint tracking.
  * **Backlog**: Hierarchical task list with advanced sorting, search, and bulk operations.
  * **Custom Views**: Dynamic list of user-created database views. Includes a **Create View +** action button that triggers the custom view builder.
  * **AI Flow Hub**: AI planning compilation and blocker diagnostics.
  * **Settings**: Environment path settings and API key storage.

---

## 3. Detailed Page Layouts

### A. Dashboard View
* **Stat Cards**: Render metrics with glassmorphic cards:
  * Total business tasks vs technical tasks completed.
  * Focus Time (calculated via uvicorn background tracking).
  * Friction level (calculated based on number of tasks in `on_hold` or exceeding estimation).
* **Weekly Focus Area**: Shows active projects ("Sample Project", "StoryWeaver") and lists priority tasks for the day.
* **Flow Suggestions Banner**: Custom dynamic card stating: *"You have 2 dev tasks on hold. Would you like to run the AI blocker check?"*

### B. Kanban Board View
* **View Controls**: A top control bar providing:
  * **Filter Toggles**: Segmented slider buttons to toggle between categories or assigned persons.
  * **Dynamic Subgroups (Swimlanes)**: Visual horizontal dividers that group tasks by fields like Project or Category. Swimlanes that contain 0 items (either naturally or due to filters) dynamically hide themselves to keep the workspace clean.
* **Columns (Status)**:
  * `Backlog` (Gray indicator)
  * `Ready to Start` (Cyan indicator)
  * `In Progress` (Purple indicator)
  * `On Hold` (Yellow indicator)
  * `Done` (Green indicator)
* **Cards**: Each task is displayed inside a custom draggable card showing:
  * Task Name.
  * Project Tag (with color coding matching project specifications).
  * Source label (e.g., `NotionArch`, `Current Plan`).
  * Duration Tracker: progress bar representing `current_duration` against `estimated_duration`.

### C. Task Edit Modal (Ticket Editor)
* **AI Enhance Ticket**: A dedicated button utilizing Gemini to intelligently expand stub descriptions into structured Markdown (Requirements, Preconditions, Verifications).
* **Status & Properties**: Selectors for Status, Category, Project, and Grouping.
* **Archived Toggle**: A specific checkbox to mark a task as `archived`, which explicitly hides it from the active Sprint board for historical tracking.

### D. Create Custom View Modal
* **Configuration Form**: Input fields allowing the user to dynamically generate new Notion-style database views.
  * **View Name**: Text input for the display name (e.g. `📋 My Sprint`).
  * **Layout Type**: Dropdown selecting the core visualization engine (`Board`, `Table`, `List`).

### E. Backlog View
* **Quick Creator**: Input bar at the top to type a task name, hit `Enter` to create. The task description is auto-generated by the AI in the background.
* **Data Table**: Displays a clean, paginated table of tasks. Headers enable sorting by Status, Project, and Category.
* **Bulk AI Classify**: Select multiple tasks and click "AI Classify" to run parallel classification requests through the FastAPI backend to fill out project, category, and estimation parameters.

### F. AI Flow Hub View
* **Weekly Plan Compiler**: Card with a button to scan local planning markdown documents and draft a sprint calendar. Shows an editable preview of the output.
* **Flow State Diagnostics**: Button to trigger Gemini to analyze the active database. Returns list of blockers, tasks that are stalled, and proposes actionable split lists for complex tickets.

### G. Settings View
* **Gemini API Key**: Password-hidden input to save the key to database settings.
* **Planning Workspace Directory**: File directory input path to locate local markdown documents.
* **Active Projects Editor**: List of projects with editable colors and descriptions.
