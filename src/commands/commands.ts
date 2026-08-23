import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StorageService } from '../services/storage';
import { GitService } from '../services/git';
import { PdfService } from '../services/pdf';
import { BackupService } from '../services/backup';
import { GitHubAuthService } from '../services/githubAuth';
import { GitHubService } from '../services/github';
import { GitHubSyncService } from '../services/githubSync';
import { Task, CodeSnippet, TaskStatus, RepositoryInfo } from '../types';
import { TaskEditorPanel } from '../views/taskEditor';
import { TaskTreeProvider } from '../providers/taskProvider';
import { FavoriteTreeProvider } from '../providers/favoriteProvider';
import { RecentTreeProvider } from '../providers/recentProvider';
import { SearchTreeProvider } from '../providers/searchProvider';
import { SettingsTreeProvider } from '../providers/settingsProvider';
import { GitHubTreeProvider } from '../providers/githubProvider';

export class CommandManager {
  constructor(
    private context: vscode.ExtensionContext,
    private taskProvider: TaskTreeProvider,
    private favoriteProvider: FavoriteTreeProvider,
    private recentProvider: RecentTreeProvider,
    private searchProvider: SearchTreeProvider,
    private settingsProvider: SettingsTreeProvider,
    private githubProvider?: GitHubTreeProvider
  ) {}

