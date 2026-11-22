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
      body_measurements: {
        Row: {
          body_fat_pct: number | null
          created_at: string
          id: string
          measured_on: string
          note: string | null
          updated_at: string
          user_id: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          measured_on: string
          note?: string | null
          updated_at?: string
          user_id: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          measured_on?: string
          note?: string | null
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      body_profiles: {
        Row: {
          activity_level: string
          birth_year: number
          created_at: string
          goal_mode: string
          goal_rate_kg_week: number | null
          goal_weight_kg: number | null
          height_cm: number
          kcal_target_override: number | null
          protein_grams: number | null
          protein_mode: string
          sex: string | null
          updated_at: string
          user_id: string
          week_starts_on: number
        }
        Insert: {
          activity_level?: string
          birth_year: number
          created_at?: string
          goal_mode?: string
          goal_rate_kg_week?: number | null
          goal_weight_kg?: number | null
          height_cm: number
          kcal_target_override?: number | null
          protein_grams?: number | null
          protein_mode?: string
          sex?: string | null
          updated_at?: string
          user_id: string
          week_starts_on?: number
        }
        Update: {
          activity_level?: string
          birth_year?: number
          created_at?: string
          goal_mode?: string
          goal_rate_kg_week?: number | null
          goal_weight_kg?: number | null
          height_cm?: number
          kcal_target_override?: number | null
          protein_grams?: number | null
          protein_mode?: string
          sex?: string | null
          updated_at?: string
          user_id?: string
          week_starts_on?: number
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
      foods: {
        Row: {
          carbs_100g: number
          category: string | null
          count_unit_grams: number | null
          created_at: string
          fat_100g: number
          fiber_100g: number
          grocery_section: string | null
          id: string
          is_staple: boolean
          kcal_100g: number
          kind: string
          name_en: string | null
          name_fa: string | null
          owner_id: string | null
          protein_100g: number
          region: string | null
          serving_grams: number | null
          serving_label_en: string | null
          serving_label_fa: string | null
          serving_unit: string | null
          slug: string | null
          source: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          carbs_100g?: number
          category?: string | null
          count_unit_grams?: number | null
          created_at?: string
          fat_100g?: number
          fiber_100g?: number
          grocery_section?: string | null
          id?: string
          is_staple?: boolean
          kcal_100g?: number
          kind: string
          name_en?: string | null
          name_fa?: string | null
          owner_id?: string | null
          protein_100g?: number
          region?: string | null
          serving_grams?: number | null
          serving_label_en?: string | null
          serving_label_fa?: string | null
          serving_unit?: string | null
          slug?: string | null
          source?: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          carbs_100g?: number
          category?: string | null
          count_unit_grams?: number | null
          created_at?: string
          fat_100g?: number
          fiber_100g?: number
          grocery_section?: string | null
          id?: string
          is_staple?: boolean
          kcal_100g?: number
          kind?: string
          name_en?: string | null
          name_fa?: string | null
          owner_id?: string | null
          protein_100g?: number
          region?: string | null
          serving_grams?: number | null
          serving_label_en?: string | null
          serving_label_fa?: string | null
          serving_unit?: string | null
          slug?: string | null
          source?: string
          tags?: string[]
          updated_at?: string
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
          checkin_enabled: boolean
          created_at: string
          enabled: boolean
          health_enabled: boolean
          last_sent_on: string | null
          prompt_seen: boolean
          reminder_time: string
          routine_enabled: boolean
          task_enabled: boolean
          timezone: string
          updated_at: string
          user_id: string
          workout_enabled: boolean
        }
        Insert: {
          checkin_enabled?: boolean
          created_at?: string
          enabled?: boolean
          health_enabled?: boolean
          last_sent_on?: string | null
          prompt_seen?: boolean
          reminder_time?: string
          routine_enabled?: boolean
          task_enabled?: boolean
          timezone?: string
          updated_at?: string
          user_id: string
          workout_enabled?: boolean
        }
        Update: {
          checkin_enabled?: boolean
          created_at?: string
          enabled?: boolean
          health_enabled?: boolean
          last_sent_on?: string | null
          prompt_seen?: boolean
          reminder_time?: string
          routine_enabled?: boolean
          task_enabled?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
          workout_enabled?: boolean
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
          opened_at: string | null
          subscription_id: string
        }
        Insert: {
          attempted_at?: string
          attempts?: number
          category: string
          delivered_at?: string | null
          event_key: string
          opened_at?: string | null
          subscription_id: string
        }
        Update: {
          attempted_at?: string
          attempts?: number
          category?: string
          delivered_at?: string | null
          event_key?: string
          opened_at?: string | null
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
      recipe_ingredients: {
        Row: {
          amount_en: string | null
          amount_fa: string | null
          created_at: string
          food_id: string | null
          grams: number
          id: string
          is_staple: boolean
          name_en: string | null
          name_fa: string | null
          owner_id: string | null
          position: number
          recipe_id: string
          updated_at: string
        }
        Insert: {
          amount_en?: string | null
          amount_fa?: string | null
          created_at?: string
          food_id?: string | null
          grams?: number
          id?: string
          is_staple?: boolean
          name_en?: string | null
          name_fa?: string | null
          owner_id?: string | null
          position?: number
          recipe_id: string
          updated_at?: string
        }
        Update: {
          amount_en?: string | null
          amount_fa?: string | null
          created_at?: string
          food_id?: string | null
          grams?: number
          id?: string
          is_staple?: boolean
          name_en?: string | null
          name_fa?: string | null
          owner_id?: string | null
          position?: number
          recipe_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipe_ingredients_recipe_id_owner_id_fkey"
            columns: ["recipe_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      recipes: {
        Row: {
          category: string
          copied_from: string | null
          created_at: string
          id: string
          owner_id: string | null
          servings: number
          slug: string | null
          steps_en: string[]
          steps_fa: string[]
          suggested_side_food_id: string | null
          suggested_side_grams: number | null
          tags: string[]
          tip_en: string | null
          tip_fa: string | null
          title_en: string | null
          title_fa: string | null
          updated_at: string
        }
        Insert: {
          category: string
          copied_from?: string | null
          created_at?: string
          id?: string
          owner_id?: string | null
          servings?: number
          slug?: string | null
          steps_en?: string[]
          steps_fa?: string[]
          suggested_side_food_id?: string | null
          suggested_side_grams?: number | null
          tags?: string[]
          tip_en?: string | null
          tip_fa?: string | null
          title_en?: string | null
          title_fa?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          copied_from?: string | null
          created_at?: string
          id?: string
          owner_id?: string | null
          servings?: number
          slug?: string | null
          steps_en?: string[]
          steps_fa?: string[]
          suggested_side_food_id?: string | null
          suggested_side_grams?: number | null
          tags?: string[]
          tip_en?: string | null
          tip_fa?: string | null
          title_en?: string | null
          title_fa?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recipes_copied_from_fkey"
            columns: ["copied_from"]
            isOneToOne: false
            referencedRelation: "recipes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recipes_suggested_side_food_id_fkey"
            columns: ["suggested_side_food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
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
      target_adjustments: {
        Row: {
          accepted_at: string
          created_at: string
          delta_kcal: number
          effective_from: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          delta_kcal: number
          effective_from: string
          id?: string
          reason?: string
          user_id: string
        }
        Update: {
          accepted_at?: string
          created_at?: string
          delta_kcal?: number
          effective_from?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          created_at: string
          due_at: string | null
          due_has_time: boolean
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
          due_has_time?: boolean
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
          due_has_time?: boolean
          id?: string
          is_done?: boolean
          notes?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workout_plan_exercises: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          plan_id: string
          position: number
          rep_scheme: string
          rest_seconds: number | null
          target_sets: number
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          plan_id: string
          position?: number
          rep_scheme?: string
          rest_seconds?: number | null
          target_sets?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          plan_id?: string
          position?: number
          rep_scheme?: string
          rest_seconds?: number | null
          target_sets?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_plan_exercises_plan_id_user_id_fkey"
            columns: ["plan_id", "user_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id", "user_id"]
          },
        ]
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
      workout_set_logs: {
        Row: {
          band_level: string | null
          completed_at: string
          created_at: string
          exercise_id: string
          id: string
          reps: number
          rpe: number | null
          session_id: string
          set_number: number
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          band_level?: string | null
          completed_at?: string
          created_at?: string
          exercise_id: string
          id?: string
          reps: number
          rpe?: number | null
          session_id: string
          set_number: number
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          band_level?: string | null
          completed_at?: string
          created_at?: string
          exercise_id?: string
          id?: string
          reps?: number
          rpe?: number | null
          session_id?: string
          set_number?: number
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_set_logs_exercise_id_user_id_fkey"
            columns: ["exercise_id", "user_id"]
            isOneToOne: false
            referencedRelation: "workout_plan_exercises"
            referencedColumns: ["id", "user_id"]
          },
          {
            foreignKeyName: "workout_set_logs_session_id_user_id_fkey"
            columns: ["session_id", "user_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
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
      save_plan_exercises: {
        Args: { p_exercises: Json; p_plan_id: string }
        Returns: undefined
      }
      save_recipe: {
        Args: { p_ingredients: Json; p_recipe: Json; p_recipe_id: string | null }
        Returns: string
      }
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
