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
      procedure_attachments: {
        Row: {
          created_at: string
          filename: string
          id: string
          mime_type: string | null
          procedure_id: string
          size_bytes: number | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          mime_type?: string | null
          procedure_id: string
          size_bytes?: number | null
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string | null
          procedure_id?: string
          size_bytes?: number | null
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_attachments_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_names: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          preset_id: string | null
          sort_order: number
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          name: string
          preset_id?: string | null
          sort_order?: number
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          preset_id?: string | null
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_names_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "procedure_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_preset_fields: {
        Row: {
          created_at: string
          field_type: string
          id: string
          label: string
          preset_id: string
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          field_type?: string
          id?: string
          label: string
          preset_id: string
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          field_type?: string
          id?: string
          label?: string
          preset_id?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_preset_fields_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "procedure_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      procedure_presets: {
        Row: {
          created_at: string
          defaults: Json
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          defaults?: Json
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          defaults?: Json
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      procedure_steps: {
        Row: {
          created_at: string
          duration_seconds: number
          id: string
          label: string
          notes: string | null
          order_idx: number
          procedure_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          id?: string
          label: string
          notes?: string | null
          order_idx?: number
          procedure_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          id?: string
          label?: string
          notes?: string | null
          order_idx?: number
          procedure_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_steps_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      procedures: {
        Row: {
          assistant_surgeon: string | null
          category: string | null
          closed_by: string | null
          complications: string | null
          created_at: string
          difficulty: number | null
          id: string
          indication: string | null
          ip_number: string | null
          lessons: string | null
          name: string
          notes: string | null
          outcome: string | null
          pa_names: string[]
          patient_name: string | null
          patient_ref: string | null
          performed_at: string
          preset_id: string | null
          preset_values: Json
          role: string | null
          scrub_in_at: string | null
          scrub_out_at: string | null
          site: string | null
          status: string
          surgeon: string | null
          total_duration_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assistant_surgeon?: string | null
          category?: string | null
          closed_by?: string | null
          complications?: string | null
          created_at?: string
          difficulty?: number | null
          id?: string
          indication?: string | null
          ip_number?: string | null
          lessons?: string | null
          name: string
          notes?: string | null
          outcome?: string | null
          pa_names?: string[]
          patient_name?: string | null
          patient_ref?: string | null
          performed_at?: string
          preset_id?: string | null
          preset_values?: Json
          role?: string | null
          scrub_in_at?: string | null
          scrub_out_at?: string | null
          site?: string | null
          status?: string
          surgeon?: string | null
          total_duration_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assistant_surgeon?: string | null
          category?: string | null
          closed_by?: string | null
          complications?: string | null
          created_at?: string
          difficulty?: number | null
          id?: string
          indication?: string | null
          ip_number?: string | null
          lessons?: string | null
          name?: string
          notes?: string | null
          outcome?: string | null
          pa_names?: string[]
          patient_name?: string | null
          patient_ref?: string | null
          performed_at?: string
          preset_id?: string | null
          preset_values?: Json
          role?: string | null
          scrub_in_at?: string | null
          scrub_out_at?: string | null
          site?: string | null
          status?: string
          surgeon?: string | null
          total_duration_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_pas: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      team_surgeons: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
