import * as vscode from 'vscode';
import { StorageService } from '../services/storage';

export class RecentTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly taskId: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'recentTaskItem';
    this.iconPath = new vscode.ThemeIcon('history');
    this.command = {
      command: 'odoo-notepad.openTask',
      title: 'Open Task',
      arguments: [this.taskId]
    };
  }
}

export class RecentTreeProvider implements vscode.TreeDataProvider<RecentTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<RecentTreeItem | undefined | null | void> = new vscode.EventEmitter<RecentTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<RecentTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: RecentTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: RecentTreeItem): Promise<RecentTreeItem[]> {
    if (element) {
      return [];
    }

    const workspaceData = await StorageService.getWorkspaceData();
    const tasks = await StorageService.getTaskMetadataList();
    
    // Filter and sort the tasks list according to recentTasks array order
    const recentItems: RecentTreeItem[] = [];
    for (const recentId of workspaceData.recentTasks) {
      const matched = tasks.find(t => t.id === recentId);
      if (matched) {
        recentItems.push(new RecentTreeItem(matched.title, matched.id));
      }
    }

    return recentItems;
  }
}
