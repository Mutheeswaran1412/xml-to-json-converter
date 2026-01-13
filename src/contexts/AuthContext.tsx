import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { mongoClient, UserProfile } from '../lib/mongodb';

interface User {
  id: string;
  email: string;
  full_name: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const users = await mongoClient.getCollection('users');
      const existingUser = await users.findOne({ email });
      
      if (existingUser) {
        throw new Error('User already exists');
      }

      const newUser: UserProfile = {
        email,
        full_name: fullName,
        role: 'user',
        organization: '',
        total_conversions: 0,
        created_at: new Date(),
        updated_at: new Date()
      };

      const result = await users.insertOne(newUser);
      const user = { id: result.insertedId.toString(), email, full_name: fullName };
      setUser(user);
      localStorage.setItem('user', JSON.stringify(user));
    } catch (error) {
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const users = await mongoClient.getCollection('users');
      const userDoc = await users.findOne({ email });
      
      if (!userDoc) {
        throw new Error('User not found');
      }

      const user = { 
        id: userDoc._id?.toString() || '', 
        email: userDoc.email, 
        full_name: userDoc.full_name 
      };
      setUser(user);
      localStorage.setItem('user', JSON.stringify(user));
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
