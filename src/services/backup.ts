import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { StorageService } from './storage';
import { Task } from '../types';

export class BackupService {
  /**
   * Zips the entire storage folder and saves the backup.
   * Returns the path of the created zip.
   */
  public static async createBackup(outputPath?: string): Promise<string> {
    const zip = new AdmZip();
    const baseDir = StorageService.getBaseDir();

    const tasksDir = path.join(baseDir, 'tasks');
    const imagesDir = path.join(baseDir, 'images');
    const settingsFile = path.join(baseDir, 'settings.json');
    const workspaceFile = path.join(baseDir, 'workspace.json');

    // 1. Add tasks
    if (fs.existsSync(tasksDir) && (await fs.promises.readdir(tasksDir)).length > 0) {
      zip.addLocalFolder(tasksDir, 'tasks');
    }

    // 2. Add images
    if (fs.existsSync(imagesDir) && (await fs.promises.readdir(imagesDir)).length > 0) {
      zip.addLocalFolder(imagesDir, 'images');
    }

    // 3. Add Settings and Workspace metadata
    if (fs.existsSync(settingsFile)) {
      zip.addLocalFile(settingsFile, '');
    }
    if (fs.existsSync(workspaceFile)) {
      zip.addLocalFile(workspaceFile, '');
    }

    const timestamp = Date.now();
    const defaultName = `backup_${timestamp}.zip`;
    const finalPath = outputPath || path.join(StorageService.getBackupsDir(), defaultName);

    await new Promise<void>((resolve, reject) => {
      zip.writeZip(finalPath, (err: any) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    return finalPath;
  }

  /**
   * Restores data from a backup ZIP.
   * Mode:
   * - 'replace': deletes all current tasks and images first, then extracts everything.
   * - 'merge': keeps newer files based on updatedDate, does not delete anything.
   */
  public static async restoreBackup(zipPath: string, mode: 'replace' | 'merge'): Promise<{ restoredTasks: number; mergedTasks: number }> {
    if (!fs.existsSync(zipPath)) {
      throw new Error(`Backup file not found at ${zipPath}`);
    }

    const zip = new AdmZip(zipPath);
    const baseDir = StorageService.getBaseDir();
    const tasksDir = path.join(baseDir, 'tasks');
    const imagesDir = path.join(baseDir, 'images');

    let restoredTasks = 0;
    let mergedTasks = 0;

    if (mode === 'replace') {
      // 1. Wipe current tasks and images
      if (fs.existsSync(tasksDir)) {
        const files = await fs.promises.readdir(tasksDir);
        for (const file of files) {
          await fs.promises.unlink(path.join(tasksDir, file));
        }
      }
      if (fs.existsSync(imagesDir)) {
        const files = await fs.promises.readdir(imagesDir);
        for (const file of files) {
          await fs.promises.unlink(path.join(imagesDir, file));
        }
      }

      // 2. Extract all directly
      zip.extractAllTo(baseDir, true);
      
      // Count tasks extracted
      const extractedFiles = await fs.promises.readdir(tasksDir);
      restoredTasks = extractedFiles.filter(f => f.endsWith('.json')).length;

    } else {
      // Merge mode: process entry-by-entry
      const zipEntries = zip.getEntries();
      
      for (const entry of zipEntries) {
        const entryName = entry.entryName;
        
        if (entryName.startsWith('tasks/') && entryName.endsWith('.json')) {
          const taskContent = entry.getData().toString('utf8');
          
          try {
            const incomingTask = JSON.parse(taskContent) as Task;
            const targetTaskPath = path.join(baseDir, entryName);
            
            let shouldWrite = true;
            if (fs.existsSync(targetTaskPath)) {
              const currentContent = await fs.promises.readFile(targetTaskPath, 'utf8');
              const currentTask = JSON.parse(currentContent) as Task;
              
              const incomingDate = new Date(incomingTask.updatedDate || 0).getTime();
              const currentDate = new Date(currentTask.updatedDate || 0).getTime();
              
              if (incomingDate <= currentDate) {
                shouldWrite = false;
                mergedTasks++; // Skipped because current is newer or same
              }
            }

            if (shouldWrite) {
              await fs.promises.writeFile(targetTaskPath, taskContent, 'utf8');
              restoredTasks++;
            }
          } catch (e) {
            console.error(`Failed to merge task entry: ${entryName}`, e);
          }
          
        } else if (entryName.startsWith('images/') && !entry.isDirectory) {
          // Extract image only if it doesn't exist
          const targetImagePath = path.join(baseDir, entryName);
          if (!fs.existsSync(targetImagePath)) {
            const parentDir = path.dirname(targetImagePath);
            await fs.promises.mkdir(parentDir, { recursive: true });
            await fs.promises.writeFile(targetImagePath, entry.getData());
          }
        } else if (entryName === 'settings.json') {
          // For merge mode, we don't fully replace settings, or we do. Let's merge settings
          const targetPath = path.join(baseDir, entryName);
          if (fs.existsSync(targetPath)) {
            try {
              const incomingSettings = JSON.parse(entry.getData().toString('utf8'));
              const currentSettings = JSON.parse(await fs.promises.readFile(targetPath, 'utf8'));
              const mergedSettings = { ...incomingSettings, ...currentSettings };
              await fs.promises.writeFile(targetPath, JSON.stringify(mergedSettings, null, 2), 'utf8');
            } catch {
              // Fail-safe: write directly
              await fs.promises.writeFile(targetPath, entry.getData());
            }
          } else {
            await fs.promises.writeFile(targetPath, entry.getData());
          }
        } else if (entryName === 'workspace.json') {
          // Merge workspace metadata lists (favorites and recents)
          const targetPath = path.join(baseDir, entryName);
          if (fs.existsSync(targetPath)) {
            try {
              const incomingWorkspace = JSON.parse(entry.getData().toString('utf8'));
              const currentWorkspace = JSON.parse(await fs.promises.readFile(targetPath, 'utf8'));
              
              const mergedWorkspace = {
                recentTasks: Array.from(new Set([...currentWorkspace.recentTasks, ...incomingWorkspace.recentTasks])),
                favoriteTasks: Array.from(new Set([...currentWorkspace.favoriteTasks, ...incomingWorkspace.favoriteTasks])),
                favoriteSnippets: Array.from(new Set([...currentWorkspace.favoriteSnippets, ...incomingWorkspace.favoriteSnippets]))
              };
              
              await fs.promises.writeFile(targetPath, JSON.stringify(mergedWorkspace, null, 2), 'utf8');
            } catch {
              await fs.promises.writeFile(targetPath, entry.getData());
            }
          } else {
            await fs.promises.writeFile(targetPath, entry.getData());
          }
        }
      }
    }

    // Force storage re-initialization to refresh settings/caches
    await StorageService.initialize();

    return { restoredTasks, mergedTasks };
  }
}
