import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { StorageService } from '../services/storage';
import { GitService } from '../services/git';
import { PdfService } from '../services/pdf';
import { BackupService } from '../services/backup';
import { Task, CodeSnippet, TaskStatus, RepositoryInfo } from '../types';
import { TaskEditorPanel } from '../views/taskEditor';
import { TaskTreeProvider } from '../providers/taskProvider';
import { FavoriteTreeProvider } from '../providers/favoriteProvider';
import { RecentTreeProvider } from '../providers/recentProvider';
import { SearchTreeProvider } from '../providers/searchProvider';
import { SettingsTreeProvider } from '../providers/settingsProvider';

export class CommandManager {
  constructor(
    private context: vscode.ExtensionContext,
    private taskProvider: TaskTreeProvider,
    private favoriteProvider: FavoriteTreeProvider,
    private recentProvider: RecentTreeProvider,
    private searchProvider: SearchTreeProvider,
    private settingsProvider: SettingsTreeProvider
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
  }
}
