export type TaskStatus = 'Todo' | 'In Progress' | 'Completed' | 'Archived';

export interface RepositoryInfo {
  repositoryName: string;
  branch: string;
  commitUrl: string;
  runbotUrl: string;
}

export interface CodeSnippet {
  id: string;
  title: string;
  description: string;
  file: string;
  workspace: string;
  language: string;
  repository: string;
  branch: string;
  commit: string;
  startLine: number;
  endLine: number;
  selectedCode: string;
  createdDate: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  repository: RepositoryInfo;
  branch: string;
  workspace: string;
  createdDate: string;
  updatedDate: string;
  tags: string[];
  notes: string;
  images: string[]; // Store relative paths to image files, e.g., 'images/abc.png'
  snippets: CodeSnippet[];
  favorite?: boolean;
}

export interface Settings {
  theme: 'light' | 'dark' | 'system';
  autosaveInterval: number; // in milliseconds
  defaultExportFolder: string;
  maxRecentTasks: number;
  storageFolder: string;
}

export interface WorkspaceData {
  recentTasks: string[]; // Task IDs
  favoriteTasks: string[]; // Task IDs
  favoriteSnippets: string[]; // Snippet IDs
}
