# Odoo Code Notepad

A powerful offline knowledge notebook for Odoo developers.

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

**Odoo Code Notepad** addresses this challenge by enabling developers to build and curate their own searchable knowledge base directly inside Visual Studio Code. Everything is stored locally on your machine—no cloud services, no user accounts, and no external servers.

---

## Features

### Task Management
- **Structured Categories**: Organize development tasks under Todo, In Progress, Completed, or Archived.
- **Favorites**: Star important tasks and snippets for fast access.
- **Search**: Perform case-insensitive search across tasks, notes, and code snippets.
- **Recent History**: Keep track of recently accessed tasks in a dedicated view.

### Rich Notes
- **Interactive Markdown Editor**: Write structured notes with support for bold, italics, headers, links, and code blocks.
- **Live Preview**: Toggle between write and markdown preview tabs.
- **Autosave**: Background saving occurs automatically, ensuring no data loss.
- **Formatting Tools**: Shortcuts for checklists, tables, and lists.

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

### Export
- **PDF Export**: Generate formatted, clean PDF pages of your tasks and notes for sharing or printing.

### Backup & Restore
- **Backup to ZIP**: Bundle all tasks, images, and settings into a single compressed backup.
- **Conflict Resolution**: Restore backups with options to overwrite entirely or merge with existing newer edits.

### Offline Storage
- Works entirely offline.
- No user registry or remote database needed.

---

## Installation

You can search for and install **Odoo Code Notepad** directly from the Extension Marketplace within Visual Studio Code or download it from the web link:

[Add Marketplace Link Here]

---

## Getting Started

1. Open the **Odoo Code Notepad** view from your VS Code Activity Bar.
2. Click the **+** button in the sidebar or use the keyboard shortcut to create a new task.
3. Add markdown notes, structure your guidelines, and organize tags.
4. Highlight key references in your codebase, press the snippet shortcut to link code to your active task.
5. Drag and drop screenshots directly into the task editor pane.
6. Build and search your local developer knowledge base offline.

---

## Keyboard Shortcuts

The extension provides standard keybindings to streamline note-taking and snippet storage:

| Shortcut | Action | Default Command |
| --- | --- | --- |
| `Ctrl + Alt + N` | Create Task | `odoo-notepad.createTask` |
| `Ctrl + Alt + S` | Save Selected Code Snippet | `odoo-notepad.saveSnippet` |
| `Ctrl + Alt + F` | Search Tasks | `odoo-notepad.searchTasks` |
| `Ctrl + Alt + P` | Export Task as PDF | `odoo-notepad.exportPdf` |
| `Ctrl + Alt + B` | Create Backup | `odoo-notepad.createBackup` |

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

You can manually back up, copy, or migrate this folder to share your knowledge base between machines.

---

## Privacy

- **Zero Telemetry**: No tracking, usage analytics, or error reporting is sent to any remote server.
- **Zero Cloud Sync**: Your notes, snippets, and images are never uploaded to the cloud.
- **No Account Required**: Ready to use immediately upon installation with zero registration fields.
- **Total Ownership**: You own your data—it remains on your physical drive at all times.

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

[Add GitHub Repository Link Here]

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Publisher

**Publisher Name**: Sudarshan Maity  
- **GitHub**: [Add GitHub Profile]  
- **Repository**: [Add GitHub Repository]  
- **Marketplace**: [Add Marketplace URL]  
