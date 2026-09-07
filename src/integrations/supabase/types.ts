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
      ai_memories: {
        Row: {
          category: string
          content: string
          created_at: string | null
          id: string
          related_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          id?: string
          related_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          id?: string
          related_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      asaas_integrations: {
        Row: {
          access_token: string
          created_at: string
          environment: string
          id: string
          last_error: string | null
          last_tested_at: string | null
          notification_email: string | null
          owner_id: string | null
          owner_type: string
          pix_key: string
          status: string
          updated_at: string
          webhook_id: string | null
          webhook_token: string
          webhook_url: string | null
        }
        Insert: {
          access_token: string
          created_at?: string
          environment?: string
          id?: string
          last_error?: string | null
          last_tested_at?: string | null
          notification_email?: string | null
          owner_id?: string | null
          owner_type?: string
          pix_key: string
          status?: string
          updated_at?: string
          webhook_id?: string | null
          webhook_token: string
          webhook_url?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string
          environment?: string
          id?: string
          last_error?: string | null
          last_tested_at?: string | null
          notification_email?: string | null
          owner_id?: string | null
          owner_type?: string
          pix_key?: string
          status?: string
          updated_at?: string
          webhook_id?: string | null
          webhook_token?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          access_email: string | null
          active: boolean
          address: string | null
          ai_usage_last_reset_at: string | null
          ai_usage_today: number
          city: string | null
          company_id: string
          contact_phone: string | null
          created_at: string
          daily_reset_time: string
          document: string | null
          id: string
          is_headquarters: boolean
          legal_name: string | null
          logo_url: string | null
          name: string
          neighborhood: string | null
          portal_slug: string
          registration_status: string | null
          reseller_id: string | null
          state: string | null
          trade_name: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          access_email?: string | null
          active?: boolean
          address?: string | null
          ai_usage_last_reset_at?: string | null
          ai_usage_today?: number
          city?: string | null
          company_id: string
          contact_phone?: string | null
          created_at?: string
          daily_reset_time?: string
          document?: string | null
          id?: string
          is_headquarters?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name: string
          neighborhood?: string | null
          portal_slug: string
          registration_status?: string | null
          reseller_id?: string | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          access_email?: string | null
          active?: boolean
          address?: string | null
          ai_usage_last_reset_at?: string | null
          ai_usage_today?: number
          city?: string | null
          company_id?: string
          contact_phone?: string | null
          created_at?: string
          daily_reset_time?: string
          document?: string | null
          id?: string
          is_headquarters?: boolean
          legal_name?: string | null
          logo_url?: string | null
          name?: string
          neighborhood?: string | null
          portal_slug?: string
          registration_status?: string | null
          reseller_id?: string | null
          state?: string | null
          trade_name?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branches_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_sponsors: {
        Row: {
          active: boolean
          banner_path: string | null
          campaign_id: string
          created_at: string
          display_type: string
          id: string
          link_url: string | null
          logo_path: string | null
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          banner_path?: string | null
          campaign_id: string
          created_at?: string
          display_type?: string
          id?: string
          link_url?: string | null
          logo_path?: string | null
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          banner_path?: string | null
          campaign_id?: string
          created_at?: string
          display_type?: string
          id?: string
          link_url?: string | null
          logo_path?: string | null
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_sponsors_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          accent_color: string | null
          autoplay_enabled: boolean | null
          background_type: string | null
          background_value: string | null
          banner_overlay_opacity: number | null
          banner_urls: string[]
          branch_id: string | null
          button_text: string | null
          company_id: string
          created_at: string
          description: string | null
          ended_at: string | null
          event_id: string | null
          id: string
          logo_position: string | null
          logo_url: string | null
          name: string
          primary_color: string | null
          quick_info_1: string | null
          quick_info_2: string | null
          quick_info_3: string | null
          redirect_url: string | null
          reseller_id: string | null
          show_arrows: boolean | null
          show_indicators: boolean | null
          show_progress_bar: boolean | null
          started_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
          visual_style: string | null
        }
        Insert: {
          accent_color?: string | null
          autoplay_enabled?: boolean | null
          background_type?: string | null
          background_value?: string | null
          banner_overlay_opacity?: number | null
          banner_urls?: string[]
          branch_id?: string | null
          button_text?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          ended_at?: string | null
          event_id?: string | null
          id?: string
          logo_position?: string | null
          logo_url?: string | null
          name: string
          primary_color?: string | null
          quick_info_1?: string | null
          quick_info_2?: string | null
          quick_info_3?: string | null
          redirect_url?: string | null
          reseller_id?: string | null
          show_arrows?: boolean | null
          show_indicators?: boolean | null
          show_progress_bar?: boolean | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
          visual_style?: string | null
        }
        Update: {
          accent_color?: string | null
          autoplay_enabled?: boolean | null
          background_type?: string | null
          background_value?: string | null
          banner_overlay_opacity?: number | null
          banner_urls?: string[]
          branch_id?: string | null
          button_text?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          ended_at?: string | null
          event_id?: string | null
          id?: string
          logo_position?: string | null
          logo_url?: string | null
          name?: string
          primary_color?: string | null
          quick_info_1?: string | null
          quick_info_2?: string | null
          quick_info_3?: string | null
          redirect_url?: string | null
          reseller_id?: string | null
          show_arrows?: boolean | null
          show_indicators?: boolean | null
          show_progress_bar?: boolean | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
          visual_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          message_id: string
          mime_type: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_path: string
          file_size: number
          id?: string
          message_id: string
          mime_type: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          message_id?: string
          mime_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_receipts: {
        Row: {
          delivered_at: string | null
          message_id: string
          read_at: string | null
          recipient_profile_id: string
          updated_at: string
        }
        Insert: {
          delivered_at?: string | null
          message_id: string
          read_at?: string | null
          recipient_profile_id: string
          updated_at?: string
        }
        Update: {
          delivered_at?: string | null
          message_id?: string
          read_at?: string | null
          recipient_profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_user_presence: {
        Row: {
          last_seen_at: string
          now_playing: string | null
          status: Database["public"]["Enums"]["user_presence_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          now_playing?: string | null
          status?: Database["public"]["Enums"]["user_presence_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          now_playing?: string | null
          status?: Database["public"]["Enums"]["user_presence_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          access_email: string | null
          activated_at: string | null
          activation_limit: number
          address: string | null
          ai_daily_command_limit: number
          ai_insights_cache: Json | null
          ai_insights_updated_at: string | null
          ai_usage_last_reset_at: string
          ai_usage_today: number
          asaas_customer_id: string | null
          blocked: boolean
          business_description: string | null
          business_segment: string | null
          city: string | null
          cnae_code: string | null
          cnae_description: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          document: string | null
          due_day: number | null
          id: string
          legal_name: string | null
          logo_url: string | null
          monthly_price: number
          name: string
          neighborhood: string | null
          notes: string | null
          plan_name: string
          portal_active: boolean | null
          portal_slug: string | null
          registration_status: string | null
          reseller_id: string | null
          segment: string | null
          slug: string
          state: string | null
          status: Database["public"]["Enums"]["company_status"]
          subscription_status: string
          trade_name: string | null
          updated_at: string
          wifi_marketing_goal: string | null
          zip_code: string | null
        }
        Insert: {
          access_email?: string | null
          activated_at?: string | null
          activation_limit?: number
          address?: string | null
          ai_daily_command_limit?: number
          ai_insights_cache?: Json | null
          ai_insights_updated_at?: string | null
          ai_usage_last_reset_at?: string
          ai_usage_today?: number
          asaas_customer_id?: string | null
          blocked?: boolean
          business_description?: string | null
          business_segment?: string | null
          city?: string | null
          cnae_code?: string | null
          cnae_description?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          document?: string | null
          due_day?: number | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          monthly_price?: number
          name: string
          neighborhood?: string | null
          notes?: string | null
          plan_name?: string
          portal_active?: boolean | null
          portal_slug?: string | null
          registration_status?: string | null
          reseller_id?: string | null
          segment?: string | null
          slug: string
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          subscription_status?: string
          trade_name?: string | null
          updated_at?: string
          wifi_marketing_goal?: string | null
          zip_code?: string | null
        }
        Update: {
          access_email?: string | null
          activated_at?: string | null
          activation_limit?: number
          address?: string | null
          ai_daily_command_limit?: number
          ai_insights_cache?: Json | null
          ai_insights_updated_at?: string | null
          ai_usage_last_reset_at?: string
          ai_usage_today?: number
          asaas_customer_id?: string | null
          blocked?: boolean
          business_description?: string | null
          business_segment?: string | null
          city?: string | null
          cnae_code?: string | null
          cnae_description?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          document?: string | null
          due_day?: number | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
          monthly_price?: number
          name?: string
          neighborhood?: string | null
          notes?: string | null
          plan_name?: string
          portal_active?: boolean | null
          portal_slug?: string | null
          registration_status?: string | null
          reseller_id?: string | null
          segment?: string | null
          slug?: string
          state?: string | null
          status?: Database["public"]["Enums"]["company_status"]
          subscription_status?: string
          trade_name?: string | null
          updated_at?: string
          wifi_marketing_goal?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      company_charges: {
        Row: {
          amount: number
          asaas_last_event_id: string | null
          asaas_payment_id: string | null
          asaas_pix_copy_paste: string | null
          asaas_pix_qr_code: string | null
          company_id: string
          competence: string | null
          created_at: string
          due_date: string
          external_id: string | null
          id: string
          method: string | null
          notes: string | null
          paid_at: string | null
          pix_payload: string | null
          receipt_code: string
          reference: string
          reseller_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          asaas_last_event_id?: string | null
          asaas_payment_id?: string | null
          asaas_pix_copy_paste?: string | null
          asaas_pix_qr_code?: string | null
          company_id: string
          competence?: string | null
          created_at?: string
          due_date: string
          external_id?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string | null
          pix_payload?: string | null
          receipt_code?: string
          reference?: string
          reseller_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          asaas_last_event_id?: string | null
          asaas_payment_id?: string | null
          asaas_pix_copy_paste?: string | null
          asaas_pix_qr_code?: string | null
          company_id?: string
          competence?: string | null
          created_at?: string
          due_date?: string
          external_id?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          paid_at?: string | null
          pix_payload?: string | null
          receipt_code?: string
          reference?: string
          reseller_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_charges_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_charges_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      company_operational_analyses: {
        Row: {
          analysis_date: string
          company_id: string
          created_at: string | null
          generated_at: string | null
          id: string
          indicators: Json | null
          operations_snapshot: Json | null
          source: string | null
          status: string
          summary: Json | null
          updated_at: string | null
        }
        Insert: {
          analysis_date: string
          company_id: string
          created_at?: string | null
          generated_at?: string | null
          id?: string
          indicators?: Json | null
          operations_snapshot?: Json | null
          source?: string | null
          status?: string
          summary?: Json | null
          updated_at?: string | null
        }
        Update: {
          analysis_date?: string
          company_id?: string
          created_at?: string | null
          generated_at?: string | null
          id?: string
          indicators?: Json | null
          operations_snapshot?: Json | null
          source?: string | null
          status?: string
          summary?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_operational_analyses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          ap_mac: string | null
          branch_id: string | null
          campaign_id: string | null
          company_id: string
          created_at: string
          device_type: string | null
          event_id: string | null
          id: string
          ip_address: string | null
          is_returning: boolean
          mac_address: string | null
          period_date: string
          reseller_id: string | null
          user_agent: string | null
          visitor_id: string
        }
        Insert: {
          ap_mac?: string | null
          branch_id?: string | null
          campaign_id?: string | null
          company_id: string
          created_at?: string
          device_type?: string | null
          event_id?: string | null
          id?: string
          ip_address?: string | null
          is_returning?: boolean
          mac_address?: string | null
          period_date?: string
          reseller_id?: string | null
          user_agent?: string | null
          visitor_id: string
        }
        Update: {
          ap_mac?: string | null
          branch_id?: string | null
          campaign_id?: string | null
          company_id?: string
          created_at?: string
          device_type?: string | null
          event_id?: string | null
          id?: string
          ip_address?: string | null
          is_returning?: boolean
          mac_address?: string | null
          period_date?: string
          reseller_id?: string | null
          user_agent?: string | null
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          branch_id: string | null
          conversation_id: string
          created_at: string
          id: string
          participant_type: string
          profile_id: string | null
        }
        Insert: {
          branch_id?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          participant_type: string
          profile_id?: string | null
        }
        Update: {
          branch_id?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          participant_type?: string
          profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_user_preferences: {
        Row: {
          conversation_id: string
          hidden_at: string | null
          history_cleared_at: string | null
          is_pinned: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          hidden_at?: string | null
          history_cleared_at?: string | null
          is_pinned?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          hidden_at?: string | null
          history_cleared_at?: string | null
          is_pinned?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_user_preferences_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          last_message_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_activities: {
        Row: {
          activity_type: string
          author_id: string | null
          company_id: string
          created_at: string
          id: string
          lead_id: string
          metadata: Json
          note: string | null
        }
        Insert: {
          activity_type: string
          author_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          lead_id: string
          metadata?: Json
          note?: string | null
        }
        Update: {
          activity_type?: string
          author_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          lead_id?: string
          metadata?: Json
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_activities_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          assigned_to: string | null
          campaign_id: string | null
          company_id: string
          consent_version: string | null
          converted_at: string | null
          created_at: string
          do_not_contact: boolean
          id: string
          last_contacted_at: string | null
          next_action_at: string | null
          source_branch_id: string | null
          source_event_id: string | null
          stage: string
          updated_at: string
          visitor_id: string
          whatsapp_opt_in: boolean
          whatsapp_opt_in_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          campaign_id?: string | null
          company_id: string
          consent_version?: string | null
          converted_at?: string | null
          created_at?: string
          do_not_contact?: boolean
          id?: string
          last_contacted_at?: string | null
          next_action_at?: string | null
          source_branch_id?: string | null
          source_event_id?: string | null
          stage?: string
          updated_at?: string
          visitor_id: string
          whatsapp_opt_in?: boolean
          whatsapp_opt_in_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string | null
          company_id?: string
          consent_version?: string | null
          converted_at?: string | null
          created_at?: string
          do_not_contact?: boolean
          id?: string
          last_contacted_at?: string | null
          next_action_at?: string | null
          source_branch_id?: string | null
          source_event_id?: string | null
          stage?: string
          updated_at?: string
          visitor_id?: string
          whatsapp_opt_in?: boolean
          whatsapp_opt_in_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_source_branch_id_fkey"
            columns: ["source_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_source_event_id_fkey"
            columns: ["source_event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          company_id: string
          contracted_value: number
          cost_value: number
          created_at: string
          daily_reset_time: string
          ends_at: string | null
          id: string
          location: string | null
          name: string
          paid_value: number
          portal_slug: string
          reseller_id: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
        }
        Insert: {
          company_id: string
          contracted_value?: number
          cost_value?: number
          created_at?: string
          daily_reset_time?: string
          ends_at?: string | null
          id?: string
          location?: string | null
          name: string
          paid_value?: number
          portal_slug: string
          reseller_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
        }
        Update: {
          company_id?: string
          contracted_value?: number
          cost_value?: number
          created_at?: string
          daily_reset_time?: string
          ends_at?: string | null
          id?: string
          location?: string | null
          name?: string
          paid_value?: number
          portal_slug?: string
          reseller_id?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          branch_id: string | null
          category: string
          company_id: string
          competence: string
          created_at: string
          date: string
          description: string
          id: string
          observation: string | null
          payment_method: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          category: string
          company_id: string
          competence: string
          created_at?: string
          date?: string
          description: string
          id?: string
          observation?: string | null
          payment_method: string
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          category?: string
          company_id?: string
          competence?: string
          created_at?: string
          date?: string
          description?: string
          id?: string
          observation?: string | null
          payment_method?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      hotspot_configs: {
        Row: {
          ap_mac: string | null
          branch_id: string | null
          company_id: string
          config: Json
          created_at: string
          display_name: string | null
          download_kbps: number | null
          id: string
          idle_timeout_seconds: number | null
          integration_mode: string | null
          is_active: boolean
          last_test_status: string | null
          last_tested_at: string | null
          limit_source: string
          session_timeout_seconds: number | null
          ssid: string | null
          status: string
          updated_at: string
          upload_kbps: number | null
          vendor: Database["public"]["Enums"]["hotspot_vendor"]
        }
        Insert: {
          ap_mac?: string | null
          branch_id?: string | null
          company_id: string
          config?: Json
          created_at?: string
          display_name?: string | null
          download_kbps?: number | null
          id?: string
          idle_timeout_seconds?: number | null
          integration_mode?: string | null
          is_active?: boolean
          last_test_status?: string | null
          last_tested_at?: string | null
          limit_source?: string
          session_timeout_seconds?: number | null
          ssid?: string | null
          status?: string
          updated_at?: string
          upload_kbps?: number | null
          vendor?: Database["public"]["Enums"]["hotspot_vendor"]
        }
        Update: {
          ap_mac?: string | null
          branch_id?: string | null
          company_id?: string
          config?: Json
          created_at?: string
          display_name?: string | null
          download_kbps?: number | null
          id?: string
          idle_timeout_seconds?: number | null
          integration_mode?: string | null
          is_active?: boolean
          last_test_status?: string | null
          last_tested_at?: string | null
          limit_source?: string
          session_timeout_seconds?: number | null
          ssid?: string | null
          status?: string
          updated_at?: string
          upload_kbps?: number | null
          vendor?: Database["public"]["Enums"]["hotspot_vendor"]
        }
        Relationships: [
          {
            foreignKeyName: "hotspot_configs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotspot_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      image_generations: {
        Row: {
          branch_id: string | null
          company_id: string
          created_at: string
          id: string
          image_url: string | null
          prompt: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          company_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          prompt: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          prompt?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_generations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "image_generations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          client_message_id: string | null
          content: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          event: string | null
          id: string
          read_at: string | null
          reply_to_message_id: string | null
          sender_id: string
        }
        Insert: {
          client_message_id?: string | null
          content: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          event?: string | null
          id?: string
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_id: string
        }
        Update: {
          client_message_id?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          event?: string | null
          id?: string
          read_at?: string | null
          reply_to_message_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_ai_conversations: {
        Row: {
          created_at: string
          hidden_at: string | null
          id: string
          is_pinned: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hidden_at?: string | null
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hidden_at?: string | null
          id?: string
          is_pinned?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      operational_ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "operational_ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_alerts: {
        Row: {
          admin_note: string | null
          branch_id: string | null
          company_id: string
          contacted_at: string | null
          created_at: string | null
          detected_at: string | null
          evidence: Json
          fingerprint: string
          handled_by: string | null
          id: string
          last_seen_at: string | null
          recommendation: string | null
          resolved_at: string | null
          severity: string
          status: string
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          admin_note?: string | null
          branch_id?: string | null
          company_id: string
          contacted_at?: string | null
          created_at?: string | null
          detected_at?: string | null
          evidence: Json
          fingerprint: string
          handled_by?: string | null
          id?: string
          last_seen_at?: string | null
          recommendation?: string | null
          resolved_at?: string | null
          severity: string
          status?: string
          title: string
          type: string
          updated_at?: string | null
        }
        Update: {
          admin_note?: string | null
          branch_id?: string | null
          company_id?: string
          contacted_at?: string | null
          created_at?: string | null
          detected_at?: string | null
          evidence?: Json
          fingerprint?: string
          handled_by?: string | null
          id?: string
          last_seen_at?: string | null
          recommendation?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operational_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_analyses: {
        Row: {
          ai_result: Json | null
          analysis_date: string
          company_id: string | null
          created_at: string | null
          created_by: string | null
          data_hash: string | null
          generated_at: string | null
          id: string
          indicators: Json | null
          manual_ai_updated_at: string | null
          metrics_snapshot: Json | null
          period_end: string
          period_start: string
          source: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          ai_result?: Json | null
          analysis_date: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_hash?: string | null
          generated_at?: string | null
          id?: string
          indicators?: Json | null
          manual_ai_updated_at?: string | null
          metrics_snapshot?: Json | null
          period_end: string
          period_start: string
          source?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          ai_result?: Json | null
          analysis_date?: string
          company_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_hash?: string | null
          generated_at?: string | null
          id?: string
          indicators?: Json | null
          manual_ai_updated_at?: string | null
          metrics_snapshot?: Json | null
          period_end?: string
          period_start?: string
          source?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operational_analyses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          display_name: string
          id: string
          logo_url: string | null
          logo_url_relatorios: string | null
          support_phone: string | null
          updated_at: string | null
        }
        Insert: {
          display_name?: string
          id?: string
          logo_url?: string | null
          logo_url_relatorios?: string | null
          support_phone?: string | null
          updated_at?: string | null
        }
        Update: {
          display_name?: string
          id?: string
          logo_url?: string | null
          logo_url_relatorios?: string | null
          support_phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          chat_avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          chat_avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          chat_avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reseller_credit_allocations: {
        Row: {
          allocated_at: string
          branch_id: string | null
          company_id: string
          created_at: string
          credit_lot_id: string
          expires_at: string
          id: string
          reseller_id: string
          unit_id: string
          unit_type: string
        }
        Insert: {
          allocated_at?: string
          branch_id?: string | null
          company_id: string
          created_at?: string
          credit_lot_id: string
          expires_at: string
          id?: string
          reseller_id: string
          unit_id: string
          unit_type: string
        }
        Update: {
          allocated_at?: string
          branch_id?: string | null
          company_id?: string
          created_at?: string
          credit_lot_id?: string
          expires_at?: string
          id?: string
          reseller_id?: string
          unit_id?: string
          unit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_credit_allocations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_credit_allocations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_credit_allocations_credit_lot_id_fkey"
            columns: ["credit_lot_id"]
            isOneToOne: false
            referencedRelation: "reseller_credit_lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_credit_allocations_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_credit_lots: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          purchased_at: string
          quantity: number
          reference: string | null
          remaining_quantity: number
          reseller_id: string
          source: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          purchased_at?: string
          quantity: number
          reference?: string | null
          remaining_quantity: number
          reseller_id: string
          source?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          purchased_at?: string
          quantity?: number
          reference?: string | null
          remaining_quantity?: number
          reseller_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_credit_lots_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_credit_orders: {
        Row: {
          asaas_payment_id: string | null
          asaas_pix_copy_paste: string | null
          asaas_pix_qr_code: string | null
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          due_date: string
          id: string
          quantity: number
          reseller_id: string
          status: string
          total_amount: number
          unit_price: number
          updated_at: string
        }
        Insert: {
          asaas_payment_id?: string | null
          asaas_pix_copy_paste?: string | null
          asaas_pix_qr_code?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date: string
          id?: string
          quantity: number
          reseller_id: string
          status?: string
          total_amount: number
          unit_price?: number
          updated_at?: string
        }
        Update: {
          asaas_payment_id?: string | null
          asaas_pix_copy_paste?: string | null
          asaas_pix_qr_code?: string | null
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string
          id?: string
          quantity?: number
          reseller_id?: string
          status?: string
          total_amount?: number
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_credit_orders_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      resellers: {
        Row: {
          asaas_customer_id: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          document: string | null
          id: string
          name: string
          notes: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          asaas_customer_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          document?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          asaas_customer_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          document?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          branch_id: string | null
          company_id: string | null
          created_at: string
          id: string
          reseller_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          reseller_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          branch_id?: string | null
          company_id?: string | null
          created_at?: string
          id?: string
          reseller_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      visitors: {
        Row: {
          city: string | null
          company_id: string
          connections_count: number
          consent_version: string | null
          country: string | null
          country_code: string
          created_at: string
          email: string | null
          first_seen_at: string
          full_name: string
          id: string
          last_seen_at: string
          lgpd_consent: boolean
          lgpd_consent_at: string | null
          marketing_consent: boolean
          marketing_consent_at: string | null
          phone_e164: string
          reseller_id: string | null
          updated_at: string
          whatsapp_opt_in: boolean
          whatsapp_opt_in_at: string | null
        }
        Insert: {
          city?: string | null
          company_id: string
          connections_count?: number
          consent_version?: string | null
          country?: string | null
          country_code?: string
          created_at?: string
          email?: string | null
          first_seen_at?: string
          full_name: string
          id?: string
          last_seen_at?: string
          lgpd_consent?: boolean
          lgpd_consent_at?: string | null
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          phone_e164: string
          reseller_id?: string | null
          updated_at?: string
          whatsapp_opt_in?: boolean
          whatsapp_opt_in_at?: string | null
        }
        Update: {
          city?: string | null
          company_id?: string
          connections_count?: number
          consent_version?: string | null
          country?: string | null
          country_code?: string
          created_at?: string
          email?: string | null
          first_seen_at?: string
          full_name?: string
          id?: string
          last_seen_at?: string
          lgpd_consent?: boolean
          lgpd_consent_at?: string | null
          marketing_consent?: boolean
          marketing_consent_at?: string | null
          phone_e164?: string
          reseller_id?: string | null
          updated_at?: string
          whatsapp_opt_in?: boolean
          whatsapp_opt_in_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visitors_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitors_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      chat_delete_conversation: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      chat_find_or_create_conversation: {
        Args: {
          p_canonical_key: string
          p_company_id: string
          p_creator_id: string
          p_participants: Json
        }
        Returns: {
          conversation_id: string
          created: boolean
        }[]
      }
      chat_find_or_create_for_recipient: {
        Args: { p_recipient_profile_id: string }
        Returns: {
          conversation_id: string
          created: boolean
        }[]
      }
      chat_get_contact_avatar_urls: { Args: never; Returns: Json }
      chat_get_contacts: { Args: never; Returns: Json }
      chat_get_recipient_ids: {
        Args: { p_conversation_id: string }
        Returns: string[]
      }
      check_conversation_access: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      check_participant_access: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      current_branch_id: { Args: never; Returns: string }
      current_company_id: { Args: never; Returns: string }
      get_ai_limits_distribution: {
        Args: { _company_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_ai_usage_safe: {
        Args: { _branch_id?: string; _company_id: string; _user_id: string }
        Returns: Json
      }
      is_adm: { Args: never; Returns: boolean }
      is_branch_user_of: { Args: { _branch_id: string }; Returns: boolean }
      is_conversation_participant: {
        Args: { _conversation_id: string }
        Returns: boolean
      }
      is_current_reseller: { Args: { p_reseller_id: string }; Returns: boolean }
      is_matriz_of: { Args: { _company_id: string }; Returns: boolean }
      is_reseller_of_company: {
        Args: { _company_id: string }
        Returns: boolean
      }
      my_company_basics: {
        Args: never
        Returns: {
          blocked: boolean
          id: string
          logo_url: string
          name: string
        }[]
      }
      process_operational_alert: {
        Args: {
          p_branch_id: string
          p_company_id: string
          p_evidence: Json
          p_fingerprint: string
          p_recommendation: string
          p_severity: string
          p_title: string
          p_type: string
        }
        Returns: string
      }
      reseller_confirm_credit_order: {
        Args: { p_asaas_payment_id: string; p_confirmed_at?: string }
        Returns: boolean
      }
      reseller_consume_credit_for_unit: {
        Args: {
          p_branch_id?: string
          p_company_id: string
          p_reseller_id: string
          p_unit_id: string
          p_unit_type: string
        }
        Returns: boolean
      }
      reseller_refresh_credit_coverage: {
        Args: { p_reseller_id: string }
        Returns: {
          allocated_count: number
          covered_until: string
          pending_count: number
        }[]
      }
      reset_daily_ai_usage: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "adm" | "matriz" | "filial" | "revenda"
      campaign_status: "rascunho" | "ativa" | "encerrada"
      company_status: "ativa" | "bloqueada" | "suspensa" | "cancelada"
      event_status: "planejado" | "ativo" | "encerrado" | "cancelado"
      hotspot_vendor:
        | "test"
        | "mikrotik"
        | "radius"
        | "mikrotik_hotspot"
        | "intelbras_zeus"
        | "intelbras_hotspot300_legacy"
      user_presence_status: "online" | "away" | "busy" | "offline"
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
    Enums: {
      app_role: ["adm", "matriz", "filial", "revenda"],
      campaign_status: ["rascunho", "ativa", "encerrada"],
      company_status: ["ativa", "bloqueada", "suspensa", "cancelada"],
      event_status: ["planejado", "ativo", "encerrado", "cancelado"],
      hotspot_vendor: [
        "test",
        "mikrotik",
        "radius",
        "mikrotik_hotspot",
        "intelbras_zeus",
        "intelbras_hotspot300_legacy",
      ],
      user_presence_status: ["online", "away", "busy", "offline"],
    },
  },
} as const

