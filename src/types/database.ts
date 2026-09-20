export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      documents: {
        Row: {
          byte_size: number | null;
          content_type: string | null;
          created_at: string;
          created_by: string;
          file_name: string;
          id: string;
          is_publishable: boolean;
          lot_id: string | null;
          organization_id: string;
          origin_event_id: string | null;
          status: Database["public"]["Enums"]["document_status"];
          storage_path: string;
          updated_at: string;
        };
        Insert: {
          byte_size?: number | null;
          content_type?: string | null;
          created_at?: string;
          created_by: string;
          file_name: string;
          id?: string;
          is_publishable?: boolean;
          lot_id?: string | null;
          organization_id: string;
          origin_event_id?: string | null;
          status?: Database["public"]["Enums"]["document_status"];
          storage_path: string;
          updated_at?: string;
        };
        Update: {
          byte_size?: number | null;
          content_type?: string | null;
          created_at?: string;
          created_by?: string;
          file_name?: string;
          id?: string;
          is_publishable?: boolean;
          lot_id?: string | null;
          organization_id?: string;
          origin_event_id?: string | null;
          status?: Database["public"]["Enums"]["document_status"];
          storage_path?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_event_org_fkey";
            columns: ["origin_event_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "origin_events";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "documents_lot_org_fkey";
            columns: ["lot_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "lots";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "documents_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          accepted_by: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          organization_id: string;
          role: Database["public"]["Enums"]["membership_role"];
          status: Database["public"]["Enums"]["invitation_status"];
          updated_at: string;
        };
        Insert: {
          accepted_by?: string | null;
          created_at?: string;
          email: string;
          expires_at: string;
          id?: string;
          invited_by: string;
          organization_id: string;
          role: Database["public"]["Enums"]["membership_role"];
          status?: Database["public"]["Enums"]["invitation_status"];
          updated_at?: string;
        };
        Update: {
          accepted_by?: string | null;
          created_at?: string;
          email?: string;
          expires_at?: string;
          id?: string;
          invited_by?: string;
          organization_id?: string;
          role?: Database["public"]["Enums"]["membership_role"];
          status?: Database["public"]["Enums"]["invitation_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      lots: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          lot_code: string;
          organization_id: string;
          product_id: string;
          status: Database["public"]["Enums"]["lot_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          lot_code: string;
          organization_id: string;
          product_id: string;
          status?: Database["public"]["Enums"]["lot_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          lot_code?: string;
          organization_id?: string;
          product_id?: string;
          status?: Database["public"]["Enums"]["lot_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lots_product_org_fkey";
            columns: ["product_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      memberships: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          role: Database["public"]["Enums"]["membership_role"];
          status: Database["public"]["Enums"]["membership_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          organization_id: string;
          role: Database["public"]["Enums"]["membership_role"];
          status?: Database["public"]["Enums"]["membership_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          role?: Database["public"]["Enums"]["membership_role"];
          status?: Database["public"]["Enums"]["membership_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      origin_events: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          is_publishable: boolean;
          kind: Database["public"]["Enums"]["origin_event_kind"];
          lot_id: string;
          occurred_at: string;
          organization_id: string;
          payload: Json;
          status: Database["public"]["Enums"]["origin_event_status"];
          superseded_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          is_publishable?: boolean;
          kind: Database["public"]["Enums"]["origin_event_kind"];
          lot_id: string;
          occurred_at?: string;
          organization_id: string;
          payload?: Json;
          status?: Database["public"]["Enums"]["origin_event_status"];
          superseded_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          is_publishable?: boolean;
          kind?: Database["public"]["Enums"]["origin_event_kind"];
          lot_id?: string;
          occurred_at?: string;
          organization_id?: string;
          payload?: Json;
          status?: Database["public"]["Enums"]["origin_event_status"];
          superseded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "origin_events_lot_org_fkey";
            columns: ["lot_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "lots";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "origin_events_superseded_by_fkey";
            columns: ["superseded_by"];
            isOneToOne: false;
            referencedRelation: "origin_events";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          organization_id: string;
          sku: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          organization_id: string;
          sku?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          organization_id?: string;
          sku?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          created_at: string;
          current_period_end: string | null;
          id: string;
          organization_id: string;
          status: Database["public"]["Enums"]["subscription_status"];
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          organization_id: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          organization_id?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      verification_publications: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          lot_id: string;
          organization_id: string;
          public_token: string;
          published_at: string;
          unpublished_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          lot_id: string;
          organization_id: string;
          public_token: string;
          published_at?: string;
          unpublished_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          lot_id?: string;
          organization_id?: string;
          public_token?: string;
          published_at?: string;
          unpublished_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "verification_publications_lot_org_fkey";
            columns: ["lot_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "lots";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      document_status: "uploaded" | "attached" | "superseded";
      invitation_status: "pending" | "accepted" | "expired" | "revoked";
      lot_status: "draft" | "active" | "published" | "archived";
      membership_role: "owner" | "admin" | "operator" | "viewer";
      membership_status: "invited" | "active" | "expired" | "revoked";
      origin_event_kind:
        "received" | "processed" | "transferred" | "documented";
      origin_event_status: "recorded" | "superseded";
      subscription_status: "incomplete" | "active" | "past_due" | "canceled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      document_status: ["uploaded", "attached", "superseded"],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      lot_status: ["draft", "active", "published", "archived"],
      membership_role: ["owner", "admin", "operator", "viewer"],
      membership_status: ["invited", "active", "expired", "revoked"],
      origin_event_kind: ["received", "processed", "transferred", "documented"],
      origin_event_status: ["recorded", "superseded"],
      subscription_status: ["incomplete", "active", "past_due", "canceled"],
    },
  },
} as const;
