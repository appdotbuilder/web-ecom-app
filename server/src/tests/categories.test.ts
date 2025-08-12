import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable, productsTable } from '../db/schema';
import { type CreateCategoryInput, type UpdateCategoryInput } from '../schema';
import { 
  createCategory, 
  getCategories, 
  getCategoryById, 
  updateCategory, 
  deleteCategory 
} from '../handlers/categories';
import { eq } from 'drizzle-orm';

// Test inputs
const testCategoryInput: CreateCategoryInput = {
  name: 'Test Category',
  description: 'A category for testing purposes'
};

const testCategoryInputNoDescription: CreateCategoryInput = {
  name: 'Minimal Category',
  description: null
};

describe('Categories Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createCategory', () => {
    it('should create a category with description', async () => {
      const result = await createCategory(testCategoryInput);

      expect(result.id).toBeDefined();
      expect(result.name).toEqual('Test Category');
      expect(result.description).toEqual('A category for testing purposes');
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create a category without description', async () => {
      const result = await createCategory(testCategoryInputNoDescription);

      expect(result.id).toBeDefined();
      expect(result.name).toEqual('Minimal Category');
      expect(result.description).toBeNull();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save category to database', async () => {
      const result = await createCategory(testCategoryInput);

      const categories = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, result.id))
        .execute();

      expect(categories).toHaveLength(1);
      expect(categories[0].name).toEqual('Test Category');
      expect(categories[0].description).toEqual('A category for testing purposes');
      expect(categories[0].created_at).toBeInstanceOf(Date);
    });
  });

  describe('getCategories', () => {
    it('should return empty array when no categories exist', async () => {
      const result = await getCategories();
      expect(result).toHaveLength(0);
    });

    it('should return all categories', async () => {
      // Create test categories
      await createCategory(testCategoryInput);
      await createCategory(testCategoryInputNoDescription);

      const result = await getCategories();

      expect(result).toHaveLength(2);
      expect(result.some(cat => cat.name === 'Test Category')).toBe(true);
      expect(result.some(cat => cat.name === 'Minimal Category')).toBe(true);
    });

    it('should return categories with correct structure', async () => {
      await createCategory(testCategoryInput);

      const result = await getCategories();

      expect(result).toHaveLength(1);
      const category = result[0];
      expect(category.id).toBeDefined();
      expect(category.name).toEqual('Test Category');
      expect(category.description).toEqual('A category for testing purposes');
      expect(category.created_at).toBeInstanceOf(Date);
      expect(category.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('getCategoryById', () => {
    it('should return null for non-existent category', async () => {
      const result = await getCategoryById(999);
      expect(result).toBeNull();
    });

    it('should return category by ID', async () => {
      const created = await createCategory(testCategoryInput);
      const result = await getCategoryById(created.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(created.id);
      expect(result!.name).toEqual('Test Category');
      expect(result!.description).toEqual('A category for testing purposes');
      expect(result!.created_at).toBeInstanceOf(Date);
    });
  });

  describe('updateCategory', () => {
    it('should update category name only', async () => {
      const created = await createCategory(testCategoryInput);
      
      const updateInput: UpdateCategoryInput = {
        id: created.id,
        name: 'Updated Category Name'
      };

      const result = await updateCategory(updateInput);

      expect(result.id).toEqual(created.id);
      expect(result.name).toEqual('Updated Category Name');
      expect(result.description).toEqual('A category for testing purposes'); // Unchanged
      expect(result.updated_at.getTime()).toBeGreaterThan(created.updated_at.getTime());
    });

    it('should update category description only', async () => {
      const created = await createCategory(testCategoryInput);
      
      const updateInput: UpdateCategoryInput = {
        id: created.id,
        description: 'Updated description'
      };

      const result = await updateCategory(updateInput);

      expect(result.id).toEqual(created.id);
      expect(result.name).toEqual('Test Category'); // Unchanged
      expect(result.description).toEqual('Updated description');
      expect(result.updated_at.getTime()).toBeGreaterThan(created.updated_at.getTime());
    });

    it('should update both name and description', async () => {
      const created = await createCategory(testCategoryInput);
      
      const updateInput: UpdateCategoryInput = {
        id: created.id,
        name: 'New Name',
        description: 'New description'
      };

      const result = await updateCategory(updateInput);

      expect(result.id).toEqual(created.id);
      expect(result.name).toEqual('New Name');
      expect(result.description).toEqual('New description');
      expect(result.updated_at.getTime()).toBeGreaterThan(created.updated_at.getTime());
    });

    it('should set description to null', async () => {
      const created = await createCategory(testCategoryInput);
      
      const updateInput: UpdateCategoryInput = {
        id: created.id,
        description: null
      };

      const result = await updateCategory(updateInput);

      expect(result.id).toEqual(created.id);
      expect(result.name).toEqual('Test Category'); // Unchanged
      expect(result.description).toBeNull();
    });

    it('should save updates to database', async () => {
      const created = await createCategory(testCategoryInput);
      
      const updateInput: UpdateCategoryInput = {
        id: created.id,
        name: 'Database Updated'
      };

      await updateCategory(updateInput);

      const fromDb = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, created.id))
        .execute();

      expect(fromDb).toHaveLength(1);
      expect(fromDb[0].name).toEqual('Database Updated');
    });

    it('should throw error for non-existent category', async () => {
      const updateInput: UpdateCategoryInput = {
        id: 999,
        name: 'Non-existent'
      };

      await expect(updateCategory(updateInput)).rejects.toThrow(/Category not found/i);
    });
  });

  describe('deleteCategory', () => {
    it('should delete category successfully', async () => {
      const created = await createCategory(testCategoryInput);
      
      const result = await deleteCategory(created.id);
      
      expect(result.success).toBe(true);

      // Verify deletion
      const fromDb = await getCategoryById(created.id);
      expect(fromDb).toBeNull();
    });

    it('should throw error when deleting non-existent category', async () => {
      await expect(deleteCategory(999)).rejects.toThrow(/Category not found/i);
    });

    it('should prevent deletion of category with products', async () => {
      // First create a category
      const category = await createCategory(testCategoryInput);

      // Create a product in this category
      await db.insert(productsTable)
        .values({
          name: 'Test Product',
          description: 'Product description',
          price: '99.99',
          stock_quantity: 10,
          category_id: category.id,
          weight: '500.00',
          is_active: true
        })
        .execute();

      // Attempt to delete category should fail
      await expect(deleteCategory(category.id)).rejects.toThrow(/Cannot delete category with existing products/i);
    });

    it('should allow deletion after removing all products', async () => {
      // Create category and product
      const category = await createCategory(testCategoryInput);
      
      const productResult = await db.insert(productsTable)
        .values({
          name: 'Test Product',
          description: 'Product description',
          price: '99.99',
          stock_quantity: 10,
          category_id: category.id,
          weight: '500.00',
          is_active: true
        })
        .returning()
        .execute();

      // Delete the product first
      await db.delete(productsTable)
        .where(eq(productsTable.id, productResult[0].id))
        .execute();

      // Now category deletion should succeed
      const result = await deleteCategory(category.id);
      expect(result.success).toBe(true);

      // Verify deletion
      const fromDb = await getCategoryById(category.id);
      expect(fromDb).toBeNull();
    });
  });
});