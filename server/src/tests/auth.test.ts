import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type LoginInput } from '../schema';
import { login, register, verifyToken } from '../handlers/auth';
import { eq } from 'drizzle-orm';

// Test inputs
const testUser: CreateUserInput = {
  email: 'test@example.com',
  password: 'password123',
  full_name: 'Test User',
  phone: '+1234567890',
  role: 'customer'
};

const testAdmin: CreateUserInput = {
  email: 'admin@example.com',
  password: 'adminpass123',
  full_name: 'Admin User',
  phone: null,
  role: 'admin'
};

const loginInput: LoginInput = {
  email: 'test@example.com',
  password: 'password123'
};

describe('auth handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('register', () => {
    it('should create a new user account', async () => {
      const result = await register(testUser);

      // Validate response structure
      expect(result.user.id).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.full_name).toBe('Test User');
      expect(result.user.phone).toBe('+1234567890');
      expect(result.user.role).toBe('customer');
      expect(result.user.created_at).toBeInstanceOf(Date);
      expect(result.user.updated_at).toBeInstanceOf(Date);
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(0);
    });

    it('should create admin user successfully', async () => {
      const result = await register(testAdmin);

      expect(result.user.email).toBe('admin@example.com');
      expect(result.user.full_name).toBe('Admin User');
      expect(result.user.phone).toBeNull();
      expect(result.user.role).toBe('admin');
      expect(result.token).toBeDefined();
    });

    it('should save user to database with hashed password', async () => {
      const result = await register(testUser);

      // Verify user was saved to database
      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, result.user.id))
        .execute();

      expect(users).toHaveLength(1);
      const savedUser = users[0];
      
      expect(savedUser.email).toBe('test@example.com');
      expect(savedUser.full_name).toBe('Test User');
      expect(savedUser.phone).toBe('+1234567890');
      expect(savedUser.role).toBe('customer');
      expect(savedUser.password_hash).toBeDefined();
      expect(savedUser.password_hash).not.toBe('password123'); // Password should be hashed
      expect(savedUser.created_at).toBeInstanceOf(Date);
      expect(savedUser.updated_at).toBeInstanceOf(Date);
    });

    it('should throw error for duplicate email', async () => {
      // Create first user
      await register(testUser);

      // Try to create second user with same email
      await expect(register(testUser)).rejects.toThrow(/already exists/i);
    });

    it('should handle different user roles correctly', async () => {
      const customerResult = await register(testUser);
      const adminResult = await register(testAdmin);

      expect(customerResult.user.role).toBe('customer');
      expect(adminResult.user.role).toBe('admin');

      // Verify both users are in database
      const allUsers = await db.select().from(usersTable).execute();
      expect(allUsers).toHaveLength(2);
    });
  });

  describe('login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      await register(testUser);
    });

    it('should authenticate user with correct credentials', async () => {
      const result = await login(loginInput);

      expect(result.user.email).toBe('test@example.com');
      expect(result.user.full_name).toBe('Test User');
      expect(result.user.phone).toBe('+1234567890');
      expect(result.user.role).toBe('customer');
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(0);
    });

    it('should return complete user data', async () => {
      const result = await login(loginInput);

      // Verify all user fields are present
      expect(result.user.id).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.password_hash).toBeDefined();
      expect(result.user.full_name).toBe('Test User');
      expect(result.user.phone).toBe('+1234567890');
      expect(result.user.role).toBe('customer');
      expect(result.user.created_at).toBeInstanceOf(Date);
      expect(result.user.updated_at).toBeInstanceOf(Date);
    });

    it('should throw error for invalid email', async () => {
      const invalidInput: LoginInput = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      await expect(login(invalidInput)).rejects.toThrow(/invalid email or password/i);
    });

    it('should throw error for incorrect password', async () => {
      const invalidInput: LoginInput = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      await expect(login(invalidInput)).rejects.toThrow(/invalid email or password/i);
    });

    it('should authenticate admin user correctly', async () => {
      // Register admin user
      await register(testAdmin);

      const adminLogin: LoginInput = {
        email: 'admin@example.com',
        password: 'adminpass123'
      };

      const result = await login(adminLogin);
      
      expect(result.user.email).toBe('admin@example.com');
      expect(result.user.role).toBe('admin');
      expect(result.user.phone).toBeNull();
      expect(result.token).toBeDefined();
    });
  });

  describe('verifyToken', () => {
    let validToken: string;
    let userId: number;

    beforeEach(async () => {
      // Create user and get valid token
      const result = await register(testUser);
      validToken = result.token;
      userId = result.user.id;
    });

    it('should verify valid token and return user data', async () => {
      const result = await verifyToken(validToken);

      expect(result.id).toBe(userId);
      expect(result.email).toBe('test@example.com');
      expect(result.full_name).toBe('Test User');
      expect(result.phone).toBe('+1234567890');
      expect(result.role).toBe('customer');
      expect(result.password_hash).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should throw error for invalid token format', async () => {
      const invalidToken = 'invalid-token-format';

      await expect(verifyToken(invalidToken)).rejects.toThrow(/invalid token/i);
    });

    it('should throw error for malformed token', async () => {
      const malformedToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.malformed';

      await expect(verifyToken(malformedToken)).rejects.toThrow(/invalid token/i);
    });

    it('should throw error when user no longer exists', async () => {
      // Delete the user from database
      await db.delete(usersTable)
        .where(eq(usersTable.id, userId))
        .execute();

      await expect(verifyToken(validToken)).rejects.toThrow(/user not found/i);
    });

    it('should verify tokens for different user roles', async () => {
      // Create admin user
      const adminResult = await register(testAdmin);
      const adminToken = adminResult.token;

      // Verify customer token
      const customerResult = await verifyToken(validToken);
      expect(customerResult.role).toBe('customer');

      // Verify admin token
      const verifiedAdmin = await verifyToken(adminToken);
      expect(verifiedAdmin.role).toBe('admin');
      expect(verifiedAdmin.email).toBe('admin@example.com');
    });
  });

  describe('integration workflow', () => {
    it('should complete full auth workflow: register -> login -> verify token', async () => {
      // 1. Register new user
      const registerResult = await register(testUser);
      expect(registerResult.user.email).toBe('test@example.com');
      expect(registerResult.token).toBeDefined();

      // 2. Login with credentials
      const loginResult = await login(loginInput);
      expect(loginResult.user.id).toBe(registerResult.user.id);
      expect(loginResult.token).toBeDefined();
      expect(loginResult.token).not.toBe(registerResult.token); // New token generated

      // 3. Verify login token
      const verifyResult = await verifyToken(loginResult.token);
      expect(verifyResult.id).toBe(registerResult.user.id);
      expect(verifyResult.email).toBe('test@example.com');

      // 4. Verify register token still works
      const verifyRegisterToken = await verifyToken(registerResult.token);
      expect(verifyRegisterToken.id).toBe(registerResult.user.id);
    });

    it('should handle multiple users independently', async () => {
      // Register two different users
      const user1Result = await register(testUser);
      const user2Result = await register(testAdmin);

      expect(user1Result.user.id).not.toBe(user2Result.user.id);

      // Login both users
      const user1Login = await login(loginInput);
      const user2Login = await login({
        email: 'admin@example.com',
        password: 'adminpass123'
      });

      // Verify tokens work independently
      const user1Verify = await verifyToken(user1Login.token);
      const user2Verify = await verifyToken(user2Login.token);

      expect(user1Verify.email).toBe('test@example.com');
      expect(user1Verify.role).toBe('customer');
      expect(user2Verify.email).toBe('admin@example.com');
      expect(user2Verify.role).toBe('admin');
    });
  });
});