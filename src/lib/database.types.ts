export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      goals: {
        Row: {
          categoria: string;
          created_at: string;
          id: number;
          user_id: string | null;
          valor: number;
        };
        Insert: {
          categoria: string;
          created_at?: string;
          id?: number;
          user_id?: string | null;
          valor: number;
        };
        Update: {
          categoria?: string;
          created_at?: string;
          id?: number;
          user_id?: string | null;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'metas_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      recurring_transactions: {
        Row: {
          categoria: string;
          created_at: string;
          descricao: string;
          frequencia: string;
          id: string;
          subcategorias: string[] | null;
          user_id: string;
          valor: number;
        };
        Insert: {
          categoria: string;
          created_at?: string;
          descricao: string;
          frequencia: string;
          id?: string;
          subcategorias?: string[] | null;
          user_id: string;
          valor: number;
        };
        Update: {
          categoria?: string;
          created_at?: string;
          descricao?: string;
          frequencia?: string;
          id?: string;
          subcategorias?: string[] | null;
          user_id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'transacoes_recorrentes_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      transactions: {
        Row: {
          categoria: string;
          created_at: string;
          data: string;
          descricao: string;
          id: string;
          recurring_transaction_id: string | null;
          user_id: string;
          valor: number;
        };
        Insert: {
          categoria: string;
          created_at?: string;
          data: string;
          descricao: string;
          id?: string;
          recurring_transaction_id?: string | null;
          user_id: string;
          valor: number;
        };
        Update: {
          categoria?: string;
          created_at?: string;
          data?: string;
          descricao?: string;
          id?: string;
          recurring_transaction_id?: string | null;
          user_id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'transactions_recurring_transaction_id_fkey';
            columns: ['recurring_transaction_id'];
            isOneToOne: false;
            referencedRelation: 'recurring_transactions';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'transactions_user_id_fkey1';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      users: {
        Row: {
          created_at: string;
          id: string;
          nickname: string | null;
          previous_response_id: string | null;
          stripe_active_subscription_id: string | null;
          stripe_customer_id: string | null;
          whatsapp_phone: string | null;
        };
        Insert: {
          created_at?: string;
          id: string;
          nickname?: string | null;
          previous_response_id?: string | null;
          stripe_active_subscription_id?: string | null;
          stripe_customer_id?: string | null;
          whatsapp_phone?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          nickname?: string | null;
          previous_response_id?: string | null;
          stripe_active_subscription_id?: string | null;
          stripe_customer_id?: string | null;
          whatsapp_phone?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      user_goals_progress: {
        Row: {
          categoria: string | null;
          mes_referencia: string | null;
          meta: number | null;
          total_gasto: number | null;
          user_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'metas_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      gerar_id_unico_transactions: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      Database[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes'] | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database;
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
