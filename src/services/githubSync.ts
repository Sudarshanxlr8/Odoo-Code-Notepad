import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Task, TaskStatus, CodeSnippet, SyncState, GitHubSyncMetadata } from '../types';
import { StorageService } from './storage';
import { GitHubAuthService } from './githubAuth';
import { GitHubService, TreeItem } from './github';

export class GitHubSyncService {
  
  /**
   * Converts string to filesystem and GitHub safe slug.
   */
  public static slugify(text: string): string {
    if (!text || text.trim() === '') {
      return 'untitled-task';
    }
    let slug = text.toLowerCase()
      .trim()
      .replace(/\[.*?\]/g, '') // remove tags like [Peppol]
      .replace(/[^a-z0-9\s-]/g, '') // remove non-alphanumeric except spaces and dashes
      .replace(/[\s_]+/g, '-') // replace spaces/underscores with single dash
      .replace(/-+/g, '-') // collapse consecutive dashes
      .replace(/^-+|-+$/g, ''); // trim leading/trailing dashes

    if (!slug) {
      slug = 'task';
    }
    return slug;
  }

  /**
   * Maps TaskStatus enum to remote repository folder name.
   */
  public static getStatusFolder(status: TaskStatus): string {
    switch (status) {
      case 'Todo': return 'todo';
      case 'In Progress': return 'in-progress';
      case 'Completed': return 'completed';
      case 'Archived': return 'archived';
      default: return 'todo';
    }
  }

