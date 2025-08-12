import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type UpdateUserInput, type CreateUserInput } from '../schema';
import { getUsers, getUserById, updateUser, deleteUser } from '../handlers/users';
import { eq } from 'drizzle-orm';


// Helper function to create a test user
const createTestUser = async (userData: Partial<CreateUserInput> = {}) => {
  const defaultUserData = {
    email: 'test@example.com',
    password: 'password123',
    full_name: 'Test User',
    phone: '+1234567890',
    role: 'customer' as const
  };

  const mergedData = { ...defaultUserData, ...userData };
  // Use a simple hash for testing purposes
  const password_hash = `hashed_${mergedData.password}`;

  const result = await db.insert(usersTable)
    .values({
      email: mergedData.email,
      password_hash,
      full_name: mergedData.full_name,
      phone: mergedData.phone,
      role: mergedData.role
    })
    .returning()
    .execute();

  return result[0];
};

describe('User Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getUsers', () => {
    it('should return empty array when no users exist', async () => {
      const result = await getUsers();
      expect(result).toEqual([]);
    });

    it('should return all users', async () => {
      // Create test users
      await createTestUser({ email: 'user1@example.com', full_name: 'User One' });
      await createTestUser({ email: 'user2@example.com', full_name: 'User Two', role: 'admin' });
      await createTestUser({ email: 'user3@example.com', full_name: 'User Three', phone: null });

      const result = await getUsers();

      expect(result).toHaveLength(3);
      expect(result[0].email).toBe('user1@example.com');
      expect(result[0].full_name).toBe('User One');
      expect(result[0].role).toBe('customer');
      expect(result[0].id).toBeDefined();
      expect(result[0].created_at).toBeInstanceOf(Date);
      expect(result[0].updated_at).toBeInstanceOf(Date);
      
      expect(result[1].email).toBe('user2@example.com');
      expect(result[1].role).toBe('admin');
      
      expect(result[2].phone).toBeNull();
    });

    it('should return users with all required fields', async () => {
      await createTestUser();
      
      const result = await getUsers();
      const user = result[0];

      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('password_hash');
      expect(user).toHaveProperty('full_name');
      expect(user).toHaveProperty('phone');
      expect(user).toHaveProperty('role');
      expect(user).toHaveProperty('created_at');
      expect(user).toHaveProperty('updated_at');
    });
  });

  describe('getUserById', () => {
    it('should return null for non-existent user', async () => {
      const result = await getUserById(999);
      expect(result).toBeNull();
    });

    it('should return user by ID', async () => {
      const testUser = await createTestUser({
        email: 'specific@example.com',
        full_name: 'Specific User',
        role: 'admin'
      });

      const result = await getUserById(testUser.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(testUser.id);
      expect(result!.email).toBe('specific@example.com');
      expect(result!.full_name).toBe('Specific User');
      expect(result!.role).toBe('admin');
      expect(result!.phone).toBe('+1234567890');
      expect(result!.created_at).toBeInstanceOf(Date);
      expect(result!.updated_at).toBeInstanceOf(Date);
    });

    it('should return correct user when multiple users exist', async () => {
      const user1 = await createTestUser({ email: 'user1@example.com' });
      const user2 = await createTestUser({ email: 'user2@example.com' });
      const user3 = await createTestUser({ email: 'user3@example.com' });

      const result = await getUserById(user2.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(user2.id);
      expect(result!.email).toBe('user2@example.com');
    });
  });

  describe('updateUser', () => {
    it('should update user email', async () => {
      const testUser = await createTestUser();
      const updateInput: UpdateUserInput = {
        id: testUser.id,
        email: 'updated@example.com'
      };

      const result = await updateUser(updateInput);

      expect(result.id).toBe(testUser.id);
      expect(result.email).toBe('updated@example.com');
      expect(result.full_name).toBe(testUser.full_name); // Unchanged
      expect(result.phone).toBe(testUser.phone); // Unchanged
      expect(result.role).toBe(testUser.role); // Unchanged
      expect(result.updated_at.getTime()).toBeGreaterThan(testUser.updated_at.getTime());
    });

    it('should update user full_name', async () => {
      const testUser = await createTestUser();
      const updateInput: UpdateUserInput = {
        id: testUser.id,
        full_name: 'Updated Name'
      };

      const result = await updateUser(updateInput);

      expect(result.id).toBe(testUser.id);
      expect(result.full_name).toBe('Updated Name');
      expect(result.email).toBe(testUser.email); // Unchanged
    });

    it('should update user phone', async () => {
      const testUser = await createTestUser();
      const updateInput: UpdateUserInput = {
        id: testUser.id,
        phone: '+9876543210'
      };

      const result = await updateUser(updateInput);

      expect(result.id).toBe(testUser.id);
      expect(result.phone).toBe('+9876543210');
      expect(result.email).toBe(testUser.email); // Unchanged
    });

    it('should update user role', async () => {
      const testUser = await createTestUser({ role: 'customer' });
      const updateInput: UpdateUserInput = {
        id: testUser.id,
        role: 'admin'
      };

      const result = await updateUser(updateInput);

      expect(result.id).toBe(testUser.id);
      expect(result.role).toBe('admin');
      expect(result.email).toBe(testUser.email); // Unchanged
    });

    it('should set phone to null', async () => {
      const testUser = await createTestUser({ phone: '+1234567890' });
      const updateInput: UpdateUserInput = {
        id: testUser.id,
        phone: null
      };

      const result = await updateUser(updateInput);

      expect(result.id).toBe(testUser.id);
      expect(result.phone).toBeNull();
    });

    it('should update multiple fields at once', async () => {
      const testUser = await createTestUser();
      const updateInput: UpdateUserInput = {
        id: testUser.id,
        email: 'multi@example.com',
        full_name: 'Multi Update User',
        role: 'admin',
        phone: '+5555555555'
      };

      const result = await updateUser(updateInput);

      expect(result.id).toBe(testUser.id);
      expect(result.email).toBe('multi@example.com');
      expect(result.full_name).toBe('Multi Update User');
      expect(result.role).toBe('admin');
      expect(result.phone).toBe('+5555555555');
      expect(result.updated_at.getTime()).toBeGreaterThan(testUser.updated_at.getTime());
    });

    it('should persist changes to database', async () => {
      const testUser = await createTestUser();
      const updateInput: UpdateUserInput = {
        id: testUser.id,
        email: 'persistent@example.com'
      };

      await updateUser(updateInput);

      // Verify changes persisted in database
      const dbUser = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, testUser.id))
        .execute();

      expect(dbUser).toHaveLength(1);
      expect(dbUser[0].email).toBe('persistent@example.com');
    });

    it('should throw error for non-existent user', async () => {
      const updateInput: UpdateUserInput = {
        id: 999,
        email: 'nonexistent@example.com'
      };

      await expect(updateUser(updateInput)).rejects.toThrow(/User with ID 999 not found/i);
    });
  });

  describe('deleteUser', () => {
    it('should delete existing user', async () => {
      const testUser = await createTestUser();

      const result = await deleteUser(testUser.id);

      expect(result.success).toBe(true);

      // Verify user is deleted from database
      const dbUser = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, testUser.id))
        .execute();

      expect(dbUser).toHaveLength(0);
    });

    it('should delete correct user when multiple exist', async () => {
      const user1 = await createTestUser({ email: 'user1@example.com' });
      const user2 = await createTestUser({ email: 'user2@example.com' });
      const user3 = await createTestUser({ email: 'user3@example.com' });

      const result = await deleteUser(user2.id);

      expect(result.success).toBe(true);

      // Verify only user2 is deleted
      const remainingUsers = await db.select()
        .from(usersTable)
        .execute();

      expect(remainingUsers).toHaveLength(2);
      expect(remainingUsers.some(u => u.id === user1.id)).toBe(true);
      expect(remainingUsers.some(u => u.id === user3.id)).toBe(true);
      expect(remainingUsers.some(u => u.id === user2.id)).toBe(false);
    });

    it('should throw error for non-existent user', async () => {
      await expect(deleteUser(999)).rejects.toThrow(/User with ID 999 not found/i);
    });

    it('should throw error when trying to delete already deleted user', async () => {
      const testUser = await createTestUser();
      
      // Delete user first time
      await deleteUser(testUser.id);
      
      // Try to delete again
      await expect(deleteUser(testUser.id)).rejects.toThrow(/User with ID .+ not found/i);
    });
  });
});