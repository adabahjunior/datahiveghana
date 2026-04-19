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
      agent_stores: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          is_active: boolean
          slug: string
          store_name: string
          support_phone: string
          updated_at: string
          whatsapp_link: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          slug: string
          store_name: string
          support_phone: string
          updated_at?: string
          whatsapp_link?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          slug?: string
          store_name?: string
          support_phone?: string
          updated_at?: string
          whatsapp_link?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      data_packages: {
        Row: {
          agent_price: number
          created_at: string
          display_order: number
          guest_price: number
          id: string
          is_active: boolean
          name: string
          network: Database["public"]["Enums"]["network_type"]
          updated_at: string
          validity_days: number | null
          volume_mb: number
        }
        Insert: {
          agent_price: number
          created_at?: string
          display_order?: number
          guest_price: number
          id?: string
          is_active?: boolean
          name: string
          network: Database["public"]["Enums"]["network_type"]
          updated_at?: string
          validity_days?: number | null
          volume_mb: number
        }
        Update: {
          agent_price?: number
          created_at?: string
          display_order?: number
          guest_price?: number
          id?: string
          is_active?: boolean
          name?: string
          network?: Database["public"]["Enums"]["network_type"]
          updated_at?: string
          validity_days?: number | null
          volume_mb?: number
        }
        Relationships: []
      }
      issue_reports: {
        Row: {
          created_at: string
          id: string
          message: string
          related_order_id: string | null
          resolved: boolean
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          related_order_id?: string | null
          resolved?: boolean
          subject: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          related_order_id?: string | null
          resolved?: boolean
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "issue_reports_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          agent_profit: number
          amount_paid: number
          buyer_user_id: string | null
          cost_price: number
          created_at: string
          id: string
          network: Database["public"]["Enums"]["network_type"]
          notes: string | null
          package_id: string
          paid_via: string
          recipient_phone: string
          status: Database["public"]["Enums"]["order_status"]
          store_id: string | null
          updated_at: string
          volume_mb: number
        }
        Insert: {
          agent_profit?: number
          amount_paid: number
          buyer_user_id?: string | null
          cost_price: number
          created_at?: string
          id?: string
          network: Database["public"]["Enums"]["network_type"]
          notes?: string | null
          package_id: string
          paid_via?: string
          recipient_phone: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string | null
          updated_at?: string
          volume_mb: number
        }
        Update: {
          agent_profit?: number
          amount_paid?: number
          buyer_user_id?: string | null
          cost_price?: number
          created_at?: string
          id?: string
          network?: Database["public"]["Enums"]["network_type"]
          notes?: string | null
          package_id?: string
          paid_via?: string
          recipient_phone?: string
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string | null
          updated_at?: string
          volume_mb?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "data_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "agent_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_agent: boolean
          phone: string | null
          profit_balance: number
          updated_at: string
          user_id: string
          wallet_balance: number
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_agent?: boolean
          phone?: string | null
          profit_balance?: number
          updated_at?: string
          user_id: string
          wallet_balance?: number
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_agent?: boolean
          phone?: string | null
          profit_balance?: number
          updated_at?: string
          user_id?: string
          wallet_balance?: number
        }
        Relationships: []
      }
      store_package_prices: {
        Row: {
          created_at: string
          id: string
          is_listed: boolean
          package_id: string
          selling_price: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_listed?: boolean
          package_id: string
          selling_price: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_listed?: boolean
          package_id?: string
          selling_price?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_package_prices_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "data_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_package_prices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "agent_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          paystack_charge: number
          reference: string | null
          related_order_id: string | null
          status: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          paystack_charge?: number
          reference?: string | null
          related_order_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type: Database["public"]["Enums"]["transaction_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          paystack_charge?: number
          reference?: string | null
          related_order_id?: string | null
          status?: Database["public"]["Enums"]["transaction_status"]
          type?: Database["public"]["Enums"]["transaction_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_notes: string | null
          agent_id: string
          amount: number
          created_at: string
          id: string
          momo_name: string
          momo_number: string
          network: Database["public"]["Enums"]["network_type"]
          processed_at: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
        }
        Insert: {
          admin_notes?: string | null
          agent_id: string
          amount: number
          created_at?: string
          id?: string
          momo_name: string
          momo_number: string
          network: Database["public"]["Enums"]["network_type"]
          processed_at?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
        }
        Update: {
          admin_notes?: string | null
          agent_id?: string
          amount?: number
          created_at?: string
          id?: string
          momo_name?: string
          momo_number?: string
          network?: Database["public"]["Enums"]["network_type"]
          processed_at?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "agent" | "admin"
      network_type:
        | "mtn"
        | "telecel"
        | "airteltigo_ishare"
        | "airteltigo_bigtime"
      order_status: "pending" | "processing" | "delivered" | "failed"
      transaction_status: "pending" | "success" | "failed"
      transaction_type:
        | "wallet_topup"
        | "data_purchase"
        | "agent_activation"
        | "withdrawal"
        | "store_sale"
      withdrawal_status: "pending" | "approved" | "paid" | "rejected"
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
    Enums: {
      app_role: ["user", "agent", "admin"],
      network_type: [
        "mtn",
        "telecel",
        "airteltigo_ishare",
        "airteltigo_bigtime",
      ],
      order_status: ["pending", "processing", "delivered", "failed"],
      transaction_status: ["pending", "success", "failed"],
      transaction_type: [
        "wallet_topup",
        "data_purchase",
        "agent_activation",
        "withdrawal",
        "store_sale",
      ],
      withdrawal_status: ["pending", "approved", "paid", "rejected"],
    },
  },
} as const
