// Hand-authored to match supabase/migrations/20260702000000_schema_v1.sql.
// Regenerate once linked to the project with:
//   npx supabase gen types typescript --linked > src/lib/database.types.ts

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: { id: string; display_name: string | null; created_at: string; updated_at: string }
        Insert: { id: string; display_name?: string | null }
        Update: { display_name?: string | null }
        Relationships: []
      }
      sets: {
        Row: {
          id: string
          user_id: string
          name: string
          data: Json
          created_at: string
          updated_at: string
        }
        Insert: { id?: string; user_id: string; name?: string; data?: Json }
        Update: { name?: string; data?: Json }
        Relationships: []
      }
      track_features: {
        Row: { content_hash: string; schema_version: number; features: Json; created_at: string }
        Insert: { content_hash: string; schema_version: number; features: Json }
        Update: never
        Relationships: []
      }
      user_tracks: {
        Row: {
          user_id: string
          content_hash: string
          title: string | null
          artist: string | null
          overrides: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          content_hash: string
          title?: string | null
          artist?: string | null
          overrides?: Json
        }
        Update: { title?: string | null; artist?: string | null; overrides?: Json }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: Record<never, never>
  }
}

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
