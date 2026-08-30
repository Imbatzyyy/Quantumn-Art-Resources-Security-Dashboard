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
      account_sessions: {
        Row: {
          assurance_level: string
          created_at: string
          device: string
          employee_code: string
          is_current: boolean
          last_active_label: string
          last_seen_at: string
          location: string
          session_code: string
          trust_status: string
        }
        Insert: {
          assurance_level?: string
          created_at?: string
          device: string
          employee_code: string
          is_current?: boolean
          last_active_label: string
          last_seen_at?: string
          location: string
          session_code: string
          trust_status?: string
        }
        Update: {
          assurance_level?: string
          created_at?: string
          device?: string
          employee_code?: string
          is_current?: boolean
          last_active_label?: string
          last_seen_at?: string
          location?: string
          session_code?: string
          trust_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_sessions_employee_code_fkey"
            columns: ["employee_code"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
        ]
      }
      announcements: {
        Row: {
          author_employee_code: string | null
          content: string
          created_at: string
          id: number
          priority: string
          published_on: string
          title: string
        }
        Insert: {
          author_employee_code?: string | null
          content: string
          created_at?: string
          id?: number
          priority?: string
          published_on?: string
          title: string
        }
        Update: {
          author_employee_code?: string | null
          content?: string
          created_at?: string
          id?: number
          priority?: string
          published_on?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_author_employee_code_fkey"
            columns: ["author_employee_code"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
        ]
      }
      attendance: {
        Row: {
          clock_in: string | null
          clock_out: string | null
          created_at: string
          employee_code: string
          hours: number
          id: number
          status: string
          updated_at: string
          work_date: string
        }
        Insert: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          employee_code: string
          hours?: number
          id?: number
          status?: string
          updated_at?: string
          work_date?: string
        }
        Update: {
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          employee_code?: string
          hours?: number
          id?: number
          status?: string
          updated_at?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_employee_code_fkey"
            columns: ["employee_code"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_employee_code: string | null
          actor_label: string
          created_at: string
          display_time: string
          id: number
          target: string
        }
        Insert: {
          action: string
          actor_employee_code?: string | null
          actor_label: string
          created_at?: string
          display_time: string
          id?: number
          target: string
        }
        Update: {
          action?: string
          actor_employee_code?: string | null
          actor_label?: string
          created_at?: string
          display_time?: string
          id?: number
          target?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_employee_code_fkey"
            columns: ["actor_employee_code"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
        ]
      }
      document_acknowledgements: {
        Row: {
          acknowledged_at: string
          document_id: number
          employee_code: string
          id: number
        }
        Insert: {
          acknowledged_at?: string
          document_id: number
          employee_code: string
          id?: number
        }
        Update: {
          acknowledged_at?: string
          document_id?: number
          employee_code?: string
          id?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_acknowledgements_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "employee_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_acknowledgements_employee_code_fkey"
            columns: ["employee_code"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
        ]
      }
      employee_benefits: {
        Row: {
          benefit_type: string
          created_at: string
          effective_date: string
          employee_code: string
          employee_share: number
          employer_share: number
          id: number
          plan_name: string
          provider: string | null
          status: string
        }
        Insert: {
          benefit_type: string
          created_at?: string
          effective_date?: string
          employee_code: string
          employee_share?: number
          employer_share?: number
          id?: number
          plan_name: string
          provider?: string | null
          status?: string
        }
        Update: {
          benefit_type?: string
          created_at?: string
          effective_date?: string
          employee_code?: string
          employee_share?: number
          employer_share?: number
          id?: number
          plan_name?: string
          provider?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_benefits_employee_code_fkey"
            columns: ["employee_code"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
        ]
      }
      employee_documents: {
        Row: {
          content: string
          created_at: string
          document_type: string
          employee_code: string | null
          expires_on: string | null
          filename: string
          id: number
          period: string | null
          requires_ack: boolean
          sensitive: boolean
          title: string
          updated_at: string
          uploaded_by: string | null
          version: string
        }
        Insert: {
          content: string
          created_at?: string
          document_type: string
          employee_code?: string | null
          expires_on?: string | null
          filename: string
          id?: number
          period?: string | null
          requires_ack?: boolean
          sensitive?: boolean
          title: string
          updated_at?: string
          uploaded_by?: string | null
          version?: string
        }
        Update: {
          content?: string
          created_at?: string
          document_type?: string
          employee_code?: string | null
          expires_on?: string | null
          filename?: string
          id?: number
          period?: string | null
          requires_ack?: boolean
          sensitive?: boolean
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_code_fkey"
            columns: ["employee_code"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
          {
            foreignKeyName: "employee_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
        ]
      }
      employee_goals: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          employee_code: string
          id: number
          progress: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          employee_code: string
          id?: number
          progress?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          employee_code?: string
          id?: number
          progress?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
          {
            foreignKeyName: "employee_goals_employee_code_fkey"
            columns: ["employee_code"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
        ]
      }
      employee_requests: {
        Row: {
          assigned_to: string | null
          created_at: string
          decision_note: string | null
          description: string
          employee_code: string
          id: number
          priority: string
          request_type: string
          requested_date: string | null
          requested_value: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          decision_note?: string | null
          description: string
          employee_code: string
          id?: number
          priority?: string
          request_type: string
          requested_date?: string | null
          requested_value?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          decision_note?: string | null
          description?: string
          employee_code?: string
          id?: number
          priority?: string
          request_type?: string
          requested_date?: string | null
          requested_value?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_requests_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
          {
            foreignKeyName: "employee_requests_employee_code_fkey"
            columns: ["employee_code"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
          {
            foreignKeyName: "employee_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string
          days: number
          employee_code: string
          end_date: string
          id: number
          leave_type: string
          reason: string
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string
          status: string
        }
        Insert: {
          created_at?: string
          days: number
          employee_code: string
          end_date: string
          id?: number
          leave_type: string
          reason: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date: string
          status?: string
        }
        Update: {
          created_at?: string
          days?: number
          employee_code?: string
          end_date?: string
          id?: number
          leave_type?: string
          reason?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_code_fkey"
            columns: ["employee_code"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
        ]
      }
      lifecycle_cases: {
        Row: {
          case_type: string
          created_at: string
          employee_code: string
          id: number
          owner_code: string | null
          status: string
          target_date: string
          updated_at: string
        }
        Insert: {
          case_type: string
          created_at?: string
          employee_code: string
          id?: number
          owner_code?: string | null
          status?: string
          target_date: string
          updated_at?: string
        }
        Update: {
          case_type?: string
          created_at?: string
          employee_code?: string
          id?: number
          owner_code?: string | null
          status?: string
          target_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifecycle_cases_employee_code_fkey"
            columns: ["employee_code"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
          {
            foreignKeyName: "lifecycle_cases_owner_code_fkey"
            columns: ["owner_code"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
        ]
      }
      lifecycle_tasks: {
        Row: {
          case_id: number
          category: string
          completed_at: string | null
          completed_by: string | null
          created_at: string
          employee_visible: boolean
          id: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          case_id: number
          category: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          employee_visible?: boolean
          id?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          case_id?: number
          category?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          employee_visible?: boolean
          id?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lifecycle_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "lifecycle_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lifecycle_tasks_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
        ]
      }
      notifications: {
        Row: {
          action_label: string | null
          category: string
          created_at: string
          destination: string | null
          employee_code: string
          id: number
          message: string
          read_at: string | null
          title: string
        }
        Insert: {
          action_label?: string | null
          category?: string
          created_at?: string
          destination?: string | null
          employee_code: string
          id?: number
          message: string
          read_at?: string | null
          title: string
        }
        Update: {
          action_label?: string | null
          category?: string
          created_at?: string
          destination?: string | null
          employee_code?: string
          id?: number
          message?: string
          read_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_employee_code_fkey"
            columns: ["employee_code"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
        ]
      }
      payroll: {
        Row: {
          allowances: number
          bonuses: number
          created_at: string
          deductions: number
          employee_code: string
          gross: number
          id: number
          net: number | null
          payment_date: string | null
          payroll_run_id: number | null
          period: string
          status: string
        }
        Insert: {
          allowances?: number
          bonuses?: number
          created_at?: string
          deductions?: number
          employee_code: string
          gross: number
          id?: number
          net?: number | null
          payment_date?: string | null
          payroll_run_id?: number | null
          period: string
          status?: string
        }
        Update: {
          allowances?: number
          bonuses?: number
          created_at?: string
          deductions?: number
          employee_code?: string
          gross?: number
          id?: number
          net?: number | null
          payment_date?: string | null
          payroll_run_id?: number | null
          period?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_employee_code_fkey"
            columns: ["employee_code"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
          {
            foreignKeyName: "payroll_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          deduction_rate: number
          employee_count: number
          gross_total: number
          id: number
          locked_at: string | null
          net_total: number
          paid_at: string | null
          period: string
          released_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          deduction_rate?: number
          employee_count?: number
          gross_total?: number
          id?: number
          locked_at?: string | null
          net_total?: number
          paid_at?: string | null
          period: string
          released_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          deduction_rate?: number
          employee_count?: number
          gross_total?: number
          id?: number
          locked_at?: string | null
          net_total?: number
          paid_at?: string | null
          period?: string
          released_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
          {
            foreignKeyName: "payroll_runs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
        ]
      }
      performance_cycles: {
        Row: {
          created_at: string
          created_by: string | null
          end_date: string | null
          id: number
          period: string
          start_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: number
          period: string
          start_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: number
          period?: string
          start_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_cycles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
        ]
      }
      performance_reviews: {
        Row: {
          comments: string | null
          created_at: string
          cycle_id: number | null
          employee_code: string
          goal_progress: number
          id: number
          period: string
          productivity_score: number
          published_at: string | null
          quality_score: number
          rating: string
          reviewer_code: string | null
          score: number
          status: string
          teamwork_score: number
        }
        Insert: {
          comments?: string | null
          created_at?: string
          cycle_id?: number | null
          employee_code: string
          goal_progress: number
          id?: number
          period: string
          productivity_score?: number
          published_at?: string | null
          quality_score?: number
          rating: string
          reviewer_code?: string | null
          score: number
          status?: string
          teamwork_score?: number
        }
        Update: {
          comments?: string | null
          created_at?: string
          cycle_id?: number | null
          employee_code?: string
          goal_progress?: number
          id?: number
          period?: string
          productivity_score?: number
          published_at?: string | null
          quality_score?: number
          rating?: string
          reviewer_code?: string | null
          score?: number
          status?: string
          teamwork_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "performance_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reviews_employee_code_fkey"
            columns: ["employee_code"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
          {
            foreignKeyName: "performance_reviews_reviewer_code_fkey"
            columns: ["reviewer_code"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_user_id: string | null
          avatar_path: string | null
          cost_center: string | null
          created_at: string
          department: string
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_relationship: string | null
          employee_code: string
          employment_type: string
          first_name: string
          hire_date: string
          last_name: string
          manager_code: string | null
          middle_name: string | null
          phone: string | null
          position: string
          preferred_name: string | null
          role: string
          salary: number
          status: string
          updated_at: string
          work_arrangement: string
          work_location: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar_path?: string | null
          cost_center?: string | null
          created_at?: string
          department: string
          email: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          employee_code?: string
          employment_type?: string
          first_name: string
          hire_date?: string
          last_name: string
          manager_code?: string | null
          middle_name?: string | null
          phone?: string | null
          position: string
          preferred_name?: string | null
          role?: string
          salary?: number
          status?: string
          updated_at?: string
          work_arrangement?: string
          work_location?: string
        }
        Update: {
          auth_user_id?: string | null
          avatar_path?: string | null
          cost_center?: string | null
          created_at?: string
          department?: string
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_relationship?: string | null
          employee_code?: string
          employment_type?: string
          first_name?: string
          hire_date?: string
          last_name?: string
          manager_code?: string | null
          middle_name?: string | null
          phone?: string | null
          position?: string
          preferred_name?: string | null
          role?: string
          salary?: number
          status?: string
          updated_at?: string
          work_arrangement?: string
          work_location?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_code_fkey"
            columns: ["manager_code"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
        ]
      }
      request_comments: {
        Row: {
          author_employee_code: string
          body: string
          created_at: string
          id: number
          is_internal: boolean
          request_id: number
        }
        Insert: {
          author_employee_code: string
          body: string
          created_at?: string
          id?: number
          is_internal?: boolean
          request_id: number
        }
        Update: {
          author_employee_code?: string
          body?: string
          created_at?: string
          id?: number
          is_internal?: boolean
          request_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "request_comments_author_employee_code_fkey"
            columns: ["author_employee_code"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
          {
            foreignKeyName: "request_comments_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "employee_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      security_alert_responses: {
        Row: {
          actor_employee_code: string
          alert_code: string
          created_at: string
          id: number
          note: string | null
          response_action: string
        }
        Insert: {
          actor_employee_code: string
          alert_code: string
          created_at?: string
          id?: number
          note?: string | null
          response_action: string
        }
        Update: {
          actor_employee_code?: string
          alert_code?: string
          created_at?: string
          id?: number
          note?: string | null
          response_action?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_alert_responses_actor_employee_code_fkey"
            columns: ["actor_employee_code"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
          {
            foreignKeyName: "security_alert_responses_alert_code_fkey"
            columns: ["alert_code"]
            isOneToOne: false
            referencedRelation: "security_alerts"
            referencedColumns: ["alert_code"]
          },
        ]
      }
      security_alerts: {
        Row: {
          acknowledged_at: string | null
          affected_label: string
          alert_code: string
          assigned_to: string | null
          confidence: string
          created_at: string
          description: string
          display_time: string
          employee_code: string | null
          event_type: string
          recommended_action: string
          resolution_notes: string | null
          resolution_reason: string | null
          resolved_at: string | null
          severity: string
          status: string
          title: string
          updated_at: string
          why_it_matters: string
        }
        Insert: {
          acknowledged_at?: string | null
          affected_label: string
          alert_code: string
          assigned_to?: string | null
          confidence?: string
          created_at?: string
          description: string
          display_time: string
          employee_code?: string | null
          event_type: string
          recommended_action: string
          resolution_notes?: string | null
          resolution_reason?: string | null
          resolved_at?: string | null
          severity: string
          status?: string
          title: string
          updated_at?: string
          why_it_matters?: string
        }
        Update: {
          acknowledged_at?: string | null
          affected_label?: string
          alert_code?: string
          assigned_to?: string | null
          confidence?: string
          created_at?: string
          description?: string
          display_time?: string
          employee_code?: string | null
          event_type?: string
          recommended_action?: string
          resolution_notes?: string | null
          resolution_reason?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
          title?: string
          updated_at?: string
          why_it_matters?: string
        }
        Relationships: [
          {
            foreignKeyName: "security_alerts_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
          {
            foreignKeyName: "security_alerts_employee_code_fkey"
            columns: ["employee_code"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
        ]
      }
      work_schedules: {
        Row: {
          created_at: string
          employee_code: string
          id: number
          location: string
          notes: string | null
          shift_end: string
          shift_start: string
          updated_at: string
          work_date: string
          work_mode: string
        }
        Insert: {
          created_at?: string
          employee_code: string
          id?: number
          location?: string
          notes?: string | null
          shift_end: string
          shift_start: string
          updated_at?: string
          work_date: string
          work_mode?: string
        }
        Update: {
          created_at?: string
          employee_code?: string
          id?: number
          location?: string
          notes?: string | null
          shift_end?: string
          shift_start?: string
          updated_at?: string
          work_date?: string
          work_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_schedules_employee_code_fkey"
            columns: ["employee_code"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
        ]
      }
      zap_findings: {
        Row: {
          affected_url: string | null
          confidence: string
          created_at: string
          description: string | null
          evidence: string | null
          id: number
          name: string
          plugin_id: string | null
          reference_url: string | null
          risk: string
          scan_code: string
          solution: string | null
          status: string
        }
        Insert: {
          affected_url?: string | null
          confidence?: string
          created_at?: string
          description?: string | null
          evidence?: string | null
          id?: number
          name: string
          plugin_id?: string | null
          reference_url?: string | null
          risk: string
          scan_code: string
          solution?: string | null
          status?: string
        }
        Update: {
          affected_url?: string | null
          confidence?: string
          created_at?: string
          description?: string | null
          evidence?: string | null
          id?: number
          name?: string
          plugin_id?: string | null
          reference_url?: string | null
          risk?: string
          scan_code?: string
          solution?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "zap_findings_scan_code_fkey"
            columns: ["scan_code"]
            isOneToOne: false
            referencedRelation: "zap_scan_runs"
            referencedColumns: ["scan_code"]
          },
        ]
      }
      zap_scan_runs: {
        Row: {
          authorized_scope: string
          completed_at: string
          created_at: string
          environment: string
          high_count: number
          informational_count: number
          low_count: number
          medium_count: number
          notes: string | null
          report_name: string | null
          report_sha256: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          scan_code: string
          scan_type: string
          started_at: string | null
          status: string
          target_url: string
          zap_version: string | null
        }
        Insert: {
          authorized_scope: string
          completed_at?: string
          created_at?: string
          environment: string
          high_count?: number
          informational_count?: number
          low_count?: number
          medium_count?: number
          notes?: string | null
          report_name?: string | null
          report_sha256?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scan_code: string
          scan_type: string
          started_at?: string | null
          status?: string
          target_url: string
          zap_version?: string | null
        }
        Update: {
          authorized_scope?: string
          completed_at?: string
          created_at?: string
          environment?: string
          high_count?: number
          informational_count?: number
          low_count?: number
          medium_count?: number
          notes?: string | null
          report_name?: string | null
          report_sha256?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          scan_code?: string
          scan_type?: string
          started_at?: string | null
          status?: string
          target_url?: string
          zap_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zap_scan_runs_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["employee_code"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      acknowledge_document: {
        Args: { selected_document_id: number }
        Returns: undefined
      }
      add_request_comment: {
        Args: {
          comment_body: string
          internal_note?: boolean
          selected_request_id: number
        }
        Returns: number
      }
      cancel_employee_request: {
        Args: { selected_request_id: number }
        Returns: undefined
      }
      clock_attendance: { Args: never; Returns: undefined }
      create_lifecycle_case: {
        Args: {
          selected_case_type: string
          selected_target_date: string
          target_employee: string
        }
        Returns: number
      }
      current_employee_code: { Args: never; Returns: string }
      current_hrms_role: { Args: never; Returns: string }
      generate_payroll: {
        Args: { deduction_rate: number; payroll_period: string }
        Returns: number
      }
      has_hrms_role: { Args: { allowed_roles: string[] }; Returns: boolean }
      is_active_hrms_user: { Args: never; Returns: boolean }
      is_hrms_admin: { Args: never; Returns: boolean }
      mark_all_notifications_read: { Args: never; Returns: undefined }
      mark_notification_read: {
        Args: { selected_notification_id: number }
        Returns: undefined
      }
      notify_employee: {
        Args: {
          notification_action?: string
          notification_category: string
          notification_destination?: string
          notification_message: string
          notification_title: string
          target_employee: string
        }
        Returns: number
      }
      publish_performance_review: {
        Args: { selected_review_id: number }
        Returns: undefined
      }
      record_user_activity: {
        Args: { activity_action: string; activity_target: string }
        Returns: undefined
      }
      respond_to_own_alert: {
        Args: { response_status: string; selected_alert_code: string }
        Returns: undefined
      }
      respond_to_security_alert: {
        Args: {
          response_action: string
          response_note?: string
          selected_alert_code: string
        }
        Returns: undefined
      }
      review_employee_request: {
        Args: {
          decision: string
          decision_reason: string
          selected_request_id: number
        }
        Returns: undefined
      }
      review_leave_request: {
        Args: { decision: string; request_id: number }
        Returns: undefined
      }
      save_performance_review: {
        Args: {
          review_comments: string
          review_cycle_id?: number
          review_goal_progress: number
          review_period: string
          review_productivity: number
          review_quality: number
          review_rating: string
          review_score: number
          review_teamwork: number
          target_employee: string
        }
        Returns: number
      }
      submit_employee_request: {
        Args: {
          requested_date?: string
          requested_description: string
          requested_priority?: string
          requested_subject: string
          requested_type: string
          requested_value?: string
        }
        Returns: number
      }
      submit_leave_request: {
        Args: {
          requested_end: string
          requested_reason: string
          requested_start: string
          requested_type: string
        }
        Returns: number
      }
      transition_payroll_run: {
        Args: { next_status: string; selected_run_id: number }
        Returns: undefined
      }
      update_goal_progress: {
        Args: { new_progress: number; selected_goal_id: number }
        Returns: undefined
      }
      update_lifecycle_task: {
        Args: { new_status: string; selected_task_id: number }
        Returns: undefined
      }
      update_own_avatar_path: {
        Args: { new_avatar_path: string }
        Returns: undefined
      }
      update_own_profile: { Args: { new_phone: string }; Returns: undefined }
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
