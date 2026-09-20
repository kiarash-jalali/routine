export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_rate_limits: {
        Row: {
          bucket: string
          hits: number
          subject_hash: string
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          subject_hash: string
          window_start: string
        }
        Update: {
          bucket?: string
          hits?: number
          subject_hash?: string
          window_start?: string
        }
        Relationships: []
      }
      checkin_items: {
        Row: {
          checkin_id: string
          completed: boolean
          created_at: string
          id: string
          item_id: string
          item_type: string
          user_id: string
        }
        Insert: {
          checkin_id: string
          completed?: boolean
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          user_id: string
        }
        Update: {
          checkin_id?: string
          completed?: boolean
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkin_items_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "daily_checkins"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_checkins: {
        Row: {
          completed_at: string | null
          created_at: string
          day: string
          energy: number | null
          id: string
          mood: number | null
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          day: string
          energy?: number | null
          id?: string
          mood?: number | null
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          day?: string
          energy?: number | null
          id?: string
          mood?: number | null
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          category: string
          created_at: string
          id: string
          message: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          message: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          message?: string
          user_id?: string
        }
        Relationships: []
      }
      medication_plans: {
        Row: {
          created_at: string
          days_of_week: number[]
          dose: string
          effective_from: string
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          notes: string
          reminders_enabled: boolean
          schedule_version: number
          start_date: string | null
          times: string[]
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_of_week?: number[]
          dose?: string
          effective_from?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string
          reminders_enabled?: boolean
          schedule_version?: number
          start_date?: string | null
          times: string[]
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_of_week?: number[]
          dose?: string
          effective_from?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string
          reminders_enabled?: boolean
          schedule_version?: number
          start_date?: string | null
          times?: string[]
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      medication_reminders: {
        Row: {
          created_at: string
          dose: string
          id: string
          medication_id: string
          name: string
          notified_at: string | null
          schedule_version: number
          scheduled_at: string
          scheduled_day: string
          scheduled_time: string
          taken_at: string | null
          timezone: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dose: string
          id?: string
          medication_id: string
          name: string
          notified_at?: string | null
          schedule_version: number
          scheduled_at: string
          scheduled_day: string
          scheduled_time: string
          taken_at?: string | null
          timezone: string
          user_id: string
        }
        Update: {
          created_at?: string
          dose?: string
          id?: string
          medication_id?: string
          name?: string
          notified_at?: string | null
          schedule_version?: number
          scheduled_at?: string
          scheduled_day?: string
          scheduled_time?: string
          taken_at?: string | null
          timezone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_reminders_medication_id_user_id_fkey"
            columns: ["medication_id", "user_id"]
            isOneToOne: false
            referencedRelation: "medication_plans"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          enabled: boolean
          last_sent_on: string | null
          reminder_time: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          last_sent_on?: string | null
          reminder_time?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          last_sent_on?: string | null
          reminder_time?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      point_rules: {
        Row: {
          checkin_reward_points: number
          id: string
          streak_repair_cost_points: number
          updated_at: string
        }
        Insert: {
          checkin_reward_points: number
          id: string
          streak_repair_cost_points: number
          updated_at?: string
        }
        Update: {
          checkin_reward_points?: number
          id?: string
          streak_repair_cost_points?: number
          updated_at?: string
        }
        Relationships: []
      }
      point_transactions: {
        Row: {
          amount: number
          created_at: string
          day: string | null
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          day?: string | null
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          day?: string | null
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          intro_seen: boolean
          locale: string
          onboarding_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          intro_seen?: boolean
          locale?: string
          onboarding_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          intro_seen?: boolean
          locale?: string
          onboarding_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_deliveries: {
        Row: {
          attempted_at: string
          attempts: number
          category: string
          delivered_at: string | null
          event_key: string
          subscription_id: string
        }
        Insert: {
          attempted_at?: string
          attempts?: number
          category: string
          delivered_at?: string | null
          event_key: string
          subscription_id: string
        }
        Update: {
          attempted_at?: string
          attempts?: number
          category?: string
          delivered_at?: string | null
          event_key?: string
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "push_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      routines: {
        Row: {
          created_at: string
          days_of_week: number[] | null
          frequency: string
          id: string
          is_active: boolean
          preferred_time: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_of_week?: number[] | null
          frequency: string
          id?: string
          is_active?: boolean
          preferred_time?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_of_week?: number[] | null
          frequency?: string
          id?: string
          is_active?: boolean
          preferred_time?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      streak_repairs: {
        Row: {
          cost_points: number
          created_at: string
          day: string
          id: string
          user_id: string
        }
        Insert: {
          cost_points: number
          created_at?: string
          day: string
          id?: string
          user_id: string
        }
        Update: {
          cost_points?: number
          created_at?: string
          day?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          due_at: string | null
          id: string
          is_done: boolean
          notes: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_at?: string | null
          id?: string
          is_done?: boolean
          notes?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_at?: string | null
          id?: string
          is_done?: boolean
          notes?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_plans: {
        Row: {
          activity_type: string
          created_at: string
          days_of_week: number[]
          duration_minutes: number
          effective_from: string
          exercises: string
          id: string
          is_active: boolean
          name: string
          preferred_time: string
          reminders_enabled: boolean
          schedule_version: number
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          days_of_week?: number[]
          duration_minutes: number
          effective_from?: string
          exercises?: string
          id?: string
          is_active?: boolean
          name: string
          preferred_time: string
          reminders_enabled?: boolean
          schedule_version?: number
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          days_of_week?: number[]
          duration_minutes?: number
          effective_from?: string
          exercises?: string
          id?: string
          is_active?: boolean
          name?: string
          preferred_time?: string
          reminders_enabled?: boolean
          schedule_version?: number
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_sessions: {
        Row: {
          activity_type: string
          completed_at: string | null
          created_at: string
          duration_minutes: number
          exercises: string
          id: string
          name: string
          notified_at: string | null
          schedule_version: number
          scheduled_at: string
          scheduled_day: string
          scheduled_time: string
          timezone: string
          user_id: string
          workout_id: string | null
        }
        Insert: {
          activity_type: string
          completed_at?: string | null
          created_at?: string
          duration_minutes: number
          exercises?: string
          id?: string
          name: string
          notified_at?: string | null
          schedule_version?: number
          scheduled_at: string
          scheduled_day: string
          scheduled_time: string
          timezone: string
          user_id: string
          workout_id?: string | null
        }
        Update: {
          activity_type?: string
          completed_at?: string | null
          created_at?: string
          duration_minutes?: number
          exercises?: string
          id?: string
          name?: string
          notified_at?: string | null
          schedule_version?: number
          scheduled_at?: string
          scheduled_day?: string
          scheduled_time?: string
          timezone?: string
          user_id?: string
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_workout_id_user_id_fkey"
            columns: ["workout_id", "user_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_push_delivery: {
        Args: { p_category: string; p_event: string; p_subscription: string }
        Returns: boolean
      }
      consume_api_rate_limit: {
        Args: {
          p_bucket: string
          p_limit: number
          p_subject_hash: string
          p_window_seconds: number
        }
        Returns: boolean
      }
      finish_daily_checkin: {
        Args: { p_day: string; p_items: Json }
        Returns: {
          completed_at: string
          day: string
          id: string
          user_id: string
        }[]
      }
      get_point_balance: { Args: never; Returns: number }
      get_point_rules: {
        Args: never
        Returns: {
          checkin_reward_points: number
          streak_repair_cost_points: number
        }[]
      }
      get_rhythm_summary: {
        Args: { p_today: string; p_window_days?: number }
        Returns: {
          best_days: number
          checked_in_today: boolean
          current_days: number
          recent_checkin_days: string[]
          recent_repaired_days: string[]
        }[]
      }
      repair_streak_day: { Args: { target_day: string }; Returns: number }
      set_daily_item_completion: {
        Args: {
          p_completed: boolean
          p_day: string
          p_item_id: string
          p_item_type: string
        }
        Returns: {
          completed_at: string
          day: string
          id: string
          user_id: string
        }[]
      }
      sync_medication_reminders:
        | { Args: never; Returns: undefined }
        | { Args: { target_user_id: string }; Returns: undefined }
      sync_workout_sessions:
        | { Args: never; Returns: undefined }
        | { Args: { target_user_id: string }; Returns: undefined }
      valid_schedule_times: { Args: { value: string[] }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
