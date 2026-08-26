import * as vscode from 'vscode';
import { StorageService } from '../services/storage';

export class GitHubTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description?: string,
    public readonly iconName?: string,
    public readonly commandId?: string,
    public readonly commandArgs?: any[]
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    
    this.description = description;
    this.contextValue = 'githubItem';

    if (iconName) {
      this.iconPath = new vscode.ThemeIcon(iconName);
    }

    if (commandId) {
      this.command = {
        command: commandId,
        title: label,
        arguments: commandArgs
      };
    }
  }
}

export class GitHubTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (element) {
      return [];
    }

    const config = await StorageService.getGitHubConfig();

    if (!config.connected || !config.repository) {
      return [
        new GitHubTreeItem('Not connected', 'Click below to connect', 'plug'),
        new GitHubTreeItem('Connect GitHub', '', 'account', 'odoo-notepad.connectGithub')
      ];
    }

    const repoName = `${config.repository.owner}/${config.repository.name}`;
    const lastSync = config.lastSyncedAt
      ? new Date(config.lastSyncedAt).toLocaleString()
      : 'Never';

    return [
      new GitHubTreeItem('Connected Account', config.account?.username || 'Authenticated', 'check'),
      new GitHubTreeItem('Repository', repoName, 'repo', 'odoo-notepad.openGithubRepo'),
      new GitHubTreeItem('Last Sync', lastSync, 'history'),
      new GitHubTreeItem('Sync All Tasks', '', 'sync', 'odoo-notepad.syncAll'),
      new GitHubTreeItem('Pull All Tasks', '', 'cloud-download', 'odoo-notepad.pullAll'),
      new GitHubTreeItem('Push All Tasks', '', 'cloud-upload', 'odoo-notepad.pushAll'),
      new GitHubTreeItem('Open Repository', '', 'link-external', 'odoo-notepad.openGithubRepo'),
      new GitHubTreeItem('Disconnect GitHub', '', 'sign-out', 'odoo-notepad.disconnectGithub')
    ];
  }
}
