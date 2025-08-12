import { db } from '../db';
import { usersTable } from '../db/schema';
import { type UpdateUserInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

export async function getUsers(): Promise<User[]> {
  try {
    const result = await db.select()
      .from(usersTable)
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
}

export async function getUserById(id: number): Promise<User | null> {
  try {
    const result = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .execute();

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('Failed to fetch user by ID:', error);
    throw error;
  }
}

export async function updateUser(input: UpdateUserInput): Promise<User> {
  try {
    // Build update object with only provided fields
    const updateData: Partial<typeof usersTable.$inferInsert> = {};
    
    if (input.email !== undefined) updateData.email = input.email;
    if (input.full_name !== undefined) updateData.full_name = input.full_name;
    if (input.phone !== undefined) updateData.phone = input.phone;
    if (input.role !== undefined) updateData.role = input.role;
    
    // Always update the updated_at timestamp
    updateData.updated_at = new Date();

    const result = await db.update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`User with ID ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Failed to update user:', error);
    throw error;
  }
}

export async function deleteUser(id: number): Promise<{ success: boolean }> {
  try {
    const result = await db.delete(usersTable)
      .where(eq(usersTable.id, id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`User with ID ${id} not found`);
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to delete user:', error);
    throw error;
  }
}