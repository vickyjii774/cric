import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { DBService, User } from '../services/db.service';

const JWT_SECRET = process.env.JWT_SECRET || 'cricketscorerpro_super_secret_key_123';

// Seed default users if DB is empty
const seedUsers = () => {
  const users = DBService.getAll<User>('users');
  if (users.length === 0) {
    const salt = bcrypt.genSaltSync(10);
    
    const adminUser: User = {
      id: 'usr_admin',
      name: 'Super Admin',
      email: 'admin@cricket.com',
      passwordHash: bcrypt.hashSync('admin123', salt),
      role: 'super_admin'
    };

    const scorerUser: User = {
      id: 'usr_scorer',
      name: 'Match Scorer',
      email: 'scorer@cricket.com',
      passwordHash: bcrypt.hashSync('scorer123', salt),
      role: 'scorer'
    };

    DBService.save<User>('users', adminUser);
    DBService.save<User>('users', scorerUser);
    console.log('Seeded default users (admin@cricket.com / admin123, scorer@cricket.com / scorer123)');
  }
};

export class AuthController {
  static register = async (req: Request, res: Response) => {
    try {
      const { name, email, password, role } = req.body;
      if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'All fields are required' });
      }

      const users = DBService.getAll<User>('users');
      const existingUser = users.find((u) => u.email === email);
      if (existingUser) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      const salt = bcrypt.genSaltSync(10);
      const newUser: User = {
        id: `usr_${Date.now()}`,
        name,
        email,
        passwordHash: bcrypt.hashSync(password, salt),
        role
      };

      DBService.save<User>('users', newUser);

      const token = jwt.sign(
        { id: newUser.id, email: newUser.email, role: newUser.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.status(201).json({
        token,
        user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  static login = async (req: Request, res: Response) => {
    try {
      seedUsers(); // Ensure defaults are present
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const users = DBService.getAll<User>('users');
      const user = users.find((u) => u.email === email);
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      const isValidPassword = bcrypt.compareSync(password, user.passwordHash);
      if (!isValidPassword) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      return res.json({
        token,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      });
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  static me = async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) return res.status(401).json({ message: 'No token' });

      const verified = jwt.verify(token, JWT_SECRET) as any;
      const user = DBService.getById<User>('users', verified.id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      return res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      });
    } catch {
      return res.status(401).json({ message: 'Invalid token' });
    }
  };
}
