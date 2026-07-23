import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { Task, CodeSnippet } from '../types';
import { StorageService } from '../services/storage';

export class TaskEditorPanel {
  public static readonly viewType = 'odooCodeNotepad.taskEditor';
  private static readonly panels = new Map<string, TaskEditorPanel>();

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _task: Task;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, taskId: string, task: Task) {
    console.log("Loaded task for Webview panel (Task ID):", taskId);
    console.log("Loaded task data:", task);
    const column = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : undefined;

    // If we already have a panel for this task, show it.
    const existingPanel = TaskEditorPanel.panels.get(taskId);
    if (existingPanel) {
      existingPanel._task = task;
      existingPanel._updateHtml();
      existingPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      TaskEditorPanel.viewType,
      `Task: ${task.title}`,
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(extensionUri.fsPath, 'media')),
          vscode.Uri.file(path.join(extensionUri.fsPath, 'out')),
          vscode.Uri.file(StorageService.getBaseDir())
        ]
      }
    );

    const newPanel = new TaskEditorPanel(panel, extensionUri, task);
    TaskEditorPanel.panels.set(taskId, newPanel);
  }

  public static restore(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, task: Task) {
    const newPanel = new TaskEditorPanel(panel, extensionUri, task);
    TaskEditorPanel.panels.set(task.id, newPanel);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, task: Task) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._task = task;

    // Set the webview's initial html content
    this._updateHtml();

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Update the title if it changes
    this._panel.onDidChangeViewState(
      () => {
        if (this._panel.visible) {
          this._panel.title = `Task: ${this._task.title}`;
        }
      },
      null,
      this._disposables
    );

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        console.log("Received message from Webview:", message);
        switch (message.command) {
          case 'saveTask':
            await this._handleSaveTask(message.task);
            break;
          case 'pasteImage':
            await this._handlePasteImage(message.base64Data, message.mimeType);
            break;
          case 'uploadImage':
            await this._handleUploadImage();
            break;
          case 'deleteImage':
            await this._handleDeleteImage(message.imagePath);
            break;
          case 'downloadImage':
            await this._handleDownloadImage(message.imagePath);
            break;
          case 'deleteSnippet':
            await this._handleDeleteSnippet(message.snippetId);
            break;
          case 'updateSnippet':
            await this._handleUpdateSnippet(message.snippetId, message.title, message.description);
            break;
          case 'jumpToCode':
            await this._handleJumpToCode(message.snippet);
            break;
          case 'toggleFavorite':
            await this._handleToggleFavorite();
            break;
          case 'deleteTask':
            await this._handleDeleteTask();
            break;
          case 'exportPdf':
            vscode.commands.executeCommand('odoo-notepad.exportPdf', this._task.id);
            break;
          case 'openExternalUrl':
            if (message.url) {
              try {
                await vscode.env.openExternal(vscode.Uri.parse(message.url));
              } catch (e) {
                vscode.window.showErrorMessage('Failed to open URL: ' + e);
              }
            }
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public dispose() {
    TaskEditorPanel.panels.delete(this._task.id);

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private async _updateHtml() {
    this._panel.title = `Task: ${this._task.title}`;
    const settings = await StorageService.getSettings();
    this._panel.webview.html = await this._getHtmlForWebview(this._panel.webview, settings.autosaveInterval);
  }

  private async _handleSaveTask(updatedTaskData: Partial<Task>) {
    console.log("Saving task - Start ID:", this._task.id);
    this._task = {
      ...this._task,
      ...updatedTaskData,
      updatedDate: new Date().toISOString()
    };
    await StorageService.saveTask(this._task);
    console.log("Saving task - Complete ID:", this._task.id);
    this._panel.title = `Task: ${this._task.title}`;
    
    // Refresh Sidebar tree views
    vscode.commands.executeCommand('odoo-notepad.refreshTasks');
  }

  private async _handlePasteImage(base64Data: string, mimeType: string) {
    try {
      const relPath = await StorageService.saveImage(base64Data, mimeType);
      
      this._task.images = this._task.images || [];
      this._task.images.push(relPath);
      this._task.updatedDate = new Date().toISOString();
      await StorageService.saveTask(this._task);

      // Send update back to webview
      this._panel.webview.postMessage({
        command: 'updateImages',
        images: this._task.images,
        resolvedImages: this._resolveImageUris(this._task.images)
      });
      vscode.commands.executeCommand('odoo-notepad.refreshTasks');
    } catch (e) {
      vscode.window.showErrorMessage('Failed to save pasted image: ' + e);
    }
  }

  private async _handleUploadImage() {
    const options: vscode.OpenDialogOptions = {
      canSelectMany: false,
      openLabel: 'Select Image',
      filters: {
        'Images': ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']
      }
    };

    const fileUri = await vscode.window.showOpenDialog(options);
    if (fileUri && fileUri[0]) {
      try {
        const relPath = await StorageService.saveImageFromFile(fileUri[0].fsPath);
        
        this._task.images = this._task.images || [];
        this._task.images.push(relPath);
        this._task.updatedDate = new Date().toISOString();
        await StorageService.saveTask(this._task);

        // Send update back to webview
        this._panel.webview.postMessage({
          command: 'updateImages',
          images: this._task.images,
          resolvedImages: this._resolveImageUris(this._task.images)
        });
        vscode.commands.executeCommand('odoo-notepad.refreshTasks');
      } catch (e) {
        vscode.window.showErrorMessage('Failed to upload image: ' + e);
      }
    }
  }

  private async _handleDeleteImage(imgPath: string) {
    try {
      this._task.images = this._task.images.filter(img => img !== imgPath);
      
      // Delete the actual physical file
      const baseDir = StorageService.getBaseDir();
      const fullPath = path.isAbsolute(imgPath) ? imgPath : path.join(baseDir, imgPath);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
      }

      this._task.updatedDate = new Date().toISOString();
      await StorageService.saveTask(this._task);

      this._panel.webview.postMessage({
        command: 'updateImages',
        images: this._task.images,
        resolvedImages: this._resolveImageUris(this._task.images)
      });
      vscode.commands.executeCommand('odoo-notepad.refreshTasks');
    } catch (e) {
      vscode.window.showErrorMessage('Failed to delete image: ' + e);
    }
  }

  private _resolveImageUris(images: string[]): string[] {
    const baseDir = StorageService.getBaseDir();
    return (images || []).map(imgRelPath => {
      const fullImgPath = path.isAbsolute(imgRelPath) ? imgRelPath : path.join(baseDir, imgRelPath);
      return this._panel.webview.asWebviewUri(vscode.Uri.file(fullImgPath)).toString();
    });
  }

  private async _handleDownloadImage(imgPath: string) {
    try {
      const baseDir = StorageService.getBaseDir();
      const sourcePath = path.isAbsolute(imgPath) ? imgPath : path.join(baseDir, imgPath);
      
      if (!fs.existsSync(sourcePath)) {
        vscode.window.showErrorMessage('Image file not found on disk.');
        return;
      }

      const filename = path.basename(imgPath);
      const saveUri = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(os.homedir(), 'Downloads', filename)),
        saveLabel: 'Save Image',
        filters: {
          'Images': [path.extname(filename).substring(1) || 'png']
        }
      });

      if (saveUri) {
        await fs.promises.copyFile(sourcePath, saveUri.fsPath);
        vscode.window.showInformationMessage('Image successfully saved to: ' + saveUri.fsPath);
      }
    } catch (e) {
      vscode.window.showErrorMessage('Failed to save image: ' + e);
    }
  }

  private async _handleDeleteSnippet(snippetId: string) {
    try {
      this._task.snippets = this._task.snippets.filter(snip => snip.id !== snippetId);
      this._task.updatedDate = new Date().toISOString();
      await StorageService.saveTask(this._task);

      this._panel.webview.postMessage({ command: 'updateSnippets', snippets: this._task.snippets });
      vscode.commands.executeCommand('odoo-notepad.refreshTasks');
    } catch (e) {
      vscode.window.showErrorMessage('Failed to delete snippet: ' + e);
    }
  }

  private async _handleUpdateSnippet(snippetId: string, title: string, description: string) {
    try {
      this._task.snippets = this._task.snippets.map(snip => {
        if (snip.id === snippetId) {
          return { ...snip, title, description };
        }
        return snip;
      });
      this._task.updatedDate = new Date().toISOString();
      await StorageService.saveTask(this._task);
      vscode.commands.executeCommand('odoo-notepad.refreshTasks');
    } catch (e) {
      vscode.window.showErrorMessage('Failed to update snippet: ' + e);
    }
  }

  private async _handleJumpToCode(snippet: CodeSnippet) {
    let targetPath = snippet.file;

    // Resolve workspace path relative or absolute
    if (!path.isAbsolute(targetPath)) {
      if (snippet.workspace) {
        targetPath = path.join(snippet.workspace, snippet.file);
      } else {
        // Find if we have it in current workspaces
        const folders = vscode.workspace.workspaceFolders;
        if (folders && folders.length > 0) {
          targetPath = path.join(folders[0].uri.fsPath, snippet.file);
        }
      }
    }

    if (!fs.existsSync(targetPath)) {
      vscode.window.showErrorMessage("Source file no longer exists.");
      return;
    }

    try {
      const fileContent = fs.readFileSync(targetPath, 'utf8');
      const lines = fileContent.split(/\r?\n/);
      const snippetLinesCount = snippet.selectedCode.split(/\r?\n/).length;

      // --- 1. Exact Match ---
      const exactMatches: number[] = [];
      let exactIdx = fileContent.indexOf(snippet.selectedCode);
      while (exactIdx !== -1) {
        const lineNum = fileContent.substring(0, exactIdx).split(/\r?\n/).length;
        exactMatches.push(lineNum);
        exactIdx = fileContent.indexOf(snippet.selectedCode, exactIdx + 1);
      }

      if (exactMatches.length === 1) {
        await this._revealSnippet(targetPath, exactMatches[0], exactMatches[0] + snippetLinesCount - 1);
        return;
      } else if (exactMatches.length > 1) {
        await this._showQuickPickMatches(targetPath, exactMatches, lines, snippetLinesCount);
        return;
      }

      // --- 2. Trimmed Line Match ---
      const snippetLinesTrimmed = snippet.selectedCode.split(/\r?\n/).map((l: string) => l.trim());
      const fileLinesTrimmed = lines.map((l: string) => l.trim());
      const trimmedMatches: number[] = [];

      for (let i = 0; i <= fileLinesTrimmed.length - snippetLinesTrimmed.length; i++) {
        let match = true;
        for (let j = 0; j < snippetLinesTrimmed.length; j++) {
          if (fileLinesTrimmed[i + j] !== snippetLinesTrimmed[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          trimmedMatches.push(i + 1);
        }
      }

      if (trimmedMatches.length === 1) {
        vscode.window.showInformationMessage("Snippet moved. Jumped to the closest match.");
        await this._revealSnippet(targetPath, trimmedMatches[0], trimmedMatches[0] + snippetLinesCount - 1);
        return;
      } else if (trimmedMatches.length > 1) {
        await this._showQuickPickMatches(targetPath, trimmedMatches, lines, snippetLinesCount);
        return;
      }

      // --- 3. Whitespace-insensitive Match (ignoring empty lines) ---
      const snippetNorm = snippet.selectedCode.split(/\r?\n/).map((l: string) => l.replace(/\s+/g, ' ').trim()).filter((l: string) => l.length > 0);
      const fileNorm: { text: string; origLine: number }[] = [];
      for (let i = 0; i < lines.length; i++) {
        const norm = lines[i].replace(/\s+/g, ' ').trim();
        if (norm.length > 0) {
          fileNorm.push({ text: norm, origLine: i + 1 });
        }
      }

      const normMatches: number[] = [];
      if (snippetNorm.length > 0) {
        for (let i = 0; i <= fileNorm.length - snippetNorm.length; i++) {
          let match = true;
          for (let j = 0; j < snippetNorm.length; j++) {
            if (fileNorm[i + j].text !== snippetNorm[j]) {
              match = false;
              break;
            }
          }
          if (match) {
            normMatches.push(fileNorm[i].origLine);
          }
        }
      }

      if (normMatches.length === 1) {
        vscode.window.showInformationMessage("Snippet moved. Jumped to the closest match.");
        await this._revealSnippet(targetPath, normMatches[0], normMatches[0] + snippetLinesCount - 1);
        return;
      } else if (normMatches.length > 1) {
        await this._showQuickPickMatches(targetPath, normMatches, lines, snippetLinesCount);
        return;
      }

      // --- 4. Fuzzy Similarity Match ---
      // Requires at least 60% of the lines to match exactly in their normalized forms
      const threshold = Math.max(1, Math.floor(snippetNorm.length * 0.6));
      let bestScore = 0;
      let bestMatches: number[] = [];

      if (snippetNorm.length > 0) {
        for (let i = 0; i <= fileNorm.length - snippetNorm.length; i++) {
          let matchCount = 0;
          for (let j = 0; j < snippetNorm.length; j++) {
            if (fileNorm[i + j].text === snippetNorm[j]) {
              matchCount++;
            }
          }
          if (matchCount >= threshold) {
            if (matchCount > bestScore) {
              bestScore = matchCount;
              bestMatches = [fileNorm[i].origLine];
            } else if (matchCount === bestScore) {
              bestMatches.push(fileNorm[i].origLine);
            }
          }
        }
      }

      if (bestMatches.length === 1) {
        vscode.window.showInformationMessage("Snippet moved. Jumped to the closest match.");
        await this._revealSnippet(targetPath, bestMatches[0], bestMatches[0] + snippetLinesCount - 1);
        return;
      } else if (bestMatches.length > 1) {
        await this._showQuickPickMatches(targetPath, bestMatches, lines, snippetLinesCount);
        return;
      }

      // --- 5. Fallback ---
      if (snippet.startLine <= lines.length) {
        const choice = await vscode.window.showWarningMessage(
          "This code snippet no longer exists in the current file. Open original saved line?",
          "Yes",
          "No"
        );
        if (choice === "Yes") {
          await this._revealSnippet(targetPath, snippet.startLine, snippet.endLine);
        }
      } else {
        vscode.window.showErrorMessage("This code snippet no longer exists in the current file.");
      }

    } catch (e) {
      vscode.window.showErrorMessage('Failed to jump to file location: ' + e);
    }
  }

  private async _revealSnippet(targetPath: string, startLine: number, endLine: number) {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(targetPath));
    const editor = await vscode.window.showTextDocument(document);
    
    const startPos = new vscode.Position(Math.max(0, startLine - 1), 0);
    const endPos = new vscode.Position(Math.max(0, endLine - 1), 999);
    
    editor.selection = new vscode.Selection(startPos, endPos);
    editor.revealRange(new vscode.Range(startPos, endPos), vscode.TextEditorRevealType.InCenter);
  }

  private async _showQuickPickMatches(targetPath: string, matches: number[], lines: string[], snippetLinesCount: number) {
    const items = matches.map(lineNum => {
      const startIdx = Math.max(0, lineNum - 1);
      const endIdx = Math.min(lines.length, lineNum + 4);
      const preview = lines.slice(startIdx, endIdx).join(' \n');
      return {
        label: `Line ${lineNum}`,
        description: lines[startIdx].trim(),
        detail: preview,
        lineNum: lineNum
      };
    });

    const selection = await vscode.window.showQuickPick(items, {
      placeHolder: 'Multiple matches found. Select a line to jump to:'
    });

    if (selection) {
      await this._revealSnippet(targetPath, selection.lineNum, selection.lineNum + snippetLinesCount - 1);
    }
  }

  private async _handleToggleFavorite() {
    const isFav = await StorageService.toggleFavoriteTask(this._task.id);
    this._task.favorite = isFav;
    this._panel.webview.postMessage({ command: 'updateFavorite', favorite: isFav });
    vscode.commands.executeCommand('odoo-notepad.refreshTasks');
  }

  private async _handleDeleteTask() {
    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to permanently delete task "${this._task.title}" and its associated images?`,
      { modal: true },
      'Delete'
    );

    if (confirm === 'Delete') {
      await StorageService.deleteTask(this._task.id);
      vscode.commands.executeCommand('odoo-notepad.refreshTasks');
      this.dispose();
    }
  }

  private async _getHtmlForWebview(webview: vscode.Webview, autosaveInterval: number): Promise<string> {
    const mediaPath = path.join(this._extensionUri.fsPath, 'media');
    
    // Resource URIs
    const styleResetUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'reset.css')));
    const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'vscode.css')));
    const styleMainUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'editor.css')));
    const scriptMainUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'editor.js')));
    
    // Local offline library URIs
    const markedLibUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'libs', 'marked.min.js')));
    const prismLibUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'libs', 'prism.js')));
    const prismStyleUri = webview.asWebviewUri(vscode.Uri.file(path.join(mediaPath, 'libs', 'prism.css')));

    // Nonce for security policy
    const nonce = getNonce();

    // Load static templates
    const htmlTemplatePath = path.join(mediaPath, 'editor.html');
    let htmlContent = fs.readFileSync(htmlTemplatePath, 'utf8');

    // Resolve images src to webview URIs
    const resolvedTask = { ...this._task };
    resolvedTask.images = (this._task.images || []).map(imgRelPath => {
      const fullImgPath = path.isAbsolute(imgRelPath) ? imgRelPath : path.join(StorageService.getBaseDir(), imgRelPath);
      return webview.asWebviewUri(vscode.Uri.file(fullImgPath)).toString();
    });

    console.log("Initializing webview HTML for task ID:", this._task.id);

    // Inject data and scripts using global regex to replace all occurrences
    htmlContent = htmlContent
      .replace(/\$\{styleResetUri\}/g, styleResetUri.toString())
      .replace(/\$\{styleVSCodeUri\}/g, styleVSCodeUri.toString())
      .replace(/\$\{styleMainUri\}/g, styleMainUri.toString())
      .replace(/\$\{prismStyleUri\}/g, prismStyleUri.toString())
      .replace(/\$\{markedLibUri\}/g, markedLibUri.toString())
      .replace(/\$\{prismLibUri\}/g, prismLibUri.toString())
      .replace(/\$\{scriptMainUri\}/g, scriptMainUri.toString())
      .replace(/\$\{nonce\}/g, nonce)
      .replace(/\$\{cspSource\}/g, webview.cspSource)
      .replace(/\$\{taskJSON\}/g, JSON.stringify(this._task).replace(/</g, '\\u003c'))
      .replace(/\$\{taskResolvedJSON\}/g, JSON.stringify(resolvedTask).replace(/</g, '\\u003c'))
      .replace(/\$\{autosaveInterval\}/g, String(autosaveInterval));

    return htmlContent;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
