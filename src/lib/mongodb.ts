// Browser-compatible storage using localStorage
class LocalStorageClient {
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  async getCollection(name: string) {
    return {
      find: (query: any) => ({
        sort: () => ({
          limit: () => ({
            toArray: async () => {
              const data = JSON.parse(localStorage.getItem(name) || '[]');
              return data.filter((item: any) => {
                if (query.user_id) return item.user_id === query.user_id;
                if (query.email) return item.email === query.email;
                return true;
              });
            }
          })
        }),
        toArray: async () => {
          const data = JSON.parse(localStorage.getItem(name) || '[]');
          return data.filter((item: any) => {
            if (query.user_id) return item.user_id === query.user_id;
            if (query.email) return item.email === query.email;
            return true;
          });
        }
      }),
      findOne: async (query: any) => {
        const data = JSON.parse(localStorage.getItem(name) || '[]');
        return data.find((item: any) => {
          if (query.email) return item.email === query.email;
          if (query._id) return item._id === query._id;
          return false;
        });
      },
      insertOne: async (doc: any) => {
        const data = JSON.parse(localStorage.getItem(name) || '[]');
        const newDoc = { ...doc, _id: this.generateId() };
        data.push(newDoc);
        localStorage.setItem(name, JSON.stringify(data));
        return { insertedId: newDoc._id };
      },
      deleteOne: async (query: any) => {
        const data = JSON.parse(localStorage.getItem(name) || '[]');
        const filtered = data.filter((item: any) => item._id !== query._id);
        localStorage.setItem(name, JSON.stringify(filtered));
        return { deletedCount: data.length - filtered.length };
      }
    };
  }
}

export const mongoClient = new LocalStorageClient();

export interface ConversionRecord {
  _id?: string;
  id?: string;
  user_id: string | null;
  filename: string;
  xml_input: string;
  json_output: string | null;
  file_size: number;
  conversion_time_ms: number;
  status: 'success' | 'error';
  error_message: string | null;
  created_at: string;
}

export interface UserProfile {
  _id?: string;
  email: string;
  full_name: string;
  role: string;
  organization: string;
  total_conversions: number;
  created_at: string;
  updated_at: string;
}

export interface FileStorage {
  _id?: string;
  id?: string;
  user_id: string;
  filename: string;
  file_type: 'input' | 'output';
  content: string;
  file_size: number;
  mime_type: string;
  conversion_id?: string;
  created_at: string;
}