  public registerCommands(): void {
    // 1. Refresh View Command
    this.context.subscriptions.push(
      vscode.commands.registerCommand('odoo-notepad.refreshTasks', () => {
        this.taskProvider.refresh();
        this.favoriteProvider.refresh();
        this.recentProvider.refresh();
        this.searchProvider.refresh();
        this.settingsProvider.refresh();
        if (this.githubProvider) {
          this.githubProvider.refresh();
        }
      })
    );

    // 2. Open Task Webview
    this.context.subscriptions.push(
      vscode.commands.registerCommand('odoo-notepad.openTask', async (taskId: string) => {
        const task = await StorageService.getTask(taskId);
        if (task) {
          TaskEditorPanel.createOrShow(this.context.extensionUri, taskId, task);
          this.recentProvider.refresh();
        } else {
          vscode.window.showErrorMessage(`Task not found: ${taskId}`);
        }
      })
    );

    // 3. Create Task
    this.context.subscriptions.push(
      vscode.commands.registerCommand('odoo-notepad.createTask', async () => {
        const title = await vscode.window.showInputBox({
          prompt: 'Enter Task Title',
          placeHolder: 'e.g. Fix Tax Invoice localization'
        });

        if (!title || title.trim() === '') {
          return;
        }

        const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        // Detect workspace & Git info if possible
        let gitInfo: RepositoryInfo = { repositoryName: '', branch: '', commitUrl: '', runbotUrl: '' };
        let workspacePath = '';
        
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const docUri = editor.document.uri;
          const workspaceFolder = vscode.workspace.getWorkspaceFolder(docUri);
          if (workspaceFolder) {
            workspacePath = workspaceFolder.uri.fsPath;
            gitInfo = await GitService.getRepoInfo(workspacePath);
          }
        } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
          workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
          gitInfo = await GitService.getRepoInfo(workspacePath);
        }

        const newTask: Task = {
          id: taskId,
          title: title.trim(),
          description: '',
          status: 'Todo',
          repository: gitInfo,
          branch: gitInfo.branch,
          workspace: workspacePath,
          createdDate: new Date().toISOString(),
          updatedDate: new Date().toISOString(),
          tags: [],
          notes: '',
          images: [],
          snippets: []
        };

        await StorageService.saveTask(newTask);
        
        // Refresh sidebar
        vscode.commands.executeCommand('odoo-notepad.refreshTasks');
        
        // Open the newly created task webview
        vscode.commands.executeCommand('odoo-notepad.openTask', taskId);
      })
    );

    // 4. Save Snippet (Ctrl+Alt+S)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('odoo-notepad.saveSnippet', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage('No active text editor. Open a code file and select text to save a snippet.');
          return;
        }

        const selection = editor.selection;
        const selectedCode = editor.document.getText(selection);
        if (!selectedCode || selectedCode.trim() === '') {
          vscode.window.showErrorMessage('Please highlight a block of code first.');
          return;
        }

        // Get file/workspace properties
        const filePath = editor.document.uri.fsPath;
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
        const workspacePath = workspaceFolder ? workspaceFolder.uri.fsPath : '';
        const displayFile = workspaceFolder ? path.relative(workspacePath, filePath) : filePath;
        
        // Git properties
        const gitInfo = await GitService.getRepoInfo(workspacePath || path.dirname(filePath));

        // Prompt title
        const snippetTitle = await vscode.window.showInputBox({
          prompt: 'Enter Snippet Title',
          placeHolder: 'e.g. Override compute_taxes method'
        });

        if (!snippetTitle || snippetTitle.trim() === '') {
          return;
        }

        // Prompt description (optional)
        const snippetDesc = await vscode.window.showInputBox({
          prompt: 'Enter Snippet Description (Optional)',
          placeHolder: 'e.g. Used for accounting tax validation logic'
        });

        // Prompt Task target
        const tasks = await StorageService.getTaskMetadataList();
        
        const taskOptions = tasks.map(t => ({
          label: t.title,
          description: `[${t.status}] ${t.tags.join(', ') || ''}`,
          taskId: t.id
        }));

        const createNewOption = {
          label: '$(add) Create New Task...',
          description: 'Create a new task and associate this snippet',
          taskId: 'new'
        };

        const selectionPick = await vscode.window.showQuickPick([createNewOption, ...taskOptions], {
          placeHolder: 'Select target task for this snippet'
        });

        if (!selectionPick) {
          return;
        }

        let targetTaskId = selectionPick.taskId;
        let targetTask: Task | null = null;

        if (targetTaskId === 'new') {
          const title = await vscode.window.showInputBox({
            prompt: 'Enter Task Title for New Task',
            placeHolder: 'e.g. Review tax computation'
          });

          if (!title || title.trim() === '') {
            return;
          }

          const newTaskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          targetTask = {
            id: newTaskId,
            title: title.trim(),
            description: '',
            status: 'Todo',
            repository: gitInfo,
            branch: gitInfo.branch,
            workspace: workspacePath,
            createdDate: new Date().toISOString(),
            updatedDate: new Date().toISOString(),
            tags: [],
            notes: '',
            images: [],
            snippets: []
          };
          targetTaskId = newTaskId;
        } else {
          targetTask = await StorageService.getTask(targetTaskId);
        }

        if (!targetTask) {
          vscode.window.showErrorMessage('Task not found.');
          return;
        }

        // Build CodeSnippet object
        const snippet: CodeSnippet = {
          id: `snip_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          title: snippetTitle.trim(),
          description: snippetDesc ? snippetDesc.trim() : '',
          file: displayFile,
          workspace: workspacePath,
          language: editor.document.languageId,
          repository: gitInfo.repositoryName,
          branch: gitInfo.branch,
          commit: gitInfo.commitUrl,
          startLine: selection.start.line + 1, // Convert 0-indexed to 1-indexed
          endLine: selection.end.line + 1,
          selectedCode,
          createdDate: new Date().toISOString()
        };

        targetTask.snippets = targetTask.snippets || [];
        targetTask.snippets.push(snippet);
        
        await StorageService.saveTask(targetTask);

        vscode.window.showInformationMessage(`Code snippet saved to task "${targetTask.title}".`);
        
        // Refresh sidebar and opened editors
        vscode.commands.executeCommand('odoo-notepad.refreshTasks');
        
        // If webview is open, reload it
        // (the panel listener handles posting update, but a window reload works too if panel is active)
        vscode.commands.executeCommand('odoo-notepad.openTask', targetTaskId);
      })
    );

    // 5. Jump to Snippet
    this.context.subscriptions.push(
      vscode.commands.registerCommand('odoo-notepad.jumpToSnippet', async (taskId: string, snippetId: string) => {
        const task = await StorageService.getTask(taskId);
        if (!task || !task.snippets) {
          return;
        }
        
        const snippet = task.snippets.find(s => s.id === snippetId);
        if (!snippet) {
          return;
        }

        let targetPath = snippet.file;
        if (!path.isAbsolute(targetPath)) {
          if (snippet.workspace) {
            targetPath = path.join(snippet.workspace, snippet.file);
          } else {
            const folders = vscode.workspace.workspaceFolders;
            if (folders && folders.length > 0) {
              targetPath = path.join(folders[0].uri.fsPath, snippet.file);
            }
          }
        }

        if (!fs.existsSync(targetPath)) {
          vscode.window.showWarningMessage(`Could not locate snippet file at path: ${targetPath}. Please check if the file was deleted.`);
          return;
        }

        try {
          const document = await vscode.workspace.openTextDocument(vscode.Uri.file(targetPath));
          const editor = await vscode.window.showTextDocument(document);
          const startPos = new vscode.Position(Math.max(0, snippet.startLine - 1), 0);
          const endPos = new vscode.Position(Math.max(0, snippet.endLine - 1), 999);
          
          editor.selection = new vscode.Selection(startPos, endPos);
          editor.revealRange(new vscode.Range(startPos, endPos), vscode.TextEditorRevealType.InCenter);
        } catch (e) {
          vscode.window.showErrorMessage('Failed to jump to file: ' + e);
        }
      })
    );

    // 6. Search Notes Command (Ctrl+Alt+F)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('odoo-notepad.searchNotes', async () => {
        const query = await vscode.window.showInputBox({
          prompt: 'Enter search text',
          placeHolder: 'Search titles, descriptions, notes, snippets...'
        });

        if (query === undefined) {
          return;
        }

        await this.searchProvider.setQuery(query);

        // Focus search TreeView
        vscode.commands.executeCommand('workbench.view.extension.odoo-code-notepad-sidebar');
        vscode.commands.executeCommand('odoo-code-notepad-search.focus');
      })
    );

    // 7. Export Task as PDF (Ctrl+Alt+P)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('odoo-notepad.exportPdf', async (taskId?: string) => {
        let id = taskId;
        if (!id) {
          const tasks = await StorageService.getTaskMetadataList();
          if (tasks.length === 0) {
            vscode.window.showErrorMessage('No tasks available to export.');
            return;
          }
          const taskPick = await vscode.window.showQuickPick(
            tasks.map(t => ({ label: t.title, id: t.id })),
            { placeHolder: 'Select task to export as PDF' }
          );
          if (!taskPick) {
            return;
          }
          id = taskPick.id;
        }

        const task = await StorageService.getTask(id);
        if (!task) {
          vscode.window.showErrorMessage('Task not found.');
          return;
        }

        try {
          const pdfPath = await PdfService.exportTask(task);
          
          vscode.window.showInformationMessage(
            `Task "${task.title}" exported to PDF.`,
            'Open PDF'
          ).then(selection => {
            if (selection === 'Open PDF') {
              vscode.env.openExternal(vscode.Uri.file(pdfPath));
            }
          });
        } catch (e) {
          vscode.window.showErrorMessage('Failed to export PDF: ' + e);
        }
      })
    );

    // 8. Export Backup (Ctrl+Alt+B)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('odoo-notepad.backup', async () => {
        const defaultUri = vscode.Uri.file(path.join(StorageService.getBackupsDir(), `backup_${Date.now()}.zip`));
        
        const saveUri = await vscode.window.showSaveDialog({
          defaultUri,
          saveLabel: 'Export Backup',
          filters: {
            'ZIP Archive': ['zip']
          }
        });

        if (!saveUri) {
          return;
        }

        try {
          const zipPath = await BackupService.createBackup(saveUri.fsPath);
          vscode.window.showInformationMessage(`Backup successfully exported to ${zipPath}`);
        } catch (e) {
          vscode.window.showErrorMessage('Failed to create backup: ' + e);
        }
      })
    );

    // 9. Restore Backup
    this.context.subscriptions.push(
      vscode.commands.registerCommand('odoo-notepad.restore', async () => {
        const openOptions: vscode.OpenDialogOptions = {
          canSelectMany: false,
          openLabel: 'Select Backup file',
          filters: {
            'ZIP Archive': ['zip']
          }
        };

        const fileUri = await vscode.window.showOpenDialog(openOptions);
        if (!fileUri || !fileUri[0]) {
          return;
        }

        const zipPath = fileUri[0].fsPath;

        // Ask for mode
        const modePick = await vscode.window.showQuickPick(
          [
            { label: 'Merge & Keep Newer', id: 'merge', description: 'Combines backups, overwriting only if backup task is newer.' },
            { label: 'Replace Existing', id: 'replace', description: 'Deletes all current tasks/images, replacing them entirely.' }
          ],
          { placeHolder: 'Select restore mode (Caution: Replace will delete current local notes)' }
        );

        if (!modePick) {
          return;
        }

        try {
          const result = await BackupService.restoreBackup(zipPath, modePick.id as 'replace' | 'merge');
          
          vscode.window.showInformationMessage(
            `Backup restored successfully. Restored/Updated: ${result.restoredTasks} tasks. Merged/Skipped: ${result.mergedTasks} tasks.`
          );

          // Refresh everything
          vscode.commands.executeCommand('odoo-notepad.refreshTasks');
        } catch (e) {
          vscode.window.showErrorMessage('Failed to restore backup: ' + e);
        }
      })
    );

    // 10. Edit settings in sidebar
    this.context.subscriptions.push(
      vscode.commands.registerCommand('odoo-notepad.changeSetting', async (key: string) => {
        const settings = await StorageService.getSettings();

        if (key === 'theme') {
          const choice = await vscode.window.showQuickPick(['light', 'dark', 'system'], {
            placeHolder: `Select Theme (current: ${settings.theme})`
          });
          if (choice) {
            settings.theme = choice as 'light' | 'dark' | 'system';
            await StorageService.saveSettings(settings);
          }
        } 
        else if (key === 'autosaveInterval') {
          const val = await vscode.window.showInputBox({
            prompt: 'Enter autosave interval in seconds',
            value: String(settings.autosaveInterval / 1000),
            validateInput: (text) => {
              const num = parseInt(text);
              if (isNaN(num) || num <= 0) {
                return 'Please enter a positive integer greater than 0';
              }
              return null;
            }
          });
          if (val) {
            settings.autosaveInterval = parseInt(val) * 1000;
            await StorageService.saveSettings(settings);
          }
        } 
        else if (key === 'maxRecentTasks') {
          const val = await vscode.window.showInputBox({
            prompt: 'Enter maximum recent tasks limit',
            value: String(settings.maxRecentTasks),
            validateInput: (text) => {
              const num = parseInt(text);
              if (isNaN(num) || num <= 0) {
                return 'Please enter a positive integer greater than 0';
              }
              return null;
            }
          });
          if (val) {
            settings.maxRecentTasks = parseInt(val);
            await StorageService.saveSettings(settings);
          }
        } 
        else if (key === 'storageFolder') {
          const folderPick = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Storage Folder'
          });
          if (folderPick && folderPick[0]) {
            const oldFolder = settings.storageFolder;
            const newFolder = folderPick[0].fsPath;
            
            // Confirm migrations
            const confirm = await vscode.window.showInformationMessage(
              `Migrate storage folder to ${newFolder}? Unsaved configuration changes will not be copied automatically.`,
              'Migrate', 'Cancel'
            );
            
            if (confirm === 'Migrate') {
              settings.storageFolder = newFolder;
              await StorageService.saveSettings(settings);
              await StorageService.updateStorageFolder(newFolder);
            }
          }
        }
        else if (key === 'defaultExportFolder') {
          const folderPick = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Export Folder'
          });
          if (folderPick && folderPick[0]) {
            settings.defaultExportFolder = folderPick[0].fsPath;
            await StorageService.saveSettings(settings);
          }
        }

        // Refresh views
        vscode.commands.executeCommand('odoo-notepad.refreshTasks');
      })
    );

    // 11. Connect GitHub Notes
    this.context.subscriptions.push(
      vscode.commands.registerCommand('odoo-notepad.connectGithub', async () => {
        try {
          const session = await GitHubAuthService.getSession(true);
          if (!session) {
            vscode.window.showWarningMessage('GitHub authentication cancelled.');
            return;
          }

          const userProfile = await GitHubAuthService.getUserProfile(session.accessToken);
          if (!userProfile) {
            vscode.window.showErrorMessage('Failed to fetch GitHub profile for authenticated session.');
            return;
          }

          // Option: Create New or Use Existing
          const setupChoice = await vscode.window.showQuickPick(
            [
              { label: '$(repo-create) Create New Private Repository', id: 'create', description: 'Create a dedicated private repository (e.g. Odoo-Code-Notepad-Notes)' },
              { label: '$(repo) Use Existing Repository', id: 'existing', description: 'Connect an existing private or public GitHub repository' }
            ],
            { placeHolder: 'Set up GitHub Notes Synchronization Repository' }
          );

          if (!setupChoice) {
            return;
          }

          let repoInfo = null;

          if (setupChoice.id === 'create') {
            const repoName = await vscode.window.showInputBox({
              prompt: 'Enter Name for New Private GitHub Notes Repository',
              value: 'Odoo-Code-Notepad-Notes',
              validateInput: (val) => val && val.trim() !== '' ? null : 'Repository name cannot be empty'
            });

            if (!repoName) {
              return;
            }

            repoInfo = await vscode.window.withProgress({
              location: vscode.ProgressLocation.Notification,
              title: `Creating private GitHub repository "${repoName.trim()}"...`
            }, async () => {
              const newRepo = await GitHubService.createPrivateRepository(repoName.trim(), 'Synchronized notes from Odoo Code Notepad', session.accessToken);
              await GitHubSyncService.initializeNotesRepository(newRepo.owner, newRepo.name, newRepo.defaultBranch, session.accessToken);
              return newRepo;
            });

          } else {
            // Pick existing repo
            const userRepos = await GitHubService.listUserRepositories(session.accessToken);
            const repoPicks = userRepos.map(r => ({
              label: `${r.owner}/${r.name}`,
              description: r.isPrivate ? 'Private' : 'Public (Warning)',
              repo: r
            }));

            const selectedPick = await vscode.window.showQuickPick(repoPicks, {
              placeHolder: 'Select existing repository for Odoo Code Notepad Notes'
            });

            if (!selectedPick) {
              return;
            }

            const chosen = selectedPick.repo;
            if (!chosen.isPrivate) {
              const confirmPublic = await vscode.window.showWarningMessage(
                `Warning: The repository "${chosen.owner}/${chosen.name}" is public. Your notes may be visible to anyone. Proceed anyway?`,
                { modal: true },
                'Proceed', 'Cancel'
              );
              if (confirmPublic !== 'Proceed') {
                return;
              }
            }

            repoInfo = await GitHubService.getRepository(chosen.owner, chosen.name, session.accessToken);
          }

          if (!repoInfo) {
            vscode.window.showErrorMessage('Failed to connect to the selected repository.');
            return;
          }

          // Save GitHub configuration
          await StorageService.saveGitHubConfig({
            connected: true,
            account: userProfile,
            repository: repoInfo,
            lastSyncedAt: new Date().toISOString()
          });

          vscode.window.showInformationMessage(`✓ Connected to GitHub Notes repository: ${repoInfo.owner}/${repoInfo.name}`);
          vscode.commands.executeCommand('odoo-notepad.refreshTasks');
        } catch (e: any) {
          vscode.window.showErrorMessage(`GitHub connection failed: ${e.message || e}`);
        }
      })
    );

    // 12. Sync Current Task
    this.context.subscriptions.push(
      vscode.commands.registerCommand('odoo-notepad.syncCurrentTask', async (taskId?: string) => {
        let id = taskId;
        if (!id) {
          const tasks = await StorageService.getTaskMetadataList();
          if (tasks.length === 0) {
            vscode.window.showErrorMessage('No tasks available to sync.');
            return;
          }
          const taskPick = await vscode.window.showQuickPick(
            tasks.map(t => ({ label: t.title, id: t.id })),
            { placeHolder: 'Select task to sync with GitHub' }
          );
          if (!taskPick) { return; }
          id = taskPick.id;
        }

        const task = await StorageService.getTask(id);
        if (!task) {
          vscode.window.showErrorMessage('Task not found.');
          return;
        }

        try {
          await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Syncing task "${task.title}" with GitHub...`
          }, async () => {
            const updatedTask = await GitHubSyncService.pushTask(task);
            vscode.window.showInformationMessage(`✓ Task "${updatedTask.title}" synchronized with GitHub.`);
          });
          vscode.commands.executeCommand('odoo-notepad.refreshTasks');
        } catch (e: any) {
          vscode.window.showErrorMessage(`GitHub sync failed: ${e.message || e}`);
        }
      })
    );

    // 13. Push Current Task
    this.context.subscriptions.push(
      vscode.commands.registerCommand('odoo-notepad.pushCurrentTask', async (taskId?: string) => {
        let id = taskId;
        if (!id) {
          const tasks = await StorageService.getTaskMetadataList();
          if (tasks.length === 0) { return; }
          const taskPick = await vscode.window.showQuickPick(tasks.map(t => ({ label: t.title, id: t.id })));
          if (!taskPick) { return; }
          id = taskPick.id;
        }

        const task = await StorageService.getTask(id);
        if (!task) { return; }

        try {
          await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Pushing task "${task.title}" to GitHub...`
          }, async () => {
            const updatedTask = await GitHubSyncService.pushTask(task, true);
            vscode.window.showInformationMessage(`↑ Task "${updatedTask.title}" pushed to GitHub.`);
          });
          vscode.commands.executeCommand('odoo-notepad.refreshTasks');
        } catch (e: any) {
          vscode.window.showErrorMessage(`Push failed: ${e.message || e}`);
        }
      })
    );

    // 14. Pull Current Task
    this.context.subscriptions.push(
      vscode.commands.registerCommand('odoo-notepad.pullCurrentTask', async (taskId?: string) => {
        let id = taskId;
        if (!id) {
          const tasks = await StorageService.getTaskMetadataList();
          if (tasks.length === 0) { return; }
          const taskPick = await vscode.window.showQuickPick(tasks.map(t => ({ label: t.title, id: t.id })));
          if (!taskPick) { return; }
          id = taskPick.id;
        }

        try {
          await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Pulling task from GitHub...`
          }, async () => {
            const updatedTask = await GitHubSyncService.pullTask(id);
            vscode.window.showInformationMessage(`↓ Task "${updatedTask.title}" pulled from GitHub.`);
          });
          vscode.commands.executeCommand('odoo-notepad.refreshTasks');
        } catch (e: any) {
          vscode.window.showErrorMessage(`Pull failed: ${e.message || e}`);
        }
      })
    );

    // 15. Sync All Tasks
    this.context.subscriptions.push(
      vscode.commands.registerCommand('odoo-notepad.syncAll', async () => {
        const tasks = await StorageService.getTaskMetadataList();
        if (tasks.length === 0) {
          vscode.window.showInformationMessage('No tasks found to sync.');
          return;
        }

        let syncedCount = 0;
        let failCount = 0;

        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: 'Syncing all tasks with GitHub...',
          cancellable: false
        }, async (progress) => {
          for (let i = 0; i < tasks.length; i++) {
            const tMeta = tasks[i];
            progress.report({ message: `(${i + 1}/${tasks.length}) ${tMeta.title}`, increment: (1 / tasks.length) * 100 });
            try {
              const fullTask = await StorageService.getTask(tMeta.id);
              if (fullTask) {
                await GitHubSyncService.pushTask(fullTask);
                syncedCount++;
              }
            } catch (e) {
              failCount++;
            }
          }
        });

        vscode.window.showInformationMessage(`GitHub Sync Complete: ${syncedCount} synchronized, ${failCount} failed.`);
        vscode.commands.executeCommand('odoo-notepad.refreshTasks');
      })
    );

    // 16. Push All Tasks
    this.context.subscriptions.push(
      vscode.commands.registerCommand('odoo-notepad.pushAll', async () => {
        const tasks = await StorageService.getTaskMetadataList();
        const confirm = await vscode.window.showInformationMessage(
          `Push all ${tasks.length} local tasks to GitHub?`,
          'Push All', 'Cancel'
        );
        if (confirm === 'Push All') {
          vscode.commands.executeCommand('odoo-notepad.syncAll');
        }
      })
    );

    // 17. Pull All Tasks
    this.context.subscriptions.push(
      vscode.commands.registerCommand('odoo-notepad.pullAll', async () => {
        const tasks = await StorageService.getTaskMetadataList();
        let count = 0;
        for (const t of tasks) {
          if (t.githubSync?.remotePath) {
            try {
              await GitHubSyncService.pullTask(t.id, true);
              count++;
            } catch {}
          }
        }
        vscode.window.showInformationMessage(`Pulled ${count} tasks from GitHub.`);
        vscode.commands.executeCommand('odoo-notepad.refreshTasks');
      })
    );

    // 18. Open GitHub Repository
    this.context.subscriptions.push(
      vscode.commands.registerCommand('odoo-notepad.openGithubRepo', async () => {
        const config = await StorageService.getGitHubConfig();
        if (config.connected && config.repository) {
          const url = `https://github.com/${config.repository.owner}/${config.repository.name}`;
          vscode.env.openExternal(vscode.Uri.parse(url));
        } else {
          vscode.window.showWarningMessage('GitHub Notes is not connected yet.');
        }
      })
    );

    // 19. Disconnect GitHub
    this.context.subscriptions.push(
      vscode.commands.registerCommand('odoo-notepad.disconnectGithub', async () => {
        const confirm = await vscode.window.showWarningMessage(
          'Disconnect GitHub Notes synchronization? Your local notes and GitHub repository will remain intact.',
          { modal: true },
          'Disconnect'
        );

        if (confirm === 'Disconnect') {
          await StorageService.clearGitHubConfig();
          GitHubAuthService.clearSession();
          vscode.window.showInformationMessage('Disconnected GitHub Notes synchronization.');
          vscode.commands.executeCommand('odoo-notepad.refreshTasks');
        }
      })
    );
  }
}

