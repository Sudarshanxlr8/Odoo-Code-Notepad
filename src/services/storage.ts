import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Task, Settings, WorkspaceData, TaskStatus } from '../types';

export class StorageService {
  private static baseDir = path.join(os.homedir(), '.odoo-code-notepad');

  // Paths
  private static tasksDir = '';
  private static imagesDir = '';
  private static exportsDir = '';
  private static backupsDir = '';
  private static settingsFile = '';
  private static workspaceFile = '';

  // In-memory cache for the active task and settings
  private static settingsCache: Settings | null = null;

  /**
   * Initializes the storage directory structure and default files if they don't exist.
   */
  public static async initialize(): Promise<void> {
    // 1. Load settings first if available to check for custom storageFolder
    let storageFolder = this.baseDir;
    const defaultSettingsFile = path.join(this.baseDir, 'settings.json');
    
    try {
      if (fs.existsSync(defaultSettingsFile)) {
        const settingsRaw = fs.readFileSync(defaultSettingsFile, 'utf8');
        const settings = JSON.parse(settingsRaw) as Settings;
        if (settings && settings.storageFolder) {
          storageFolder = settings.storageFolder;
        }
      }
    } catch (e) {
      console.error('Error pre-reading settings, using default storage folder:', e);
    }

    this.baseDir = storageFolder;
    this.tasksDir = path.join(this.baseDir, 'tasks');
    this.imagesDir = path.join(this.baseDir, 'images');
    this.exportsDir = path.join(this.baseDir, 'exports');
    this.backupsDir = path.join(this.baseDir, 'backups');
    this.settingsFile = path.join(this.baseDir, 'settings.json');
    this.workspaceFile = path.join(this.baseDir, 'workspace.json');

    // Create directories
    await fs.promises.mkdir(this.baseDir, { recursive: true });
    await fs.promises.mkdir(this.tasksDir, { recursive: true });
    await fs.promises.mkdir(this.imagesDir, { recursive: true });
    await fs.promises.mkdir(this.exportsDir, { recursive: true });
    await fs.promises.mkdir(this.backupsDir, { recursive: true });

    // Initialize Settings File
    if (!fs.existsSync(this.settingsFile)) {
      const defaultSettings: Settings = {
        theme: 'system',
        autosaveInterval: 5000, // 5 seconds
        defaultExportFolder: this.exportsDir,
        maxRecentTasks: 10,
        storageFolder: this.baseDir
      };
      await fs.promises.writeFile(this.settingsFile, JSON.stringify(defaultSettings, null, 2), 'utf8');
      this.settingsCache = defaultSettings;
    }

    // Initialize Workspace metadata
    if (!fs.existsSync(this.workspaceFile)) {
      const defaultWorkspace: WorkspaceData = {
        recentTasks: [],
        favoriteTasks: [],
        favoriteSnippets: []
      };
      await fs.promises.writeFile(this.workspaceFile, JSON.stringify(defaultWorkspace, null, 2), 'utf8');
    }
  }

  /**
   * Reload storage paths if storageFolder setting has changed.
   */
  public static async updateStorageFolder(newPath: string): Promise<void> {
    this.baseDir = newPath;
    await this.initialize();
  }

  public static getBaseDir(): string {
    return this.baseDir;
  }

  public static getImagesDir(): string {
    return this.imagesDir;
  }

  public static getExportsDir(): string {
    return this.exportsDir;
  }

  public static getBackupsDir(): string {
    return this.backupsDir;
  }

  // --- Settings Management ---

  public static async getSettings(): Promise<Settings> {
    if (this.settingsCache) {
      return this.settingsCache;
    }
    try {
      const data = await fs.promises.readFile(this.settingsFile, 'utf8');
      this.settingsCache = JSON.parse(data) as Settings;
      return this.settingsCache;
    } catch {
      const defaultSettings: Settings = {
        theme: 'system',
        autosaveInterval: 5000,
        defaultExportFolder: this.exportsDir,
        maxRecentTasks: 10,
        storageFolder: this.baseDir
      };
      this.settingsCache = defaultSettings;
      return defaultSettings;
    }
  }

