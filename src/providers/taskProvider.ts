import * as vscode from 'vscode';
import { StorageService } from '../services/storage';
import { Task, TaskStatus } from '../types';

export class TaskTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: 'category' | 'task',
    public readonly status?: TaskStatus,
    public readonly taskId?: string
  ) {
    super(label, collapsibleState);
    
    this.contextValue = type === 'task' ? 'taskItem' : 'categoryItem';

    if (type === 'task') {
      this.command = {
        command: 'odoo-notepad.openTask',
        title: 'Open Task',
        arguments: [this.taskId]
      };
      
      // Select icon based on status
      switch (status) {
        case 'Todo':
          this.iconPath = new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('charts.blue'));
          break;
        case 'In Progress':
          this.iconPath = new vscode.ThemeIcon('play', new vscode.ThemeColor('charts.orange'));
          break;
        case 'Completed':
          this.iconPath = new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('charts.green'));
          break;
        case 'Archived':
          this.iconPath = new vscode.ThemeIcon('archive', new vscode.ThemeColor('charts.gray'));
          break;
      }
    } else {
      // Category folder icons
      switch (label) {
        case 'Todo':
          this.iconPath = new vscode.ThemeIcon('list-unordered');
          break;
        case 'In Progress':
          this.iconPath = new vscode.ThemeIcon('gear~spin');
          break;
        case 'Completed':
          this.iconPath = new vscode.ThemeIcon('check-all');
          break;
        case 'Archived':
          this.iconPath = new vscode.ThemeIcon('archive');
          break;
      }
    }
  }
}

export class TaskTreeProvider implements vscode.TreeDataProvider<TaskTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<TaskTreeItem | undefined | null | void> = new vscode.EventEmitter<TaskTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<TaskTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor() {}

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TaskTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TaskTreeItem): Promise<TaskTreeItem[]> {
    if (!element) {
      // Return root categories
      return [
        new TaskTreeItem('Todo', vscode.TreeItemCollapsibleState.Expanded, 'category'),
        new TaskTreeItem('In Progress', vscode.TreeItemCollapsibleState.Expanded, 'category'),
        new TaskTreeItem('Completed', vscode.TreeItemCollapsibleState.Collapsed, 'category'),
        new TaskTreeItem('Archived', vscode.TreeItemCollapsibleState.Collapsed, 'category')
      ];
    }

    if (element.type === 'category') {
      const status = element.label as TaskStatus;
      const tasks = await StorageService.getTaskMetadataList();
      const filteredTasks = tasks.filter(t => t.status === status);

      return filteredTasks.map(t => 
        new TaskTreeItem(
          t.title, 
          vscode.TreeItemCollapsibleState.None, 
          'task', 
          status, 
          t.id
        )
      );
    }

    return [];
  }
}
