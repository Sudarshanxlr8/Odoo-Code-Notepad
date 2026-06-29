import * as vscode from 'vscode';
import { StorageService } from '../services/storage';

export class SettingTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly description: string,
    public readonly key: string,
    public readonly icon: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'settingItem';
    this.iconPath = new vscode.ThemeIcon(icon);
    
    // Command is registered to change the setting
    this.command = {
      command: 'odoo-notepad.changeSetting',
      title: 'Change Setting',
      arguments: [key]
    };
  }
}

export class SettingsTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
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

    const settings = await StorageService.getSettings();

    // Setup editable settings items
    const items: vscode.TreeItem[] = [
      new SettingTreeItem('Theme', settings.theme, 'theme', 'color-mode'),
      new SettingTreeItem('Autosave Interval', `${settings.autosaveInterval / 1000}s`, 'autosaveInterval', 'watch'),
      new SettingTreeItem('Max Recent Tasks', `${settings.maxRecentTasks}`, 'maxRecentTasks', 'list-ordered'),
      new SettingTreeItem('Storage Path', settings.storageFolder, 'storageFolder', 'folder'),
      new SettingTreeItem('Default Export Path', settings.defaultExportFolder, 'defaultExportFolder', 'export')
    ];

    // Add Action Buttons
    const backupItem = new vscode.TreeItem('Export Backup (ZIP)', vscode.TreeItemCollapsibleState.None);
    backupItem.iconPath = new vscode.ThemeIcon('cloud-download');
    backupItem.command = {
      command: 'odoo-notepad.backup',
      title: 'Backup Data'
    };

    const restoreItem = new vscode.TreeItem('Restore Backup', vscode.TreeItemCollapsibleState.None);
    restoreItem.iconPath = new vscode.ThemeIcon('cloud-upload');
    restoreItem.command = {
      command: 'odoo-notepad.restore',
      title: 'Restore Data'
    };

    return [...items, backupItem, restoreItem];
  }
}
