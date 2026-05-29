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
      agent_package_base_prices: {
        Row: {
          agent_user_id: string
          base_price: number
          created_at: string
          id: string
          is_active: boolean
          package_id: string
          updated_at: string
        }
        Insert: {
          agent_user_id: string
          base_price: number
          created_at?: string
          id?: string
          is_active?: boolean
          package_id: string
          updated_at?: string
        }
        Update: {
          agent_user_id?: string
          base_price?: number
          created_at?: string
          id?: string
          is_active?: boolean
          package_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_package_base_prices_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "data_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_stores: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          is_active: boolean
          slug: string
          store_name: string
          subagent_fee_addon: number
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
          subagent_fee_addon?: number
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
          subagent_fee_addon?: number
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
      checker_orders: {
        Row: {
          agent_profit: number
          amount_paid: number
          buyer_user_id: string | null
          checker_codes: Json | null
          checker_id: string
          checker_pin: string | null
          checker_serial: string | null
          cost_price: number
          created_at: string
          exam_type: string
          id: string
          notes: string | null
          paid_via: string
          paystack_reference: string | null
          quantity: number
          recipient_phone: string
          seller_profit: number
          status: Database["public"]["Enums"]["order_status"]
          store_id: string | null
          updated_at: string
          upstream_agent_profit: number
        }
        Insert: {
          agent_profit?: number
          amount_paid: number
          buyer_user_id?: string | null
          checker_codes?: Json | null
          checker_id: string
          checker_pin?: string | null
          checker_serial?: string | null
          cost_price: number
          created_at?: string
          exam_type: string
          id?: string
          notes?: string | null
          paid_via?: string
          paystack_reference?: string | null
          quantity?: number
          recipient_phone: string
          seller_profit?: number
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string | null
          updated_at?: string
          upstream_agent_profit?: number
        }
        Update: {
          agent_profit?: number
          amount_paid?: number
          buyer_user_id?: string | null
          checker_codes?: Json | null
          checker_id?: string
          checker_pin?: string | null
          checker_serial?: string | null
          cost_price?: number
          created_at?: string
          exam_type?: string
          id?: string
          notes?: string | null
          paid_via?: string
          paystack_reference?: string | null
          quantity?: number
          recipient_phone?: string
          seller_profit?: number
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string | null
          updated_at?: string
          upstream_agent_profit?: number
        }
        Relationships: [
          {
            foreignKeyName: "checker_orders_checker_id_fkey"
            columns: ["checker_id"]
            isOneToOne: false
            referencedRelation: "checker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checker_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "agent_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      checker_products: {
        Row: {
          agent_price: number
          created_at: string
          display_order: number
          exam_type: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          user_price: number
        }
        Insert: {
          agent_price: number
          created_at?: string
          display_order?: number
          exam_type: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          user_price: number
        }
        Update: {
          agent_price?: number
          created_at?: string
          display_order?: number
          exam_type?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          user_price?: number
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
          provider_order_id: string | null
          provider_reference: string | null
          provider_response: Json | null
          provider_status: string | null
          recipient_phone: string
          seller_profit: number
          status: Database["public"]["Enums"]["order_status"]
          store_id: string | null
          updated_at: string
          upstream_agent_profit: number
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
          provider_order_id?: string | null
          provider_reference?: string | null
          provider_response?: Json | null
          provider_status?: string | null
          recipient_phone: string
          seller_profit?: number
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string | null
          updated_at?: string
          upstream_agent_profit?: number
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
          provider_order_id?: string | null
          provider_reference?: string | null
          provider_response?: Json | null
          provider_status?: string | null
          recipient_phone?: string
          seller_profit?: number
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string | null
          updated_at?: string
          upstream_agent_profit?: number
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
          ban_reason: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_agent: boolean
          is_banned: boolean
          manual_topup_code: string
          phone: string | null
          profit_balance: number
          updated_at: string
          user_id: string
          wallet_balance: number
        }
        Insert: {
          ban_reason?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_agent?: boolean
          is_banned?: boolean
          manual_topup_code?: string
          phone?: string | null
          profit_balance?: number
          updated_at?: string
          user_id: string
          wallet_balance?: number
        }
        Update: {
          ban_reason?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_agent?: boolean
          is_banned?: boolean
          manual_topup_code?: string
          phone?: string | null
          profit_balance?: number
          updated_at?: string
          user_id?: string
          wallet_balance?: number
        }
        Relationships: []
      }
      store_checker_prices: {
        Row: {
          checker_id: string
          created_at: string
          id: string
          is_listed: boolean
          selling_price: number
          store_id: string
          updated_at: string
        }
        Insert: {
          checker_id: string
          created_at?: string
          id?: string
          is_listed?: boolean
          selling_price: number
          store_id: string
          updated_at?: string
        }
        Update: {
          checker_id?: string
          created_at?: string
          id?: string
          is_listed?: boolean
          selling_price?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_checker_prices_checker_id_fkey"
            columns: ["checker_id"]
            isOneToOne: false
            referencedRelation: "checker_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_checker_prices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "agent_stores"
            referencedColumns: ["id"]
          },
        ]
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
      store_university_form_orders: {
        Row: {
          amount_paid: number
          cost_price: number
          created_at: string
          email: string
          form_type_id: string
          form_type_name: string
          full_name: string
          id: string
          notes: string | null
          paid_via: string
          paystack_reference: string | null
          phone: string
          school_id: string
          school_name: string
          seller_profit: number
          status: Database["public"]["Enums"]["order_status"]
          store_id: string
          updated_at: string
        }
        Insert: {
          amount_paid: number
          cost_price: number
          created_at?: string
          email: string
          form_type_id: string
          form_type_name: string
          full_name: string
          id?: string
          notes?: string | null
          paid_via?: string
          paystack_reference?: string | null
          phone: string
          school_id: string
          school_name: string
          seller_profit?: number
          status?: Database["public"]["Enums"]["order_status"]
          store_id: string
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          cost_price?: number
          created_at?: string
          email?: string
          form_type_id?: string
          form_type_name?: string
          full_name?: string
          id?: string
          notes?: string | null
          paid_via?: string
          paystack_reference?: string | null
          phone?: string
          school_id?: string
          school_name?: string
          seller_profit?: number
          status?: Database["public"]["Enums"]["order_status"]
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_university_form_orders_form_type_id_fkey"
            columns: ["form_type_id"]
            isOneToOne: false
            referencedRelation: "university_form_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_university_form_orders_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "university_schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_university_form_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "agent_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_university_form_prices: {
        Row: {
          created_at: string
          form_type_id: string
          id: string
          is_listed: boolean
          selling_price: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          form_type_id: string
          id?: string
          is_listed?: boolean
          selling_price: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          form_type_id?: string
          id?: string
          is_listed?: boolean
          selling_price?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_university_form_prices_form_type_id_fkey"
            columns: ["form_type_id"]
            isOneToOne: false
            referencedRelation: "university_form_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_university_form_prices_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "agent_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      subagent_assignments: {
        Row: {
          created_at: string
          id: string
          paid_amount: number
          paid_via: string
          parent_agent_id: string
          source_store_id: string | null
          status: string
          subagent_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          paid_amount?: number
          paid_via?: string
          parent_agent_id: string
          source_store_id?: string | null
          status?: string
          subagent_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          paid_amount?: number
          paid_via?: string
          parent_agent_id?: string
          source_store_id?: string | null
          status?: string
          subagent_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subagent_assignments_source_store_id_fkey"
            columns: ["source_store_id"]
            isOneToOne: false
            referencedRelation: "agent_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      subagent_checker_prices: {
        Row: {
          base_price: number
          checker_id: string
          created_at: string
          id: string
          is_active: boolean
          parent_agent_id: string
          updated_at: string
        }
        Insert: {
          base_price: number
          checker_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          parent_agent_id: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          checker_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          parent_agent_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subagent_checker_prices_checker_id_fkey"
            columns: ["checker_id"]
            isOneToOne: false
            referencedRelation: "checker_products"
            referencedColumns: ["id"]
          },
        ]
      }
      subagent_package_prices: {
        Row: {
          base_price: number
          created_at: string
          id: string
          is_active: boolean
          package_id: string
          parent_agent_id: string
          updated_at: string
        }
        Insert: {
          base_price: number
          created_at?: string
          id?: string
          is_active?: boolean
          package_id: string
          parent_agent_id: string
          updated_at?: string
        }
        Update: {
          base_price?: number
          created_at?: string
          id?: string
          is_active?: boolean
          package_id?: string
          parent_agent_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subagent_package_prices_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "data_packages"
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
      university_form_orders: {
        Row: {
          amount_paid: number
          created_at: string
          email: string
          form_type_id: string
          form_type_name: string
          full_name: string
          id: string
          phone: string
          reference: string
          school_id: string
          school_name: string
          status: string
          user_id: string
        }
        Insert: {
          amount_paid: number
          created_at?: string
          email: string
          form_type_id: string
          form_type_name: string
          full_name: string
          id?: string
          phone: string
          reference: string
          school_id: string
          school_name: string
          status?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          email?: string
          form_type_id?: string
          form_type_name?: string
          full_name?: string
          id?: string
          phone?: string
          reference?: string
          school_id?: string
          school_name?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_form_orders_form_type_id_fkey"
            columns: ["form_type_id"]
            isOneToOne: false
            referencedRelation: "university_form_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "university_form_orders_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "university_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      university_form_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          price: number
          school_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          price?: number
          school_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_form_types_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "university_schools"
            referencedColumns: ["id"]
          },
        ]
      }
      university_schools: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          is_published: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_published?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          is_published?: boolean
          name?: string
        }
        Relationships: []
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
      generate_manual_topup_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_suspicious_email: { Args: { _email: string }; Returns: boolean }
    }
    Enums: {
      app_role: "user" | "agent" | "admin" | "sub_agent"
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
      app_role: ["user", "agent", "admin", "sub_agent"],
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
