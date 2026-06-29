import * as fs from 'fs';
import * as path from 'path';
import { Task } from '../types';
import { StorageService } from './storage';

export interface SearchResult {
  task: Task;
  matches: string[];
}

export class SearchService {
  /**
   * Performs a case-insensitive search across all saved tasks.
   * Reads files one by one to avoid high memory overhead (lazy loading).
   */
  public static async search(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    if (!query || query.trim() === '') {
      return results;
    }

    const cleanQuery = query.toLowerCase().trim();
    const baseDir = StorageService.getBaseDir();
    const tasksDir = path.join(baseDir, 'tasks');

    if (!fs.existsSync(tasksDir)) {
      return results;
    }

    try {
      const files = await fs.promises.readdir(tasksDir);
      const jsonFiles = files.filter(f => f.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(tasksDir, file);
          const dataRaw = await fs.promises.readFile(filePath, 'utf8');
          const task = JSON.parse(dataRaw) as Task;
          const matches: string[] = [];

          // 1. Search Task Title
          if (task.title && task.title.toLowerCase().includes(cleanQuery)) {
            matches.push(`Title: "${task.title}"`);
          }

          // 2. Search Task Description
          if (task.description && task.description.toLowerCase().includes(cleanQuery)) {
            matches.push(`Description: "${task.description.substring(0, 40)}..."`);
          }

          // 3. Search Markdown Notes
          if (task.notes && task.notes.toLowerCase().includes(cleanQuery)) {
            // Find context around the match
            const idx = task.notes.toLowerCase().indexOf(cleanQuery);
            const start = Math.max(0, idx - 20);
            const end = Math.min(task.notes.length, idx + cleanQuery.length + 20);
            matches.push(`Notes: "...${task.notes.substring(start, end)}..."`);
          }

          // 4. Search Tags
          const matchedTags = task.tags?.filter(t => t.toLowerCase().includes(cleanQuery));
          if (matchedTags && matchedTags.length > 0) {
            matches.push(`Tags: ${matchedTags.join(', ')}`);
          }

          // 5. Search Repository Names
          if (task.repository?.repositoryName && task.repository.repositoryName.toLowerCase().includes(cleanQuery)) {
            matches.push(`Repository: ${task.repository.repositoryName}`);
          }

          // 6. Search Snippets (Title, Description, and Code)
          if (task.snippets && task.snippets.length > 0) {
            for (const snip of task.snippets) {
              let snipMatch = false;
              const snipLocs: string[] = [];

              if (snip.title && snip.title.toLowerCase().includes(cleanQuery)) {
                snipMatch = true;
                snipLocs.push(`title`);
              }
              if (snip.description && snip.description.toLowerCase().includes(cleanQuery)) {
                snipMatch = true;
                snipLocs.push(`description`);
              }
              if (snip.selectedCode && snip.selectedCode.toLowerCase().includes(cleanQuery)) {
                snipMatch = true;
                snipLocs.push(`code`);
              }

              if (snipMatch) {
                matches.push(`Snippet "${snip.title}" (${snipLocs.join(', ')})`);
              }
            }
          }

          // If there are matches, add the task to search results
          if (matches.length > 0) {
            results.push({ task, matches });
          }

        } catch (err) {
          console.error(`Error searching task file ${file}:`, err);
        }
      }
    } catch (e) {
      console.error('Error listing tasks directory for search:', e);
    }

    return results;
  }
}
