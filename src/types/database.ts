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
      assets: {
        Row: {
          byte_size: number | null;
          client_filename: string | null;
          created_at: string;
          created_by: string;
          declared_byte_size: number | null;
          declared_mime_type: string | null;
          failure_code: string | null;
          id: string;
          metadata: Json;
          organization_id: string;
          processed_at: string | null;
          project_id: string;
          sha256: string | null;
          status: Database["public"]["Enums"]["asset_status"];
          storage_key: string;
          updated_at: string;
          verified_mime_type: string | null;
        };
        Insert: {
          byte_size?: number | null;
          client_filename?: string | null;
          created_at?: string;
          created_by: string;
          declared_byte_size?: number | null;
          declared_mime_type?: string | null;
          failure_code?: string | null;
          id?: string;
          metadata?: Json;
          organization_id: string;
          processed_at?: string | null;
          project_id: string;
          sha256?: string | null;
          status?: Database["public"]["Enums"]["asset_status"];
          storage_key: string;
          updated_at?: string;
          verified_mime_type?: string | null;
        };
        Update: {
          byte_size?: number | null;
          client_filename?: string | null;
          created_at?: string;
          created_by?: string;
          declared_byte_size?: number | null;
          declared_mime_type?: string | null;
          failure_code?: string | null;
          id?: string;
          metadata?: Json;
          organization_id?: string;
          processed_at?: string | null;
          project_id?: string;
          sha256?: string | null;
          status?: Database["public"]["Enums"]["asset_status"];
          storage_key?: string;
          updated_at?: string;
          verified_mime_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "assets_project_org_fkey";
            columns: ["project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      audit_events: {
        Row: {
          asset_id: string | null;
          created_at: string;
          created_by: string;
          declaration_id: string | null;
          declaration_version_id: string | null;
          id: string;
          kind: Database["public"]["Enums"]["audit_event_kind"];
          metadata: Json;
          organization_id: string;
          project_id: string | null;
        };
        Insert: {
          asset_id?: string | null;
          created_at?: string;
          created_by: string;
          declaration_id?: string | null;
          declaration_version_id?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["audit_event_kind"];
          metadata?: Json;
          organization_id: string;
          project_id?: string | null;
        };
        Update: {
          asset_id?: string | null;
          created_at?: string;
          created_by?: string;
          declaration_id?: string | null;
          declaration_version_id?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["audit_event_kind"];
          metadata?: Json;
          organization_id?: string;
          project_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_events_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
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
      evidence_events: {
        Row: {
          actor: string;
          asset_id: string;
          canonicalization_version: string;
          created_at: string;
          declaration_id: string | null;
          declaration_version_id: string | null;
          event_at: string;
          event_hash: string;
          event_payload: Json;
          event_type: Database["public"]["Enums"]["evidence_event_type"];
          hash_version: string;
          id: string;
          organization_id: string;
          previous_hash: string;
          project_id: string;
          sequence: number;
        };
        Insert: {
          actor: string;
          asset_id: string;
          canonicalization_version?: string;
          created_at?: string;
          declaration_id?: string | null;
          declaration_version_id?: string | null;
          event_at: string;
          event_hash: string;
          event_payload?: Json;
          event_type: Database["public"]["Enums"]["evidence_event_type"];
          hash_version?: string;
          id?: string;
          organization_id: string;
          previous_hash: string;
          project_id: string;
          sequence: number;
        };
        Update: {
          actor?: string;
          asset_id?: string;
          canonicalization_version?: string;
          created_at?: string;
          declaration_id?: string | null;
          declaration_version_id?: string | null;
          event_at?: string;
          event_hash?: string;
          event_payload?: Json;
          event_type?: Database["public"]["Enums"]["evidence_event_type"];
          hash_version?: string;
          id?: string;
          organization_id?: string;
          previous_hash?: string;
          project_id?: string;
          sequence?: number;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_events_asset_org_fkey";
            columns: ["asset_id", "project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id", "project_id", "organization_id"];
          },
        ];
      };
      evidence_exports: {
        Row: {
          asset_id: string;
          chain_head_event_hash: string | null;
          chain_head_event_id: string | null;
          chain_head_sequence: number | null;
          content_sha256: string;
          created_at: string;
          created_by: string;
          declaration_id: string;
          declaration_version_id: string;
          format: Database["public"]["Enums"]["evidence_export_format"];
          generated_at: string;
          id: string;
          includes_raw_prompt: boolean;
          organization_id: string;
          project_id: string;
          schema_version: string;
          storage_key: string;
        };
        Insert: {
          asset_id: string;
          chain_head_event_hash?: string | null;
          chain_head_event_id?: string | null;
          chain_head_sequence?: number | null;
          content_sha256: string;
          created_at?: string;
          created_by: string;
          declaration_id: string;
          declaration_version_id: string;
          format: Database["public"]["Enums"]["evidence_export_format"];
          generated_at?: string;
          id?: string;
          includes_raw_prompt?: boolean;
          organization_id: string;
          project_id: string;
          schema_version: string;
          storage_key: string;
        };
        Update: {
          asset_id?: string;
          chain_head_event_hash?: string | null;
          chain_head_event_id?: string | null;
          chain_head_sequence?: number | null;
          content_sha256?: string;
          created_at?: string;
          created_by?: string;
          declaration_id?: string;
          declaration_version_id?: string;
          format?: Database["public"]["Enums"]["evidence_export_format"];
          generated_at?: string;
          id?: string;
          includes_raw_prompt?: boolean;
          organization_id?: string;
          project_id?: string;
          schema_version?: string;
          storage_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_exports_asset_org_fkey";
            columns: ["asset_id", "project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id", "project_id", "organization_id"];
          },
          {
            foreignKeyName: "evidence_exports_chain_head_fkey";
            columns: ["chain_head_event_id"];
            isOneToOne: false;
            referencedRelation: "evidence_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_exports_declaration_org_fkey";
            columns: ["declaration_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "provenance_declarations";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "evidence_exports_version_org_fkey";
            columns: [
              "declaration_version_id",
              "declaration_id",
              "organization_id",
            ];
            isOneToOne: false;
            referencedRelation: "provenance_declaration_versions";
            referencedColumns: ["id", "declaration_id", "organization_id"];
          },
        ];
      };
      evidence_share_links: {
        Row: {
          created_at: string;
          created_by: string;
          evidence_export_id: string;
          expires_at: string | null;
          id: string;
          organization_id: string;
          revoked_at: string | null;
          status: Database["public"]["Enums"]["share_link_status"];
          token_hash: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          evidence_export_id: string;
          expires_at?: string | null;
          id?: string;
          organization_id: string;
          revoked_at?: string | null;
          status?: Database["public"]["Enums"]["share_link_status"];
          token_hash: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          evidence_export_id?: string;
          expires_at?: string | null;
          id?: string;
          organization_id?: string;
          revoked_at?: string | null;
          status?: Database["public"]["Enums"]["share_link_status"];
          token_hash?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_share_links_export_org_fkey";
            columns: ["evidence_export_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "evidence_exports";
            referencedColumns: ["id", "organization_id"];
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
      projects: {
        Row: {
          created_at: string;
          created_by: string;
          id: string;
          name: string;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      provenance_assessments: {
        Row: {
          asset_id: string;
          created_at: string;
          created_by: string;
          declaration_id: string;
          declaration_version_id: string;
          human_review_notice: string;
          id: string;
          interpolation_data: Json;
          organization_id: string;
          project_id: string;
          reason_codes: string[];
          recommendation_level: string;
          ruleset_version: string;
          status: Database["public"]["Enums"]["assessment_status"];
          template_id: string;
          visible_disclosure_text: string;
        };
        Insert: {
          asset_id: string;
          created_at?: string;
          created_by: string;
          declaration_id: string;
          declaration_version_id: string;
          human_review_notice: string;
          id?: string;
          interpolation_data?: Json;
          organization_id: string;
          project_id: string;
          reason_codes: string[];
          recommendation_level: string;
          ruleset_version: string;
          status?: Database["public"]["Enums"]["assessment_status"];
          template_id: string;
          visible_disclosure_text: string;
        };
        Update: {
          asset_id?: string;
          created_at?: string;
          created_by?: string;
          declaration_id?: string;
          declaration_version_id?: string;
          human_review_notice?: string;
          id?: string;
          interpolation_data?: Json;
          organization_id?: string;
          project_id?: string;
          reason_codes?: string[];
          recommendation_level?: string;
          ruleset_version?: string;
          status?: Database["public"]["Enums"]["assessment_status"];
          template_id?: string;
          visible_disclosure_text?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provenance_assessments_asset_org_fkey";
            columns: ["asset_id", "project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id", "project_id", "organization_id"];
          },
          {
            foreignKeyName: "provenance_assessments_declaration_org_fkey";
            columns: ["declaration_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "provenance_declarations";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "provenance_assessments_version_org_fkey";
            columns: [
              "declaration_version_id",
              "declaration_id",
              "organization_id",
            ];
            isOneToOne: false;
            referencedRelation: "provenance_declaration_versions";
            referencedColumns: ["id", "declaration_id", "organization_id"];
          },
        ];
      };
      provenance_declaration_versions: {
        Row: {
          asset_id: string;
          created_at: string;
          created_by: string;
          declaration_id: string;
          id: string;
          organization_id: string;
          payload: Json;
          project_id: string;
          raw_prompt: string | null;
          raw_prompt_capture_enabled: boolean;
          status: Database["public"]["Enums"]["declaration_version_status"];
          superseded_from_id: string | null;
          updated_at: string;
          version_number: number;
        };
        Insert: {
          asset_id: string;
          created_at?: string;
          created_by: string;
          declaration_id: string;
          id?: string;
          organization_id: string;
          payload?: Json;
          project_id: string;
          raw_prompt?: string | null;
          raw_prompt_capture_enabled?: boolean;
          status?: Database["public"]["Enums"]["declaration_version_status"];
          superseded_from_id?: string | null;
          updated_at?: string;
          version_number: number;
        };
        Update: {
          asset_id?: string;
          created_at?: string;
          created_by?: string;
          declaration_id?: string;
          id?: string;
          organization_id?: string;
          payload?: Json;
          project_id?: string;
          raw_prompt?: string | null;
          raw_prompt_capture_enabled?: boolean;
          status?: Database["public"]["Enums"]["declaration_version_status"];
          superseded_from_id?: string | null;
          updated_at?: string;
          version_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "provenance_declaration_versions_asset_org_fkey";
            columns: ["asset_id", "project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id", "project_id", "organization_id"];
          },
          {
            foreignKeyName: "provenance_declaration_versions_declaration_org_fkey";
            columns: ["declaration_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "provenance_declarations";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "provenance_declaration_versions_superseded_from_fkey";
            columns: ["superseded_from_id"];
            isOneToOne: false;
            referencedRelation: "provenance_declaration_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      provenance_declarations: {
        Row: {
          asset_id: string;
          created_at: string;
          created_by: string;
          current_version_id: string | null;
          id: string;
          organization_id: string;
          project_id: string;
          updated_at: string;
        };
        Insert: {
          asset_id: string;
          created_at?: string;
          created_by: string;
          current_version_id?: string | null;
          id?: string;
          organization_id: string;
          project_id: string;
          updated_at?: string;
        };
        Update: {
          asset_id?: string;
          created_at?: string;
          created_by?: string;
          current_version_id?: string | null;
          id?: string;
          organization_id?: string;
          project_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provenance_declarations_asset_org_fkey";
            columns: ["asset_id", "project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id", "project_id", "organization_id"];
          },
          {
            foreignKeyName: "provenance_declarations_current_version_fkey";
            columns: ["current_version_id"];
            isOneToOne: false;
            referencedRelation: "provenance_declaration_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      provenance_reviews: {
        Row: {
          asset_id: string;
          created_at: string;
          created_by: string;
          decision: Database["public"]["Enums"]["review_decision"];
          declaration_id: string;
          declaration_version_id: string;
          id: string;
          notes: string | null;
          organization_id: string;
          project_id: string;
        };
        Insert: {
          asset_id: string;
          created_at?: string;
          created_by: string;
          decision: Database["public"]["Enums"]["review_decision"];
          declaration_id: string;
          declaration_version_id: string;
          id?: string;
          notes?: string | null;
          organization_id: string;
          project_id: string;
        };
        Update: {
          asset_id?: string;
          created_at?: string;
          created_by?: string;
          decision?: Database["public"]["Enums"]["review_decision"];
          declaration_id?: string;
          declaration_version_id?: string;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "provenance_reviews_asset_org_fkey";
            columns: ["asset_id", "project_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id", "project_id", "organization_id"];
          },
          {
            foreignKeyName: "provenance_reviews_version_org_fkey";
            columns: [
              "declaration_version_id",
              "declaration_id",
              "organization_id",
            ];
            isOneToOne: false;
            referencedRelation: "provenance_declaration_versions";
            referencedColumns: ["id", "declaration_id", "organization_id"];
          },
        ];
      };
      share_rate_limits: {
        Row: {
          key_hash: string;
          request_count: number;
          window_start: string;
        };
        Insert: {
          key_hash: string;
          request_count?: number;
          window_start: string;
        };
        Update: {
          key_hash?: string;
          request_count?: number;
          window_start?: string;
        };
        Relationships: [];
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
      apply_declaration_transition: {
        Args: {
          p_action: string;
          p_asset_id: string;
          p_declaration_version_id: string;
          p_expected_status: Database["public"]["Enums"]["declaration_version_status"];
          p_notes: string;
        };
        Returns: Json;
      };
      consume_share_rate_limit: {
        Args: { p_key_hash: string; p_max: number; p_window_seconds: number };
        Returns: Json;
      };
      create_organization: { Args: { p_name: string }; Returns: string };
      dblink: { Args: { "": string }; Returns: Record<string, unknown>[] };
      dblink_cancel_query: { Args: { "": string }; Returns: string };
      dblink_close: { Args: { "": string }; Returns: string };
      dblink_connect: { Args: { "": string }; Returns: string };
      dblink_connect_u: { Args: { "": string }; Returns: string };
      dblink_current_query: { Args: never; Returns: string };
      dblink_disconnect:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string };
      dblink_error_message: { Args: { "": string }; Returns: string };
      dblink_exec: { Args: { "": string }; Returns: string };
      dblink_fdw_validator: {
        Args: { catalog: unknown; options: string[] };
        Returns: undefined;
      };
      dblink_get_connections: { Args: never; Returns: string[] };
      dblink_get_notify:
        | { Args: { conname: string }; Returns: Record<string, unknown>[] }
        | { Args: never; Returns: Record<string, unknown>[] };
      dblink_get_pkey: {
        Args: { "": string };
        Returns: Database["public"]["CompositeTypes"]["dblink_pkey_results"][];
        SetofOptions: {
          from: "*";
          to: "dblink_pkey_results";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      dblink_get_result: {
        Args: { "": string };
        Returns: Record<string, unknown>[];
      };
      dblink_is_busy: { Args: { "": string }; Returns: number };
    };
    Enums: {
      assessment_status: "current" | "superseded" | "invalidated";
      asset_status:
        | "pending_upload"
        | "uploaded"
        | "processing"
        | "ready"
        | "processing_failed";
      audit_event_kind:
        | "declaration_created"
        | "declaration_version_created"
        | "assessment_generated"
        | "assessment_invalidated"
        | "assessment_superseded"
        | "declaration_reviewed"
        | "evidence_packet_generated"
        | "share_link_created"
        | "share_link_revoked";
      declaration_version_status:
        | "draft"
        | "pending_review"
        | "reviewed"
        | "changes_requested"
        | "rejected";
      document_status: "uploaded" | "attached" | "superseded";
      evidence_event_type:
        | "declaration_submitted"
        | "review_approved"
        | "review_rejected"
        | "changes_requested"
        | "changes_responded";
      evidence_export_format: "json" | "pdf";
      invitation_status: "pending" | "accepted" | "expired" | "revoked";
      lot_status: "draft" | "active" | "published" | "archived";
      membership_role: "owner" | "admin" | "operator" | "viewer" | "reviewer";
      membership_status: "invited" | "active" | "expired" | "revoked";
      origin_event_kind:
        "received" | "processed" | "transferred" | "documented";
      origin_event_status: "recorded" | "superseded";
      review_decision: "accepted" | "returned" | "rejected";
      share_link_status: "active" | "revoked";
      subscription_status: "incomplete" | "active" | "past_due" | "canceled";
    };
    CompositeTypes: {
      dblink_pkey_results: {
        position: number | null;
        colname: string | null;
      };
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
      assessment_status: ["current", "superseded", "invalidated"],
      asset_status: [
        "pending_upload",
        "uploaded",
        "processing",
        "ready",
        "processing_failed",
      ],
      audit_event_kind: [
        "declaration_created",
        "declaration_version_created",
        "assessment_generated",
        "assessment_invalidated",
        "assessment_superseded",
        "declaration_reviewed",
        "evidence_packet_generated",
        "share_link_created",
        "share_link_revoked",
      ],
      declaration_version_status: [
        "draft",
        "pending_review",
        "reviewed",
        "changes_requested",
        "rejected",
      ],
      document_status: ["uploaded", "attached", "superseded"],
      evidence_event_type: [
        "declaration_submitted",
        "review_approved",
        "review_rejected",
        "changes_requested",
        "changes_responded",
      ],
      evidence_export_format: ["json", "pdf"],
      invitation_status: ["pending", "accepted", "expired", "revoked"],
      lot_status: ["draft", "active", "published", "archived"],
      membership_role: ["owner", "admin", "operator", "viewer", "reviewer"],
      membership_status: ["invited", "active", "expired", "revoked"],
      origin_event_kind: ["received", "processed", "transferred", "documented"],
      origin_event_status: ["recorded", "superseded"],
      review_decision: ["accepted", "returned", "rejected"],
      share_link_status: ["active", "revoked"],
      subscription_status: ["incomplete", "active", "past_due", "canceled"],
    },
  },
} as const;
