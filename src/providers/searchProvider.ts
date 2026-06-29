import * as vscode from 'vscode';
import { SearchService, SearchResult } from '../services/search';

export class SearchTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly type: 'task' | 'match' | 'empty',
    public readonly taskId?: string,
    public readonly matchSnippet?: string
  ) {
    super(label, collapsibleState);
    this.contextValue = type === 'task' ? 'searchTaskItem' : 'searchMatchItem';

    if (type === 'task' && taskId) {
      this.iconPath = new vscode.ThemeIcon('notebook');
      this.command = {
        command: 'odoo-notepad.openTask',
        title: 'Open Task',
        arguments: [taskId]
      };
    } else if (type === 'match') {
      this.iconPath = new vscode.ThemeIcon('search-stop');
      this.tooltip = matchSnippet;
      if (taskId) {
        this.command = {
          command: 'odoo-notepad.openTask',
          title: 'Open Task',
          arguments: [taskId]
        };
      }
    } else if (type === 'empty') {
      this.iconPath = new vscode.ThemeIcon('info');
    }
  }
}

export class SearchTreeProvider implements vscode.TreeDataProvider<SearchTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<SearchTreeItem | undefined | null | void> = new vscode.EventEmitter<SearchTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<SearchTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private currentQuery: string = '';
  private searchResults: SearchResult[] = [];

  public async setQuery(query: string): Promise<void> {
    this.currentQuery = query;
    if (query && query.trim() !== '') {
      this.searchResults = await SearchService.search(query);
    } else {
      this.searchResults = [];
    }
    this._onDidChangeTreeData.fire();
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SearchTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: SearchTreeItem): Promise<SearchTreeItem[]> {
    if (!this.currentQuery || this.currentQuery.trim() === '') {
      return [new SearchTreeItem('Enter query to search notes', vscode.TreeItemCollapsibleState.None, 'empty')];
    }

    if (!element) {
      if (this.searchResults.length === 0) {
        return [new SearchTreeItem('No matches found', vscode.TreeItemCollapsibleState.None, 'empty')];
      }
      // Return matching tasks
      return this.searchResults.map(res => 
        new SearchTreeItem(
          res.task.title, 
          vscode.TreeItemCollapsibleState.Expanded, 
          'task', 
          res.task.id
        )
      );
    }

    if (element.type === 'task' && element.taskId) {
      const matchObj = this.searchResults.find(res => res.task.id === element.taskId);
      if (matchObj) {
        return matchObj.matches.map(m => 
          new SearchTreeItem(
            m, 
            vscode.TreeItemCollapsibleState.None, 
            'match', 
            element.taskId, 
            m
          )
        );
      }
    }

    return [];
  }
}
