import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'cricketscorerpro_super_secret_key_123';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'super_admin' | 'organizer' | 'scorer' | 'viewer';
  };
}

export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access Denied: No Token Provided' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET) as any;
    req.user = verified;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Access Denied: Invalid Token' });
  }
};

export const requireRole = (roles: Array<'super_admin' | 'organizer' | 'scorer' | 'viewer'>) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Access Denied: Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: `Access Denied: Requires one of roles: [${roles.join(', ')}]` });
    }

    next();
  };
};
