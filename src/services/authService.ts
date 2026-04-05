/**
 * Authentication Service - Production Ready
 * Handles user registration, login, logout with Supabase
 */

import { supabase } from '../supabase';
import type { UserRole } from '../types';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

export class AuthService {
  private static instance: AuthService;
  private currentUser: AuthUser | null = null;

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Check if user is authenticated
  async isAuthenticated(): Promise<boolean> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return !!session;
  }

  // Get current user
  async getCurrentUser(): Promise<AuthUser | null> {
    if (this.currentUser) return this.currentUser;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    // Get user profile with role (maybeSingle: no row yet → no 406/PGRST noise)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, name')
      .eq('uid', user.id)
      .maybeSingle();

    this.currentUser = {
      id: user.id,
      email: user.email!,
      role: profile?.role || 'staff',
      name: profile?.name,
    };

    return this.currentUser;
  }

  // Register new user
  async register(data: RegisterData): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      // 1. Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
            role: data.role || 'staff',
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Registration failed');

      // 2. Create profile
      const { error: profileError } = await supabase.from('profiles').insert({
        uid: authData.user.id,
        email: data.email,
        name: data.name,
        role: data.role || 'staff',
      });

      if (profileError) {
        console.error('Profile creation failed:', profileError);
        // Continue anyway - profile can be created later
      }

      // 3. Create default settings
      const { error: settingsError } = await supabase.from('settings').insert({
        owner_id: authData.user.id,
      });

      if (settingsError) {
        console.error('Settings creation failed:', settingsError);
      }

      const user: AuthUser = {
        id: authData.user.id,
        email: data.email,
        role: data.role || 'staff',
        name: data.name,
      };

      this.currentUser = user;
      return { user, error: null };
    } catch (error: unknown) {
      console.error('Registration error:', error);
      const msg = error instanceof Error ? error.message : 'Registration failed';
      return { user: null, error: msg };
    }
  }

  // Login user
  async login(
    credentials: LoginCredentials
  ): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Login failed');

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, name')
        .eq('uid', authData.user.id)
        .maybeSingle();

      const user: AuthUser = {
        id: authData.user.id,
        email: authData.user.email!,
        role: profile?.role || 'staff',
        name: profile?.name,
      };

      this.currentUser = user;
      return { user, error: null };
    } catch (error: unknown) {
      console.error('Login error:', error);
      const msg = error instanceof Error ? error.message : 'Login failed';
      return { user: null, error: msg };
    }
  }

  // Logout user
  async logout(): Promise<void> {
    await supabase.auth.signOut();
    this.currentUser = null;
    localStorage.removeItem('openrouter_api_key');
  }

  // Reset password
  async resetPassword(email: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      return { success: true, error: null };
    } catch (error: unknown) {
      console.error('Password reset error:', error);
      const msg = error instanceof Error ? error.message : 'Password reset failed';
      return { success: false, error: msg };
    }
  }

  // Update user profile
  async updateProfile(
    updates: Partial<AuthUser>
  ): Promise<{ success: boolean; error: string | null }> {
    try {
      const user = await this.getCurrentUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({
          name: updates.name,
          role: updates.role,
        })
        .eq('uid', user.id);

      if (error) throw error;

      // Update local cache
      this.currentUser = { ...user, ...updates };
      return { success: true, error: null };
    } catch (error: unknown) {
      console.error('Profile update error:', error);
      const msg = error instanceof Error ? error.message : 'Update failed';
      return { success: false, error: msg };
    }
  }

  // Change password
  async changePassword(newPassword: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
      return { success: true, error: null };
    } catch (error: unknown) {
      console.error('Password change error:', error);
      const msg = error instanceof Error ? error.message : 'Password change failed';
      return { success: false, error: msg };
    }
  }

  // Check if email exists
  async checkEmailExists(email: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', email)
        .maybeSingle();

      return !!data && !error;
    } catch {
      return false;
    }
  }

  // Subscribe to auth changes
  onAuthStateChange(callback: (user: AuthUser | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const user = await this.getCurrentUser();
        callback(user);
      } else {
        this.currentUser = null;
        callback(null);
      }
    });
  }

  // Get auth token for API calls
  async getToken(): Promise<string | null> {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token || null;
  }
}

export const authService = AuthService.getInstance();
