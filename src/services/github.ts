import { GitHubRepoInfo } from '../types';

export interface TreeItem {
  path: string;
  mode: '100644' | '100755' | '040000' | '160000' | '120000';
  type: 'blob' | 'tree' | 'commit';
  sha?: string | null;
  content?: string;
}

export class GitHubService {
  private static readonly API_BASE = 'https://api.github.com';

  private static getHeaders(token: string) {
    return {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'OdooCodeNotepad-VSCodeExtension',
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };
  }

  /**
   * Check if a repository exists and is accessible.
   */
  public static async getRepository(owner: string, repo: string, token: string): Promise<GitHubRepoInfo | null> {
    try {
      const res = await fetch(`${this.API_BASE}/repos/${owner}/${repo}`, {
        headers: this.getHeaders(token)
      });
      if (!res.ok) {
        return null;
      }
      const data = await res.json() as any;
      return {
        owner: data.owner.login,
        name: data.name,
        isPrivate: data.private,
        defaultBranch: data.default_branch || 'main'
      };
    } catch (e) {
      console.error('Error fetching repository info:', e);
      return null;
    }
  }

  /**
   * Creates a new private repository for the authenticated user.
   */
  public static async createPrivateRepository(name: string, description: string, token: string): Promise<GitHubRepoInfo> {
    const res = await fetch(`${this.API_BASE}/user/repos`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({
        name,
        description,
        private: true,
        auto_init: true // Initializes with README.md so default branch exists
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to create repository: ${res.statusText} (${errText})`);
    }

    const data = await res.json() as any;
    return {
      owner: data.owner.login,
      name: data.name,
      isPrivate: data.private,
      defaultBranch: data.default_branch || 'main'
    };
  }

  /**
   * Lists repositories owned or accessible by the user.
   */
  public static async listUserRepositories(token: string): Promise<Array<{ owner: string; name: string; isPrivate: boolean }>> {
    const res = await fetch(`${this.API_BASE}/user/repos?type=all&sort=updated&per_page=100`, {
      headers: this.getHeaders(token)
    });
    if (!res.ok) {
      throw new Error(`Failed to list repositories: ${res.statusText}`);
    }
    const data = await res.json() as any[];
    return data.map(item => ({
      owner: item.owner.login,
      name: item.name,
      isPrivate: item.private
    }));
  }

  /**
   * Retrieves the commit SHA of a branch head.
   */
  public static async getBranchCommitSha(owner: string, repo: string, branch: string, token: string): Promise<string | null> {
    try {
      const res = await fetch(`${this.API_BASE}/repos/${owner}/${repo}/git/ref/heads/${branch}`, {
        headers: this.getHeaders(token)
      });
      if (!res.ok) {
        return null;
      }
      const data = await res.json() as any;
      return data.object.sha;
    } catch {
      return null;
    }
  }

  /**
   * Fetches the tree of a commit recursively.
   */
  public static async getTree(owner: string, repo: string, treeSha: string, token: string): Promise<Array<{ path: string; mode: string; type: string; sha: string; size?: number }>> {
    const res = await fetch(`${this.API_BASE}/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`, {
      headers: this.getHeaders(token)
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch git tree: ${res.statusText}`);
    }
    const data = await res.json() as any;
    return data.tree || [];
  }

  /**
   * Fetches content of a blob (base64 or text).
   */
  public static async getBlobContent(owner: string, repo: string, blobSha: string, token: string): Promise<{ content: string; encoding: string }> {
    const res = await fetch(`${this.API_BASE}/repos/${owner}/${repo}/git/blobs/${blobSha}`, {
      headers: this.getHeaders(token)
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch blob ${blobSha}: ${res.statusText}`);
    }
    const data = await res.json() as any;
    return { content: data.content, encoding: data.encoding };
  }

  /**
   * Creates a blob for binary data (or large content) and returns its SHA.
   */
  public static async createBlob(owner: string, repo: string, contentBase64: string, token: string): Promise<string> {
    const res = await fetch(`${this.API_BASE}/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify({
        content: contentBase64,
        encoding: 'base64'
      })
    });
    if (!res.ok) {
      throw new Error(`Failed to create blob: ${res.statusText}`);
    }
    const data = await res.json() as any;
    return data.sha;
  }

  /**
   * Creates a tree and commit, updating the target branch in ONE atomic operation.
   */
  public static async createCommit(
    owner: string,
    repo: string,
    branch: string,
    parentCommitSha: string | null,
    treeItems: TreeItem[],
    commitMessage: string,
    token: string
  ): Promise<string> {
    // 1. Create Tree
    const treePayload: any = {
      tree: treeItems
    };
    if (parentCommitSha) {
      treePayload.base_tree = parentCommitSha;
    }

    const treeRes = await fetch(`${this.API_BASE}/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(treePayload)
    });

    if (!treeRes.ok) {
      const errText = await treeRes.text();
      throw new Error(`Failed to create git tree: ${treeRes.statusText} (${errText})`);
    }
    const treeData = await treeRes.json() as any;
    const newTreeSha = treeData.sha;

    // 2. Create Commit
    const commitPayload: any = {
      message: commitMessage,
      tree: newTreeSha,
      parents: parentCommitSha ? [parentCommitSha] : []
    };

    const commitRes = await fetch(`${this.API_BASE}/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      headers: this.getHeaders(token),
      body: JSON.stringify(commitPayload)
    });

    if (!commitRes.ok) {
      const errText = await commitRes.text();
      throw new Error(`Failed to create commit: ${commitRes.statusText} (${errText})`);
    }
    const commitData = await commitRes.json() as any;
    const newCommitSha = commitData.sha;

    // 3. Update Ref (Branch)
    const refRes = await fetch(`${this.API_BASE}/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers: this.getHeaders(token),
      body: JSON.stringify({
        sha: newCommitSha,
        force: false
      })
    });

    if (!refRes.ok) {
      const errText = await refRes.text();
      throw new Error(`Failed to update branch ref ${branch}: ${refRes.statusText} (${errText})`);
    }

    return newCommitSha;
  }
}
