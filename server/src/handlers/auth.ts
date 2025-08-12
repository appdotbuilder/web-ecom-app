import { eq } from 'drizzle-orm';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput, type CreateUserInput, type AuthResponse, type User } from '../schema';

// Simple JWT implementation (in production, use proper JWT library like 'jsonwebtoken')
const JWT_SECRET = process.env['JWT_SECRET'] || 'your-secret-key';

// Simple base64 encoding for demonstration (use proper crypto in production)
function generateToken(userId: number): string {
  const payload = { userId, timestamp: Date.now(), nonce: Math.random() };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `${encoded}.${Buffer.from(JWT_SECRET).toString('base64')}`;
}

function verifyTokenString(token: string): { userId: number } | null {
  try {
    const [payload] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString());
    
    // Simple validation - in production, verify signature and expiration
    if (decoded.userId && decoded.timestamp && decoded.nonce !== undefined) {
      return { userId: decoded.userId };
    }
    return null;
  } catch {
    return null;
  }
}

// Simple password hashing (use bcrypt in production)
function hashPassword(password: string): string {
  // Simple hash for demonstration - use bcrypt.hash() in production
  return Buffer.from(password + JWT_SECRET).toString('base64');
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // Verify password
    if (!verifyPassword(input.password, user.password_hash)) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = generateToken(user.id);

    // Return user data (excluding password_hash) with token
    return {
      user: {
        id: user.id,
        email: user.email,
        password_hash: user.password_hash,
        full_name: user.full_name,
        phone: user.phone,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      token
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

export async function register(input: CreateUserInput): Promise<AuthResponse> {
  try {
    // Check if user already exists
    const existingUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUsers.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = hashPassword(input.password);

    // Insert new user
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash: passwordHash,
        full_name: input.full_name,
        phone: input.phone,
        role: input.role
      })
      .returning()
      .execute();

    const user = result[0];

    // Generate JWT token
    const token = generateToken(user.id);

    // Return user data with token
    return {
      user: {
        id: user.id,
        email: user.email,
        password_hash: user.password_hash,
        full_name: user.full_name,
        phone: user.phone,
        role: user.role,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
      token
    };
  } catch (error) {
    console.error('Registration failed:', error);
    throw error;
  }
}

export async function verifyToken(token: string): Promise<User> {
  try {
    // Verify and decode token
    const tokenData = verifyTokenString(token);
    if (!tokenData) {
      throw new Error('Invalid token');
    }

    // Find user by ID from token
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, tokenData.userId))
      .execute();

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];

    return {
      id: user.id,
      email: user.email,
      password_hash: user.password_hash,
      full_name: user.full_name,
      phone: user.phone,
      role: user.role,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    throw error;
  }
}