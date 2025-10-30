import { Context } from 'hono';
import { Request, Response } from 'express';

// Define environment bindings (what's available in c.env)
export type Env = {
  incoming: Request;
  outgoing: Response;
};

// Define variables that can be set in context (c.set / c.get)
export type Variables = {
  user: {
    id: number;
    username: string;
  };
  getUser: () => any;
  setUser: (user: any) => void;
  logout: () => Promise<void>;
};

// Export typed context
export type AppContext = Context<{ Bindings: Env; Variables: Variables }>;
