import * as vscode from 'vscode';
import { GitHubAccountInfo } from '../types';

export class GitHubAuthService {
  private static cachedSession: vscode.AuthenticationSession | null = null;

  /**
   * Get an active GitHub authentication session via VS Code Authentication API.
   */
  public static async getSession(createIfNone: boolean = false): Promise<vscode.AuthenticationSession | undefined> {
    try {
      const session = await vscode.authentication.getSession('github', ['repo'], { createIfNone });
      if (session) {
        this.cachedSession = session;
        return session;
      }
    } catch (error) {
      console.error('Error obtaining GitHub authentication session:', error);
    }
    return undefined;
  }

  /**
   * Retrieves the access token from the active session.
   */
  public static async getToken(): Promise<string | undefined> {
    if (this.cachedSession) {
      return this.cachedSession.accessToken;
    }
    const session = await this.getSession(false);
    return session?.accessToken;
  }

  /**
   * Fetches user profile info using GitHub REST API.
   */
  public static async getUserProfile(token: string): Promise<GitHubAccountInfo | undefined> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-Agent': 'OdooCodeNotepad-VSCodeExtension',
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (response.ok) {
        const data = await response.json() as any;
        return {
          username: data.login,
          avatarUrl: data.avatar_url
        };
      }
    } catch (e) {
      console.error('Failed to fetch GitHub user profile:', e);
    }
    return undefined;
  }

  /**
   * Clears cached session in memory.
   */
  public static clearSession(): void {
    this.cachedSession = null;
  }
}
