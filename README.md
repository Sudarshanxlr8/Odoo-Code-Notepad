# Odoo Code Notepad

A powerful offline knowledge notebook and GitHub synchronization system for Odoo developers.

[![Visual Studio Marketplace](https://img.shields.io/badge/Marketplace-Odoo--Code--Notepad-blueviolet)](https://marketplace.visualstudio.com/)
[![License](https://img.shields.io/badge/License-MIT-blue)](LICENSE)

---

## Description

When working on Odoo tasks, developers frequently search through vast codebases to understand existing implementations, method overrides, model definitions, controllers, XML views, or localization logic. Once a task is completed, it is easy to forget:
- Where the reference code was originally located.
- Which repository the implementation belonged to.
- Which development branch contained the code.
- Which commit hash or URL introduced the change.
- What specific approach was ultimately selected.

**Odoo Code Notepad** addresses this challenge by enabling developers to build and curate their own searchable knowledge base directly inside Visual Studio Code. Everything is stored locally on your machine—no cloud services, no mandatory user accounts, and full offline operation. Optionally, you can synchronize your notes across machines with a single private GitHub repository.

---

## Architecture: Local-First Synchronization

Odoo Code Notepad remains **local-first**. GitHub does **not** replace local storage.

```text
Local Storage (~/.odoo-code-notepad)
      │
      │ normal editing & local autosave
      ▼
Odoo Code Notepad Task Editor
      │
      │ optional Sync / Push / Pull
      ▼
Private GitHub Notes Repository
```

- Normal task editing and autosave work completely offline on your local drive.
- GitHub serves as an additional synchronization, backup, version history, and cross-device storage layer.
- If GitHub or the network is unavailable, task editing, image attachments, code snippets, and autosave continue working locally without disruption.

---

## Features

### Task Management
- **Structured Categories**: Organize development tasks under Todo, In Progress, Completed, or Archived.
- **Favorites**: Star important tasks and snippets for fast access.
- **Search**: Perform case-insensitive search across tasks, notes, and code snippets.
- **Recent History**: Keep track of recently accessed tasks in a dedicated view.

### Rich Notes
- **Interactive Markdown Editor**: Write structured notes with support for bold, italics, headers, links, code blocks, lists, task lists, and tables.
- **Live Preview**: Toggle between write and markdown preview tabs.
- **Autosave**: Background saving occurs automatically to local storage, ensuring no data loss.
- **Formatting Tools**: Formatting toolbar for headings, bold, italic, strikethrough, lists, task lists, tables, quotes, code blocks, links, and emojis.

### Code Snippets
- **Context-Aware Capturing**: Save selected blocks of code directly from your active editor.
- **Metadata Storage**: Automatically records file path, language, repository, branch, line numbers, and commit details.
- **Jump to Code**: Click a button on the snippet card to open the source file, highlight the exact lines, and focus the view.

### Image Support
- **Flexible Uploads**: Drag and drop files, paste screenshots from clipboard, or browse local files.
- **Image Viewer**: Hover and click on thumbnails to open a fullscreen modal preview showing image dimensions.
- **Download**: Copy cached images back to any directory on your computer.

### Repository Information
- **Version Tracking**: Track Repository Name, Branch, Commit URL, and Runbot URL.
- **Manual Overwrite**: Git auto-detection populates fields automatically, but allows developers to manually edit and overwrite values for specific tasks.
- **URL Validation**: Integrates syntax checks to verify URL formatting for Commit and Runbot addresses without blocking updates.

### Export & Backup
- **PDF Export**: Generate formatted, clean PDF pages of your tasks and notes for sharing or printing.
- **Backup to ZIP**: Bundle all tasks, images, and settings into a single compressed backup.
- **Conflict Resolution**: Restore backups with options to overwrite entirely or merge with existing newer edits.

### GitHub Notes Sync (Version 2.0.0)
- **Private Repository Sync**: Synchronize notes across devices using a private GitHub repository.
- **Create or Connect**: Create a new private notes repository directly from VS Code or connect an existing repository.
- **Task & Repository Controls**: Granular task-level (`Sync`, `Push`, `Pull`, `Open on GitHub`) and sidebar repository-wide (`Sync All`, `Push All`, `Pull All`, `Open Repository`, `Settings`) operations.
- **Conflict Protection**: Hash-based conflict detection prevents silent overwrites when changes occur on both local and remote copies.
- **Status Folder Mapping**: Automatically moves tasks between `todo/`, `in-progress/`, `completed/`, and `archived/` remote folders upon status updates without duplicating files.

### Offline Storage
- Works entirely offline as a primary working storage.
- Optional cloud/git synchronization with no third-party server tracking.

---

## GitHub Notes Sync

Connect Odoo Code Notepad to a private GitHub repository to keep your development notes synchronized across multiple workstations.

<!-- Screenshot: GitHub Sync -->
<!-- Add image/GIF here -->

### Repository Connection & Setup

When connecting to GitHub:
- **Create New Private Repository**: Automatically creates a dedicated private repository (default suggested name: `Odoo-Code-Notepad-Notes`), initializes the required structure (`README.md`, `index.md`, `.odoo-code-notepad/config.json`), and connects it immediately.
- **Use Existing Repository**: Select any existing repository you have access to. If a public repository is selected, a privacy warning is presented before connecting.

### Task-Level Controls

Each task editor header includes a compact GitHub sync badge and action controls:
- **`[ Sync ]`**: Intelligently inspects local and remote states, automatically pushing local changes, pulling remote updates, or prompting conflict resolution.
- **`Push to GitHub`**: Pushes the current local task, images, and snippets to the remote repository.
- **`Pull from GitHub`**: Retrieves the remote version of the task into local storage.
- **`Open on GitHub`**: Opens the corresponding task folder directly in your browser on GitHub.

### Sidebar Repository Controls

The dedicated **GITHUB NOTES** sidebar view provides repository-wide operations:
- **`Connect GitHub`**: Initiate authentication and repository connection.
- **`Sync All`**: Synchronizes all local tasks with the GitHub repository.
- **`Push All`**: Pushes all eligible local tasks to GitHub.
- **`Pull All`**: Pulls remote updates for all synchronized tasks.
- **`Open Repository`**: Opens the main GitHub notes repository in browser.
- **`Disconnect GitHub`**: Disconnects synchronization without deleting local notes or remote repository data.

### Sync Status Indicators

| Indicator | Status | Meaning |
|:---:|---|---|
| `✓` | **Synced** | Local and GitHub versions are fully synchronized. |
| `↑` | **Local changes** | Local task has modifications waiting to be pushed. |
| `↓` | **GitHub changes** | Remote repository contains newer updates to pull. |
| `⚠` | **Conflict** | Both local and GitHub versions have been modified independently. |
| `○` | **Not synced** | Task has not been synchronized with GitHub yet. |
| `!` | **Remote deleted** | Task folder was removed on the remote GitHub repository. |

### Conflict Protection & Data Safety

Odoo Code Notepad **never silently overwrites** your data:
- If both local and remote task versions change independently, a conflict (`⚠`) is flagged, presenting options to Compare, Keep Local, or Keep GitHub.
- Pulling remote changes will warn before replacing local unsaved edits.
- Deleting a task remotely on GitHub will not delete your local working copy.

### Local-First & Offline Behavior

- Notes are always written and saved locally first.
- If network connection or GitHub API is unavailable:
  - Task editing, markdown notes, code snippets, image attachments, and local autosave continue working normally.
  - Sync operations gracefully notify you without interrupting your workflow.
  - You can synchronize your changes whenever connectivity is restored.

---

## GitHub Notes Repository Structure

Synchronized GitHub notes repositories use the following standard directory layout:

```text
Odoo-Code-Notepad-Notes/
├── README.md
├── index.md
├── .odoo-code-notepad/
│   └── config.json
│
├── todo/
│   └── task-name/
│       ├── task.md
│       ├── metadata.json
│       ├── images/
│       │   └── screenshot-1.png
│       └── snippets/
│           └── snippet-1.md
│
├── in-progress/
│   └── task-name/
│       ├── task.md
│       ├── metadata.json
│       ├── images/
│       └── snippets/
│
├── completed/
│   └── task-name/
│       ├── task.md
│       ├── metadata.json
│       ├── images/
│       └── snippets/
│
└── archived/
    └── task-name/
        ├── task.md
        ├── metadata.json
        ├── images/
        └── snippets/
```

- **`task.md`**: Human-readable task content in Markdown.
- **`metadata.json`**: Structured metadata (tags, repository info, branch, commit URL, timestamps).
- **`images/`**: Physical image attachments associated with the task.
- **`snippets/`**: Individual Markdown files preserving saved code blocks and jump-to-code location references.
- **`index.md`**: An automatically generated summary index linking all tasks categorized by status.

### Task Status Folder Mapping

Changing a task's status in the local editor automatically moves its remote folder during the next sync/push operation:

```text
todo/tax-import/  ──(Status: In Progress)──>  in-progress/tax-import/  ──(Status: Completed)──>  completed/tax-import/
```

This prevents duplicate task folders from accumulating in your GitHub repository.

---

## Cross-Device Workflow Example

1. **On Computer A (Office Workstation)**:
   - Create a task: `[Peppol] Fix Tax Validation`.
   - Add markdown notes, drag & drop screenshots, and save code snippets.
   - Click `Sync` (or `Push`) to push the task to your private GitHub repository.

2. **On Computer B (Home Laptop)**:
   - Open VS Code with **Odoo Code Notepad** installed.
   - Click `Connect GitHub` in the sidebar and select the same private repository.
   - Click `Pull All` (or `Sync`).
   - All tasks, notes, images, snippets, and code location pointers are restored locally onto Computer B.

---

## Privacy & Security

- **Private Repositories**: When creating a new notes repository, the extension sets it as **Private** by default. Avoid using public repositories for proprietary code notes.
- **Local Control**: Working notes remain on your local disk. GitHub sync is strictly optional.
- **Secure Authentication**: GitHub authentication is handled through the extension's GitHub connection flow via official VS Code authentication sessions. Personal access tokens are never saved to task files, stored in plain text settings, or transmitted to Webview panels.
- **Zero Telemetry**: No tracking, usage analytics, or error logs are transmitted to external servers.

---

## Installation

You can search for and install **Odoo Code Notepad** directly from the Extension Marketplace within Visual Studio Code or download it from the web link:

[[Marketplace Link](https://marketplace.visualstudio.com/items?itemName=sumai-odoo.odoo-code-notepad)]

---

## Getting Started

1. Open the **Odoo Code Notepad** view from your VS Code Activity Bar.
2. Click the **+** button in the sidebar or use `Ctrl + Alt + N` to create a new task.
3. Add markdown notes, structure your guidelines, and organize tags.
4. Highlight key references in your codebase, press `Ctrl + Alt + S` to link code to your active task.
5. Drag and drop screenshots directly into the task editor pane.
6. Connect GitHub Notes in the sidebar (`Connect GitHub`) to synchronize your development knowledge base across computers.

---

## Keyboard Shortcuts

The extension provides standard keybindings to streamline note-taking and snippet storage:

| Shortcut | Action | Default Command |
| --- | --- | --- |
| `Ctrl + Alt + N` | Create Task | `odoo-notepad.createTask` |
| `Ctrl + Alt + S` | Save Selected Code Snippet | `odoo-notepad.saveSnippet` |
| `Ctrl + Alt + F` | Search Tasks | `odoo-notepad.searchNotes` |
| `Ctrl + Alt + P` | Export Task as PDF | `odoo-notepad.exportPdf` |
| `Ctrl + Alt + B` | Create Backup | `odoo-notepad.backup` |

---

## Local Storage

All extension assets, configuration files, and task listings are saved locally on your filesystem. 

### Data Paths
- **Windows**: `C:\Users\<username>\.odoo-code-notepad`
- **Linux**: `~/.odoo-code-notepad`
- **macOS**: `~/.odoo-code-notepad`

### Directory Structure
- `/tasks`: JSON listings of all created tasks.
- `/images`: Copied image attachments with unique filename hashes.
- `/exports`: Exported PDF tasks.
- `/backups`: ZIP archives of task data.
- `settings.json`: User configuration settings.
- `github.json`: Local GitHub synchronization settings.

Local storage remains your primary working storage. GitHub synchronization is an optional secondary layer.

---

## Roadmap

Planned enhancements for future releases:
- AI-powered summaries of development notes.
- Semantic AI search query across all saved codebases and notes.
- Automatic GitHub Pull Request URL links generation.
- Dynamic Git workspace branch integration.
- Analytics and dashboard reports on Odoo task completion.
- Support for customizable webview themes.
- Cross-workspace note and snippet search.

---

## Contributing

Contributions, bug reports, and feature suggestions are welcome. Please open an issue or submit a pull request on the repository:

[[Repository Link](https://github.com/Sudarshanxlr8/Odoo-Code-Notepad)]

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Publisher

**Publisher Name**: Sudarshan Maity  
- **GitHub**: [[GitHub Profile]](https://github.com/Sudarshanxlr8)
- **Repository**: [[GitHub Repository]](https://github.com/Sudarshanxlr8/Odoo-Code-Notepad)  
- **Marketplace**: [[Marketplace URL]](https://marketplace.visualstudio.com/items?itemName=sumai-odoo.odoo-code-notepad)
