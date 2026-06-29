import * as cp from 'child_process';
import * as path from 'path';
import { RepositoryInfo } from '../types';

export class GitService {
  /**
   * Runs a git command in the specified directory.
   */
  private static runGitCommand(args: string[], cwd: string): Promise<string> {
    return new Promise((resolve) => {
      cp.exec(`git ${args.join(' ')}`, { cwd }, (error, stdout) => {
        if (error) {
          resolve('');
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  /**
   * Automatically detects git repository information for a folder.
   */
  public static async getRepoInfo(folderPath: string): Promise<RepositoryInfo> {
    const defaultInfo: RepositoryInfo = {
      repositoryName: '',
      branch: '',
      commitUrl: '',
      runbotUrl: ''
    };

    try {
      // 1. Verify if we are inside a Git repository
      const isRepo = await this.runGitCommand(['rev-parse', '--is-inside-work-tree'], folderPath);
      if (isRepo !== 'true') {
        // Fallback: use directory name as repo name if not a git repo
        defaultInfo.repositoryName = path.basename(folderPath);
        return defaultInfo;
      }

      // 2. Get the top level Git directory path
      const gitRoot = await this.runGitCommand(['rev-parse', '--show-toplevel'], folderPath);
      if (gitRoot) {
        defaultInfo.repositoryName = path.basename(gitRoot);
      } else {
        defaultInfo.repositoryName = path.basename(folderPath);
      }

      // 3. Get the current branch
      defaultInfo.branch = await this.runGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], folderPath);

      // 4. Get the current commit hash
      const commit = await this.runGitCommand(['rev-parse', 'HEAD'], folderPath);

      // 5. Get the remote URL (origin)
      let remote = await this.runGitCommand(['config', '--get', 'remote.origin.url'], folderPath);
      if (!remote) {
        remote = await this.runGitCommand(['remote', 'get-url', 'origin'], folderPath);
      }

      // Build Commit URL
      if (commit) {
        if (remote) {
          let cleanRemote = remote.trim().replace(/\.git$/, '');
          if (cleanRemote.startsWith('git@github.com:')) {
            cleanRemote = cleanRemote.replace('git@github.com:', 'https://github.com/');
          } else if (cleanRemote.startsWith('git@')) {
            cleanRemote = cleanRemote.replace('git@', 'https://').replace(':', '/');
          }
          defaultInfo.commitUrl = `${cleanRemote}/commit/${commit}`;
        } else {
          defaultInfo.commitUrl = commit; // fallback to hash if no remote
        }
      }

    } catch (e) {
      console.error('Error fetching git info:', e);
      // Fallback
      defaultInfo.repositoryName = path.basename(folderPath);
    }

    return defaultInfo;
  }
}