  /**
   * Generates task.md content from a Task object.
   */
  public static taskToMarkdown(task: Task): string {
    const lines: string[] = [];
    lines.push(`# ${task.title}`);
    lines.push('');
    lines.push(`## Status`);
    lines.push(`${task.status}`);
    lines.push('');
    lines.push(`## Repository`);
    lines.push(`${task.repository?.repositoryName || ''}`);
    lines.push('');
    lines.push(`## Branch`);
    lines.push(`${task.repository?.branch || task.branch || ''}`);
    lines.push('');
    lines.push(`## Commit URL`);
    lines.push(`${task.repository?.commitUrl || ''}`);
    lines.push('');
    lines.push(`## Runbot URL`);
    lines.push(`${task.repository?.runbotUrl || ''}`);
    lines.push('');
    if (task.description) {
      lines.push(`## Description`);
      lines.push(`${task.description}`);
      lines.push('');
    }
    lines.push(`## Notes`);
    lines.push(`${task.notes || ''}`);
    lines.push('');

    if (task.images && task.images.length > 0) {
      lines.push(`## Images`);
      task.images.forEach(img => {
        const filename = path.basename(img);
        lines.push(`![${filename}](images/${filename})`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Generates metadata.json content for a Task object.
   */
  public static taskToMetadataJson(task: Task, remotePath: string): string {
    const meta = {
      formatVersion: 1,
      taskId: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      createdDate: task.createdDate,
      updatedDate: task.updatedDate,
      tags: task.tags || [],
      repository: task.repository,
      branch: task.branch,
      workspace: task.workspace,
      remotePath: remotePath,
      images: (task.images || []).map(img => path.basename(img)),
      snippets: (task.snippets || []).map(s => s.id)
    };
    return JSON.stringify(meta, null, 2);
  }

  /**
   * Generates snippet markdown content.
   */
  public static snippetToMarkdown(snippet: CodeSnippet): string {
    const lines: string[] = [];
    lines.push(`# ${snippet.title}`);
    lines.push('');
    if (snippet.description) {
      lines.push(`Description: ${snippet.description}`);
      lines.push('');
    }
    lines.push(`File: ${snippet.file}`);
    lines.push(`Workspace: ${snippet.workspace || ''}`);
    lines.push(`Language: ${snippet.language}`);
    lines.push(`Repository: ${snippet.repository}`);
    lines.push(`Branch: ${snippet.branch}`);
    lines.push(`Commit: ${snippet.commit}`);
    lines.push(`Lines: ${snippet.startLine}-${snippet.endLine}`);
    lines.push(`Created: ${snippet.createdDate}`);
    lines.push('');
    lines.push(`\`\`\`${snippet.language || ''}`);
    lines.push(snippet.selectedCode);
    lines.push(`\`\`\``);
    lines.push('');
    return lines.join('\n');
  }

  /**
   * Computes a deterministic SHA-256 hash of the synchronized task contents.
   */
  public static async computeTaskHash(task: Task): Promise<string> {
    const hash = crypto.createHash('sha256');
    hash.update(task.title);
    hash.update(task.status);
    hash.update(task.description || '');
    hash.update(task.notes || '');
    hash.update((task.tags || []).join(','));
    hash.update(JSON.stringify(task.repository || {}));

    // Snippets
    for (const snip of task.snippets || []) {
      hash.update(snip.id + snip.title + snip.selectedCode + snip.startLine + snip.endLine + snip.file);
    }

    // Images content hashes
    const baseDir = StorageService.getBaseDir();
    for (const imgPath of task.images || []) {
      const fullImgPath = path.isAbsolute(imgPath) ? imgPath : path.join(baseDir, imgPath);
      if (fs.existsSync(fullImgPath)) {
        try {
          const buffer = await fs.promises.readFile(fullImgPath);
          hash.update(buffer);
        } catch {}
      }
    }

    return hash.digest('hex');
  }

  /**
   * Generates index.md content based on all tasks in the repository.
   */
  public static generateIndexMd(allTasks: Array<{ title: string; remotePath: string; status: TaskStatus }>): string {
    const todoTasks = allTasks.filter(t => t.status === 'Todo');
    const inProgressTasks = allTasks.filter(t => t.status === 'In Progress');
    const completedTasks = allTasks.filter(t => t.status === 'Completed');
    const archivedTasks = allTasks.filter(t => t.status === 'Archived');

    const lines: string[] = [];
    lines.push('# Odoo Code Notepad');
    lines.push('');
    lines.push('Automated Knowledge Base & Task Notes Index');
    lines.push('');

    lines.push('## Todo');
    if (todoTasks.length === 0) { lines.push('*No tasks*'); }
    else { todoTasks.forEach(t => lines.push(`* [${t.title}](${t.remotePath}/task.md)`)); }
    lines.push('');

    lines.push('## In Progress');
    if (inProgressTasks.length === 0) { lines.push('*No tasks*'); }
    else { inProgressTasks.forEach(t => lines.push(`* [${t.title}](${t.remotePath}/task.md)`)); }
    lines.push('');

    lines.push('## Completed');
    if (completedTasks.length === 0) { lines.push('*No tasks*'); }
    else { completedTasks.forEach(t => lines.push(`* [${t.title}](${t.remotePath}/task.md)`)); }
    lines.push('');

    lines.push('## Archived');
    if (archivedTasks.length === 0) { lines.push('*No tasks*'); }
    else { archivedTasks.forEach(t => lines.push(`* [${t.title}](${t.remotePath}/task.md)`)); }
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generates README.md content for new notes repositories.
   */
  public static generateReadmeMd(): string {
    return `# Odoo Code Notepad Notes

This repository stores synchronized notes from **Odoo Code Notepad** VS Code extension.

## Folder Structure

- \`todo/\`: Active tasks in Todo status
- \`in-progress/\`: Tasks currently being worked on
- \`completed/\`: Tasks that have been resolved
- \`archived/\`: Archived historical task notes
- \`index.md\`: Dynamic index listing all tasks

Each task folder contains:
- \`task.md\`: Main task Markdown notes
- \`metadata.json\`: Structured metadata
- \`images/\`: Screenshots & image attachments
- \`snippets/\`: Saved code snippet references

*Managed automatically by Odoo Code Notepad extension.*
`;
  }

  /**
   * Initializes basic repository layout (README.md, index.md, .odoo-code-notepad/config.json) if not already initialized.
   */
  public static async initializeNotesRepository(owner: string, repo: string, defaultBranch: string, token: string): Promise<void> {
    try {
      const parentCommitSha = await GitHubService.getBranchCommitSha(owner, repo, defaultBranch, token);
      if (!parentCommitSha) {
        return;
      }

      const tasksMeta = await StorageService.getTaskMetadataList();
      const indexTasks = tasksMeta.map(t => ({
        title: t.title,
        remotePath: t.githubSync?.remotePath || `${this.getStatusFolder(t.status)}/${this.slugify(t.title)}`,
        status: t.status
      }));

      const treeItems: TreeItem[] = [
        {
          path: '.odoo-code-notepad/config.json',
          mode: '100644',
          type: 'blob',
          content: JSON.stringify({ formatVersion: 1, generatedBy: 'odoo-code-notepad' }, null, 2)
        },
        {
          path: 'README.md',
          mode: '100644',
          type: 'blob',
          content: this.generateReadmeMd()
        },
        {
          path: 'index.md',
          mode: '100644',
          type: 'blob',
          content: this.generateIndexMd(indexTasks)
        }
      ];

      await GitHubService.createCommit(owner, repo, defaultBranch, parentCommitSha, treeItems, 'Initialize Odoo Code Notepad Repository', token);
    } catch (e) {
      console.error('Error initializing repository files:', e);
    }
  }

  /**
   * Pushes a single task to the GitHub repository.
   */
  public static async pushTask(task: Task, force: boolean = false): Promise<Task> {
    const token = await GitHubAuthService.getToken();
    if (!token) {
      throw new Error('Not authenticated with GitHub. Please connect GitHub first.');
    }

    const config = await StorageService.getGitHubConfig();
    if (!config.connected || !config.repository) {
      throw new Error('GitHub Notes repository is not configured.');
    }

    const owner = config.repository.owner;
    const repo = config.repository.name;
    const branch = config.repository.defaultBranch || 'main';

    // Fetch branch head commit
    const parentCommitSha = await GitHubService.getBranchCommitSha(owner, repo, branch, token);
    if (!parentCommitSha) {
      throw new Error(`Branch '${branch}' not found in repository ${owner}/${repo}.`);
    }

    // Determine old & new remote paths
    const statusFolder = this.getStatusFolder(task.status);
    const slug = this.slugify(task.title);
    const targetFolder = `${statusFolder}/${slug}`;

    const oldRemotePath = task.githubSync?.remotePath;
    const isMoving = oldRemotePath && oldRemotePath !== targetFolder;

    // Build Git Tree Items
    const treeItems: TreeItem[] = [];

    // If moving from an old path, mark old path files for removal
    if (isMoving) {
      try {
        const oldTree = await GitHubService.getTree(owner, repo, parentCommitSha, token);
        const oldFiles = oldTree.filter(item => item.path.startsWith(`${oldRemotePath}/`) && item.type === 'blob');
        for (const file of oldFiles) {
          treeItems.push({
            path: file.path,
            mode: '100644',
            type: 'blob',
            sha: null
          });
        }
      } catch (e) {
        console.error('Error fetching tree for moving old files:', e);
      }
    }

    // 1. task.md
    const taskMd = this.taskToMarkdown(task);
    treeItems.push({
      path: `${targetFolder}/task.md`,
      mode: '100644',
      type: 'blob',
      content: taskMd
    });

    // 2. metadata.json
    const metaJson = this.taskToMetadataJson(task, targetFolder);
    treeItems.push({
      path: `${targetFolder}/metadata.json`,
      mode: '100644',
      type: 'blob',
      content: metaJson
    });

    // 3. Images
    const baseDir = StorageService.getBaseDir();
    for (const imgPath of task.images || []) {
      const filename = path.basename(imgPath);
      const fullImgPath = path.isAbsolute(imgPath) ? imgPath : path.join(baseDir, imgPath);
      if (fs.existsSync(fullImgPath)) {
        const buffer = await fs.promises.readFile(fullImgPath);
        const base64 = buffer.toString('base64');
        const blobSha = await GitHubService.createBlob(owner, repo, base64, token);
        treeItems.push({
          path: `${targetFolder}/images/${filename}`,
          mode: '100644',
          type: 'blob',
          sha: blobSha
        });
      }
    }

    // 4. Snippets
    for (let i = 0; i < (task.snippets || []).length; i++) {
      const snip = task.snippets[i];
      const snipSlug = this.slugify(snip.title) || `snippet-${i + 1}`;
      const snipMd = this.snippetToMarkdown(snip);
      treeItems.push({
        path: `${targetFolder}/snippets/${snipSlug}.md`,
        mode: '100644',
        type: 'blob',
        content: snipMd
      });
    }

    // 5. Ensure repository marker & README.md exist
    treeItems.push({
      path: '.odoo-code-notepad/config.json',
      mode: '100644',
      type: 'blob',
      content: JSON.stringify({ formatVersion: 1, generatedBy: 'odoo-code-notepad' }, null, 2)
    });
    treeItems.push({
      path: 'README.md',
      mode: '100644',
      type: 'blob',
      content: this.generateReadmeMd()
    });

    // 6. Update index.md
    const tasksMeta = await StorageService.getTaskMetadataList();
    const indexTasks = tasksMeta.map(t => {
      let rPath = targetFolder;
      if (t.id === task.id) {
        rPath = targetFolder;
      } else if (t.githubSync?.remotePath) {
        rPath = t.githubSync.remotePath;
      } else {
        rPath = `${this.getStatusFolder(t.status)}/${this.slugify(t.title)}`;
      }
      return {
        title: t.title,
        remotePath: rPath,
        status: t.status
      };
    });
    treeItems.push({
      path: 'index.md',
      mode: '100644',
      type: 'blob',
      content: this.generateIndexMd(indexTasks)
    });

    // Commit
    const commitMessage = `Sync task: ${task.title}`;
    const newCommitSha = await GitHubService.createCommit(owner, repo, branch, parentCommitSha, treeItems, commitMessage, token);

    // Compute task hash
    const currentHash = await this.computeTaskHash(task);

    // Update local task
    const updatedTask: Task = {
      ...task,
      githubSync: {
        enabled: true,
        repositoryOwner: owner,
        repositoryName: repo,
        remotePath: targetFolder,
        lastSyncedCommit: newCommitSha,
        lastSyncedHash: currentHash,
        lastSyncedAt: new Date().toISOString(),
        syncState: 'synced'
      }
    };

    await StorageService.saveTask(updatedTask);

    // Update global config lastSyncedAt
    config.lastSyncedAt = new Date().toISOString();
    await StorageService.saveGitHubConfig(config);

    return updatedTask;
  }

  /**
   * Pulls a single task from GitHub.
   */
  public static async pullTask(taskId: string, force: boolean = false): Promise<Task> {
    const token = await GitHubAuthService.getToken();
    if (!token) {
      throw new Error('Not authenticated with GitHub.');
    }

    const config = await StorageService.getGitHubConfig();
    if (!config.connected || !config.repository) {
      throw new Error('GitHub Notes repository is not configured.');
    }

    const localTask = await StorageService.getTask(taskId);
    if (!localTask || !localTask.githubSync?.remotePath) {
      throw new Error('Task has not been synchronized with GitHub yet.');
    }

    const owner = config.repository.owner;
    const repo = config.repository.name;
    const branch = config.repository.defaultBranch || 'main';
    const remotePath = localTask.githubSync.remotePath;

    const commitSha = await GitHubService.getBranchCommitSha(owner, repo, branch, token);
    if (!commitSha) {
      throw new Error('Could not get branch head commit.');
    }

    const tree = await GitHubService.getTree(owner, repo, commitSha, token);
    const taskFiles = tree.filter(item => item.path.startsWith(`${remotePath}/`));

    if (taskFiles.length === 0) {
      // Remote task folder deleted
      localTask.githubSync.syncState = 'remote_deleted';
      await StorageService.saveTask(localTask);
      throw new Error('Remote task folder no longer exists on GitHub.');
    }

    // 1. Fetch metadata.json
    const metaFile = taskFiles.find(item => item.path === `${remotePath}/metadata.json`);
    let metaData: any = {};
    if (metaFile) {
      const blob = await GitHubService.getBlobContent(owner, repo, metaFile.sha, token);
      const jsonStr = Buffer.from(blob.content, blob.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8');
      metaData = JSON.parse(jsonStr);
    }

    // 2. Fetch task.md
    const taskMdFile = taskFiles.find(item => item.path === `${remotePath}/task.md`);
    let taskNotes = localTask.notes;
    if (taskMdFile) {
      const blob = await GitHubService.getBlobContent(owner, repo, taskMdFile.sha, token);
      const markdownText = Buffer.from(blob.content, blob.encoding === 'base64' ? 'base64' : 'utf8').toString('utf8');
      
      // Extract notes section if formatted
      const notesMatch = markdownText.match(/## Notes\n([\s\S]*?)(?=\n## |$)/);
      if (notesMatch) {
        taskNotes = notesMatch[1].trim();
      } else {
        taskNotes = markdownText;
      }
    }

    // 3. Fetch images
    const imageFiles = taskFiles.filter(item => item.path.startsWith(`${remotePath}/images/`));
    const pulledImages: string[] = [];
    const baseDir = StorageService.getBaseDir();

    for (const imgFile of imageFiles) {
      const filename = path.basename(imgFile.path);
      const targetRelPath = path.join('images', filename);
      const targetFullPath = path.join(baseDir, targetRelPath);

      const blob = await GitHubService.getBlobContent(owner, repo, imgFile.sha, token);
      const imgBuffer = Buffer.from(blob.content, 'base64');
      await fs.promises.writeFile(targetFullPath, imgBuffer);
      pulledImages.push(targetRelPath);
    }

    const tempTask: Task = {
      ...localTask,
      title: metaData.title || localTask.title,
      status: metaData.status || localTask.status,
      description: metaData.description !== undefined ? metaData.description : localTask.description,
      repository: metaData.repository || localTask.repository,
      branch: metaData.branch || localTask.branch,
      tags: metaData.tags || localTask.tags,
      notes: taskNotes,
      images: pulledImages.length > 0 ? pulledImages : localTask.images
    };

    const calculatedHash = await this.computeTaskHash(tempTask);

    const updatedTask: Task = {
      ...tempTask,
      updatedDate: new Date().toISOString(),
      githubSync: {
        enabled: true,
        repositoryOwner: owner,
        repositoryName: repo,
        remotePath: remotePath,
        lastSyncedCommit: commitSha,
        lastSyncedHash: calculatedHash,
        lastSyncedAt: new Date().toISOString(),
        syncState: 'synced'
      }
    };

    await StorageService.saveTask(updatedTask);
    return updatedTask;
  }
}