  public static async saveSettings(settings: Settings): Promise<void> {
    this.settingsCache = settings;
    await fs.promises.writeFile(this.settingsFile, JSON.stringify(settings, null, 2), 'utf8');
  }

  // --- Workspace Data Management ---

  public static async getWorkspaceData(): Promise<WorkspaceData> {
    try {
      const data = await fs.promises.readFile(this.workspaceFile, 'utf8');
      return JSON.parse(data) as WorkspaceData;
    } catch {
      return {
        recentTasks: [],
        favoriteTasks: [],
        favoriteSnippets: []
      };
    }
  }

  public static async saveWorkspaceData(data: WorkspaceData): Promise<void> {
    await fs.promises.writeFile(this.workspaceFile, JSON.stringify(data, null, 2), 'utf8');
  }

  // --- Task Management (Lazy Loading) ---

  private static normalizeTask(task: any): Task {
    if (!task) { return task; }
    
    // Normalize repository structure
    if (task.repository) {
      const oldRepo = task.repository;
      if ('name' in oldRepo || 'commit' in oldRepo || 'remote' in oldRepo) {
        const name = oldRepo.name || '';
        const branch = oldRepo.branch || task.branch || '';
        const commit = oldRepo.commit || '';
        const remote = oldRepo.remote || '';

        let commitUrl = '';
        if (commit) {
          if (remote && remote.includes('http')) {
            const cleanRemote = remote.trim().replace(/\.git$/, '');
            commitUrl = `${cleanRemote}/commit/${commit}`;
          } else {
            commitUrl = commit;
          }
        }

        task.repository = {
          repositoryName: name,
          branch: branch,
          commitUrl: commitUrl,
          runbotUrl: ''
        };
      } else {
        task.repository.repositoryName = task.repository.repositoryName || '';
        task.repository.branch = task.repository.branch || '';
        task.repository.commitUrl = task.repository.commitUrl || '';
        task.repository.runbotUrl = task.repository.runbotUrl || '';
      }
    } else {
      task.repository = {
        repositoryName: '',
        branch: '',
        commitUrl: '',
        runbotUrl: ''
      };
    }

    task.branch = task.repository.branch || task.branch || '';
    task.tags = task.tags || [];
    task.images = task.images || [];
    task.snippets = task.snippets || [];
    task.description = task.description || '';
    task.notes = task.notes || '';

    return task as Task;
  }

  /**
   * Reads only files list and basic metadata fields for display without keeping all in memory.
   */
  public static async getTaskMetadataList(): Promise<Array<Omit<Task, 'description' | 'notes' | 'snippets'>>> {
    const files = await fs.promises.readdir(this.tasksDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    const metadataList: Array<Omit<Task, 'description' | 'notes' | 'snippets'>> = [];

    const workspaceData = await this.getWorkspaceData();

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(this.tasksDir, file);
        const dataRaw = await fs.promises.readFile(filePath, 'utf8');
        const taskRaw = JSON.parse(dataRaw);
        const task = this.normalizeTask(taskRaw);
        
        // Exclude large elements from metadata list
        const { description, notes, snippets, ...meta } = task;
        // Inject favorite status from workspace data
        meta.favorite = workspaceData.favoriteTasks.includes(meta.id);
        metadataList.push(meta);
      } catch (err) {
        console.error(`Error loading metadata for file ${file}:`, err);
      }
    }

