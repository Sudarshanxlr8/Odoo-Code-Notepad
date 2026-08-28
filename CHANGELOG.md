# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-08-28

### Added

- **GitHub Notes Synchronization**: Added optional synchronization of local task notes, metadata, images, and code snippets with a private GitHub repository.
- **Private Repository Support**: Create a new private notes repository directly from VS Code or connect an existing repository.
- **Task & Repository Controls**: Added task-level `Sync`, `Push`, `Pull`, and `Open on GitHub` header controls, as well as sidebar repository-wide `Sync All`, `Push All`, `Pull All`, `Open Repository`, `GitHub Settings`, and `Disconnect` options.
- **Sync Status Indicators**: Added visual sync status indicators (`✓ Synced`, `↑ Local changes`, `↓ GitHub changes`, `⚠ Conflict`, `○ Not synced`, `! Remote deleted`) and tooltips across task lists and task headers.
- **Conflict Protection**: Hash-based conflict detection comparing local state, remote state, and last synced commit to prevent accidental overwrites.
- **Status Folder Mapping**: Automatic mapping and movement of task folders between `todo/`, `in-progress/`, `completed/`, and `archived/` directories on GitHub during status changes without duplicating tasks.
- **Atomic GitHub Commits**: Multi-file task synchronization (notes, metadata, images, snippets, `index.md`, `README.md`) grouped into a single atomic GitHub commit via the Git Data API.
- **GitHub Sidebar View**: Added dedicated `GITHUB NOTES` view container in the activity bar sidebar.

### Fixed

- Fixed a race condition during `Create New Repository` workflow where repository connection check triggered before async repository creation and layout initialization completed.

### Changed

- Extended task data model to include optional `githubSync` metadata while preserving local-first storage and offline autosave behavior.

# 1.0.1 - 2026-07-23

## Fixed

- Fixed Markdown preview formatting.
- Fixed toolbar formatting behavior.
- Fixed autosave and undo/redo issues.
- Fixed cursor jumping after toolbar actions.
- Improved "Jump to Code" by locating snippets using code search instead of relying only on line numbers.

## Improved

- Improved repository information layout.
- Improved image preview experience.
- Improved Markdown toolbar.
- Various UI and stability improvements.

## [1.0.0] - 2026-06-30

### Added

- **Task Management**: Organize development tasks under Todo, In Progress, Completed, or Archived categories.
- **Markdown Notes**: Write structured notes using an interactive markdown editor with live preview, autosave, and formatting tools.
- **Code Snippets**: Save context-aware code blocks directly from the active VS Code editor, including line numbers and metadata.
- **Jump to Code**: Open source files and jump directly to the exact lines matching a saved code snippet.
- **Image Attachments**: Drag and drop screenshots or images into the task editor.
- **Image Preview**: View images in a fullscreen preview modal with download capabilities.
- **Repository Information**: Track Repository Name, Branch, Commit URL, and Runbot URL.
- **Git Integration**: Automatically detect current repository details, branch, and commit hash.
- **PDF Export**: Export tasks and notes to clean, formatted PDF files.
- **ZIP Backup & Restore**: Create backups of your local tasks, images, and configuration, and restore them with merge/overwrite options.
- **Search**: Full-text search across all tasks, notes, and snippets.
- **Favorites**: Star tasks or snippets for easy reference.
- **Recent Tasks**: Quick-access history of recently opened tasks.
- **Offline Local Storage**: Store all data locally on your computer with complete privacy (zero telemetry/cloud sync).
