import * as vscode from 'vscode';
import { StorageService } from '../services/storage';
import { Task, CodeSnippet } from '../types';

export class FavoriteTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: 'category' | 'task' | 'snippet',
    public readonly idValue?: string, // taskId or snippetId
    public readonly extraData?: { taskId?: string; file?: string; startLine?: number }
  ) {
    super(label, collapsibleState);

    if (type === 'task') {
      this.contextValue = 'favoriteTaskItem';
      this.iconPath = new vscode.ThemeIcon('star-full', new vscode.ThemeColor('charts.yellow'));
      this.command = {
        command: 'odoo-notepad.openTask',
        title: 'Open Task',
        arguments: [this.idValue]
      };
    } else if (type === 'snippet') {
      this.contextValue = 'favoriteSnippetItem';
      this.iconPath = new vscode.ThemeIcon('code', new vscode.ThemeColor('charts.blue'));
      this.description = extraData?.file ? `${vscode.workspace.asRelativePath(extraData.file)}:${extraData.startLine}` : '';
      this.command = {
        command: 'odoo-notepad.jumpToSnippet',
        title: 'Jump to Snippet',
        arguments: [this.extraData?.taskId, this.idValue]
      };
    } else {
      this.iconPath = label === 'Favorite Tasks' ? new vscode.ThemeIcon('star-empty') : new vscode.ThemeIcon('symbol-keyword');
    }
  }
}

export class FavoriteTreeProvider implements vscode.TreeDataProvider<FavoriteTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<FavoriteTreeItem | undefined | null | void> = new vscode.EventEmitter<FavoriteTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<FavoriteTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: FavoriteTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: FavoriteTreeItem): Promise<FavoriteTreeItem[]> {
    const workspaceData = await StorageService.getWorkspaceData();

    if (!element) {
      // Root categories
      return [
        new FavoriteTreeItem('Favorite Tasks', vscode.TreeItemCollapsibleState.Expanded, 'category'),
        new FavoriteTreeItem('Favorite Snippets', vscode.TreeItemCollapsibleState.Expanded, 'category')
      ];
    }

    if (element.type === 'category') {
      if (element.label === 'Favorite Tasks') {
        const tasks = await StorageService.getTaskMetadataList();
        const favTasks = tasks.filter(t => workspaceData.favoriteTasks.includes(t.id));
        
        return favTasks.map(t => 
          new FavoriteTreeItem(t.title, vscode.TreeItemCollapsibleState.None, 'task', t.id)
        );
      } else {
        // Find snippets
        const favSnippets: FavoriteTreeItem[] = [];
        const taskMetadataList = await StorageService.getTaskMetadataList();
        
        for (const meta of taskMetadataList) {
          const task = await StorageService.getTask(meta.id);
          if (task && task.snippets) {
            for (const snip of task.snippets) {
              if (workspaceData.favoriteSnippets.includes(snip.id)) {
                favSnippets.push(
                  new FavoriteTreeItem(
                    snip.title || 'Untitled Snippet',
                    vscode.TreeItemCollapsibleState.None,
                    'snippet',
                    snip.id,
                    { taskId: task.id, file: snip.file, startLine: snip.startLine }
                  )
                );
              }
            }
          }
        }
        return favSnippets;
      }
    }

    return [];
  }
}