    // Sort by updatedDate descending by default
    return metadataList.sort((a, b) => new Date(b.updatedDate).getTime() - new Date(a.updatedDate).getTime());
  }

  public static async getTask(id: string): Promise<Task | null> {
    const filePath = path.join(this.tasksDir, `${id}.json`);
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      const dataRaw = await fs.promises.readFile(filePath, 'utf8');
      const taskRaw = JSON.parse(dataRaw);
      const task = this.normalizeTask(taskRaw);
      
      const workspaceData = await this.getWorkspaceData();
      task.favorite = workspaceData.favoriteTasks.includes(task.id);

      // Add to recent tasks list
      await this.addToRecent(id);

      return task;
    } catch (err) {
      console.error(`Error reading task ${id}:`, err);
      return null;
    }
  }

  public static async saveTask(task: Task): Promise<void> {
    const filePath = path.join(this.tasksDir, `${task.id}.json`);
    task.updatedDate = new Date().toISOString();
    
    // Save task file (excludes the transient favorite key if you want, but storing it is fine)
    await fs.promises.writeFile(filePath, JSON.stringify(task, null, 2), 'utf8');
  }

  public static async deleteTask(id: string): Promise<void> {
    const task = await this.getTask(id);
    if (!task) {
      return;
    }

    // 1. Delete the task JSON file
    const filePath = path.join(this.tasksDir, `${id}.json`);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }

    // 2. Cleanup associated images
    for (const imgPath of task.images) {
      const fullImgPath = path.isAbsolute(imgPath) ? imgPath : path.join(this.baseDir, imgPath);
      try {
        if (fs.existsSync(fullImgPath)) {
          await fs.promises.unlink(fullImgPath);
        }
      } catch (e) {
        console.error(`Error deleting image ${imgPath}:`, e);
      }
    }

    // 3. Remove from recent/favorites
    const workspaceData = await this.getWorkspaceData();
    workspaceData.recentTasks = workspaceData.recentTasks.filter(tid => tid !== id);
    workspaceData.favoriteTasks = workspaceData.favoriteTasks.filter(tid => tid !== id);
    
    // Remove snippets from favorite snippets
    const snippetIds = task.snippets.map(s => s.id);
    workspaceData.favoriteSnippets = workspaceData.favoriteSnippets.filter(sid => !snippetIds.includes(sid));

    await this.saveWorkspaceData(workspaceData);
  }

  // --- Favorite and Recent Helpers ---

  public static async toggleFavoriteTask(id: string): Promise<boolean> {
    const workspaceData = await this.getWorkspaceData();
    const index = workspaceData.favoriteTasks.indexOf(id);
    let isFav = false;
    
    if (index === -1) {
      workspaceData.favoriteTasks.push(id);
      isFav = true;
    } else {
      workspaceData.favoriteTasks.splice(index, 1);
    }

    await this.saveWorkspaceData(workspaceData);
    return isFav;
  }

  public static async toggleFavoriteSnippet(snippetId: string): Promise<boolean> {
    const workspaceData = await this.getWorkspaceData();
    const index = workspaceData.favoriteSnippets.indexOf(snippetId);
    let isFav = false;

    if (index === -1) {
      workspaceData.favoriteSnippets.push(snippetId);
      isFav = true;
    } else {
      workspaceData.favoriteSnippets.splice(index, 1);
    }

    await this.saveWorkspaceData(workspaceData);
    return isFav;
  }

  private static async addToRecent(id: string): Promise<void> {
    const settings = await this.getSettings();
    const workspaceData = await this.getWorkspaceData();
    
    // Remove if already in list, then add to front
    workspaceData.recentTasks = workspaceData.recentTasks.filter(tid => tid !== id);
    workspaceData.recentTasks.unshift(id);

    // Limit to maxRecentTasks
    if (workspaceData.recentTasks.length > settings.maxRecentTasks) {
      workspaceData.recentTasks = workspaceData.recentTasks.slice(0, settings.maxRecentTasks);
    }

    await this.saveWorkspaceData(workspaceData);
  }

  // --- Image Storage Management ---

  /**
   * Saves an image from base64 string buffer to the local images directory and returns relative path.
   */
  public static async saveImage(base64Data: string, mimeType: string): Promise<string> {
    const extension = mimeType.split('/')[1] || 'png';
    const filename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${extension}`;
    const targetPath = path.join(this.imagesDir, filename);

    // Strip header if present
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');
    
    await fs.promises.writeFile(targetPath, buffer);
    
    // Return relative path from base storage folder
    return path.join('images', filename);
  }

  /**
   * Saves an image from a local file path (drag and drop / browse).
   */
  public static async saveImageFromFile(sourcePath: string): Promise<string> {
    const extension = path.extname(sourcePath) || '.png';
    const filename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${extension}`;
    const targetPath = path.join(this.imagesDir, filename);

    await fs.promises.copyFile(sourcePath, targetPath);
    return path.join('images', filename);
  }
}
