import * as vscode from 'vscode';
import { StorageService } from './services/storage';
import { TaskTreeProvider } from './providers/taskProvider';
import { FavoriteTreeProvider } from './providers/favoriteProvider';
import { RecentTreeProvider } from './providers/recentProvider';
import { SearchTreeProvider } from './providers/searchProvider';
import { SettingsTreeProvider } from './providers/settingsProvider';
import { CommandManager } from './commands/commands';
import { TaskEditorPanel } from './views/taskEditor';

export async function activate(context: vscode.ExtensionContext) {
  console.log('Odoo Code Notepad activation started.');

  try {
    // 1. Initialize Storage Directory & Files
    await StorageService.initialize();

    // 2. Initialize Tree View Providers
    const taskProvider = new TaskTreeProvider();
    const favoriteProvider = new FavoriteTreeProvider();
    const recentProvider = new RecentTreeProvider();
    const searchProvider = new SearchTreeProvider();
    const settingsProvider = new SettingsTreeProvider();

    // 3. Register Sidebar Views
    vscode.window.registerTreeDataProvider('odoo-code-notepad-tasks', taskProvider);
    vscode.window.registerTreeDataProvider('odoo-code-notepad-favorites', favoriteProvider);
    vscode.window.registerTreeDataProvider('odoo-code-notepad-recent', recentProvider);
    vscode.window.registerTreeDataProvider('odoo-code-notepad-search', searchProvider);
    vscode.window.registerTreeDataProvider('odoo-code-notepad-settings', settingsProvider);

    // 4. Register All Commands
    const commandManager = new CommandManager(
      context,
      taskProvider,
      favoriteProvider,
      recentProvider,
      searchProvider,
      settingsProvider
    );
    commandManager.registerCommands();

    // 5. Webview Serializer (restoring Webviews on reload)
    if (vscode.window.registerWebviewPanelSerializer) {
      vscode.window.registerWebviewPanelSerializer(TaskEditorPanel.viewType, {
        async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
          if (state && state.id) {
            const task = await StorageService.getTask(state.id);
            if (task) {
              TaskEditorPanel.restore(webviewPanel, context.extensionUri, task);
            }
          }
        }
      });
    }

    console.log('Odoo Code Notepad activated successfully.');
  } catch (error) {
    vscode.window.showErrorMessage('Failed to activate Odoo Code Notepad: ' + error);
    console.error('Activation error:', error);
  }
}

export function deactivate() {
  console.log('Odoo Code Notepad deactivated.');
}
