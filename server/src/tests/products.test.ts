import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable, productsTable, orderItemsTable, ordersTable, usersTable } from '../db/schema';
import { type CreateProductInput, type UpdateProductInput, type GetProductsInput } from '../schema';
import { 
  createProduct, 
  getProducts, 
  getProductById, 
  updateProduct, 
  deleteProduct, 
  updateProductStock 
} from '../handlers/products';
import { eq } from 'drizzle-orm';

// Test data
const testCategory = {
  name: 'Electronics',
  description: 'Electronic products'
};

const testProductInput: CreateProductInput = {
  name: 'Test Laptop',
  description: 'A high-performance laptop for testing',
  price: 999.99,
  stock_quantity: 10,
  category_id: 1, // Will be set after category creation
  image_url: 'https://example.com/laptop.jpg',
  weight: 2500.0, // 2.5kg in grams
  is_active: true
};

describe('Products Handler', () => {
  let categoryId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create a category for testing
    const categoryResult = await db.insert(categoriesTable)
      .values(testCategory)
      .returning()
      .execute();
    
    categoryId = categoryResult[0].id;
    testProductInput.category_id = categoryId;
  });

  afterEach(resetDB);

  describe('createProduct', () => {
    it('should create a product successfully', async () => {
      const result = await createProduct(testProductInput);

      expect(result.name).toEqual('Test Laptop');
      expect(result.description).toEqual(testProductInput.description);
      expect(result.price).toEqual(999.99);
      expect(typeof result.price).toBe('number');
      expect(result.stock_quantity).toEqual(10);
      expect(result.category_id).toEqual(categoryId);
      expect(result.image_url).toEqual('https://example.com/laptop.jpg');
      expect(result.weight).toEqual(2500.0);
      expect(typeof result.weight).toBe('number');
      expect(result.is_active).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save product to database correctly', async () => {
      const result = await createProduct(testProductInput);

      const products = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, result.id))
        .execute();

      expect(products).toHaveLength(1);
      expect(products[0].name).toEqual('Test Laptop');
      expect(parseFloat(products[0].price)).toEqual(999.99);
      expect(parseFloat(products[0].weight)).toEqual(2500.0);
      expect(products[0].category_id).toEqual(categoryId);
    });

    it('should throw error when category does not exist', async () => {
      const invalidInput = {
        ...testProductInput,
        category_id: 9999
      };

      await expect(createProduct(invalidInput)).rejects.toThrow(/Category with id 9999 does not exist/i);
    });

    it('should handle products with null description and image_url', async () => {
      const input: CreateProductInput = {
        ...testProductInput,
        description: null,
        image_url: null
      };

      const result = await createProduct(input);

      expect(result.description).toBeNull();
      expect(result.image_url).toBeNull();
    });
  });

  describe('getProducts', () => {
    beforeEach(async () => {
      // Create multiple products for testing
      await createProduct({
        ...testProductInput,
        name: 'Gaming Laptop',
        price: 1299.99,
        is_active: true
      });

      await createProduct({
        ...testProductInput,
        name: 'Office Laptop',
        price: 699.99,
        is_active: false
      });

      await createProduct({
        ...testProductInput,
        name: 'Ultrabook',
        description: 'Thin and light ultrabook',
        price: 899.99,
        is_active: true
      });
    });

    it('should return all products with default pagination', async () => {
      const result = await getProducts();

      expect(result.products).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(typeof result.products[0].price).toBe('number');
      expect(typeof result.products[0].weight).toBe('number');
    });

    it('should filter products by category_id', async () => {
      const result = await getProducts({ category_id: categoryId });

      expect(result.products).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.products.every(p => p.category_id === categoryId)).toBe(true);
    });

    it('should filter products by is_active status', async () => {
      const activeResult = await getProducts({ is_active: true });
      const inactiveResult = await getProducts({ is_active: false });

      expect(activeResult.products).toHaveLength(2);
      expect(activeResult.total).toBe(2);
      expect(inactiveResult.products).toHaveLength(1);
      expect(inactiveResult.total).toBe(1);
    });

    it('should search products by name', async () => {
      const result = await getProducts({ search: 'Gaming' });

      expect(result.products).toHaveLength(1);
      expect(result.products[0].name).toEqual('Gaming Laptop');
    });

    it('should search products by description', async () => {
      const result = await getProducts({ search: 'ultrabook' });

      expect(result.products).toHaveLength(1);
      expect(result.products[0].name).toEqual('Ultrabook');
    });

    it('should handle pagination correctly', async () => {
      const result = await getProducts({ page: 2, limit: 2 });

      expect(result.products).toHaveLength(1);
      expect(result.total).toBe(3);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(2);
    });

    it('should combine multiple filters', async () => {
      const result = await getProducts({ 
        category_id: categoryId,
        is_active: true,
        search: 'Laptop'
      });

      expect(result.products).toHaveLength(1);
      expect(result.products.every(p => p.is_active === true)).toBe(true);
      expect(result.products.every(p => p.category_id === categoryId)).toBe(true);
      expect(result.products[0].name).toEqual('Gaming Laptop');
    });
  });

  describe('getProductById', () => {
    it('should return product by id', async () => {
      const created = await createProduct(testProductInput);
      const result = await getProductById(created.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(created.id);
      expect(result!.name).toEqual('Test Laptop');
      expect(typeof result!.price).toBe('number');
      expect(typeof result!.weight).toBe('number');
    });

    it('should return null for non-existent product', async () => {
      const result = await getProductById(9999);
      expect(result).toBeNull();
    });
  });

  describe('updateProduct', () => {
    let productId: number;

    beforeEach(async () => {
      const created = await createProduct(testProductInput);
      productId = created.id;
    });

    it('should update product fields', async () => {
      const updateInput: UpdateProductInput = {
        id: productId,
        name: 'Updated Laptop',
        price: 1199.99,
        stock_quantity: 5,
        is_active: false
      };

      const result = await updateProduct(updateInput);

      expect(result.id).toEqual(productId);
      expect(result.name).toEqual('Updated Laptop');
      expect(result.price).toEqual(1199.99);
      expect(typeof result.price).toBe('number');
      expect(result.stock_quantity).toEqual(5);
      expect(result.is_active).toBe(false);
      expect(result.updated_at.getTime()).toBeGreaterThan(result.created_at.getTime());
    });

    it('should update only specified fields', async () => {
      const updateInput: UpdateProductInput = {
        id: productId,
        name: 'Partially Updated Laptop'
      };

      const result = await updateProduct(updateInput);

      expect(result.name).toEqual('Partially Updated Laptop');
      expect(result.price).toEqual(999.99); // Should remain unchanged
      expect(result.stock_quantity).toEqual(10); // Should remain unchanged
    });

    it('should validate category exists when updating category_id', async () => {
      const updateInput: UpdateProductInput = {
        id: productId,
        category_id: 9999
      };

      await expect(updateProduct(updateInput)).rejects.toThrow(/Category with id 9999 does not exist/i);
    });

    it('should throw error for non-existent product', async () => {
      const updateInput: UpdateProductInput = {
        id: 9999,
        name: 'Non-existent Product'
      };

      await expect(updateProduct(updateInput)).rejects.toThrow(/Product with id 9999 not found/i);
    });
  });

  describe('deleteProduct', () => {
    let productId: number;

    beforeEach(async () => {
      const created = await createProduct(testProductInput);
      productId = created.id;
    });

    it('should delete product successfully', async () => {
      const result = await deleteProduct(productId);

      expect(result.success).toBe(true);

      const deletedProduct = await getProductById(productId);
      expect(deletedProduct).toBeNull();
    });

    it('should throw error for non-existent product', async () => {
      await expect(deleteProduct(9999)).rejects.toThrow(/Product with id 9999 not found/i);
    });

    it('should prevent deletion of products referenced in orders', async () => {
      // Create user and order first
      const userResult = await db.insert(usersTable)
        .values({
          email: 'test@example.com',
          password_hash: 'hashedpassword',
          full_name: 'Test User',
          role: 'customer'
        })
        .returning()
        .execute();

      const orderResult = await db.insert(ordersTable)
        .values({
          user_id: userResult[0].id,
          order_number: 'ORDER-001',
          status: 'pending',
          total_amount: '999.99',
          shipping_cost: '10.00',
          shipping_address: JSON.stringify({ address: 'Test Address' })
        })
        .returning()
        .execute();

      // Create order item referencing the product
      await db.insert(orderItemsTable)
        .values({
          order_id: orderResult[0].id,
          product_id: productId,
          quantity: 1,
          unit_price: '999.99',
          total_price: '999.99'
        })
        .execute();

      await expect(deleteProduct(productId)).rejects.toThrow(/Cannot delete product.*referenced in existing orders/i);
    });
  });

  describe('updateProductStock', () => {
    let productId: number;

    beforeEach(async () => {
      const created = await createProduct(testProductInput);
      productId = created.id;
    });

    it('should update stock quantity', async () => {
      const result = await updateProductStock(productId, 25);

      expect(result.id).toEqual(productId);
      expect(result.stock_quantity).toEqual(25);
      expect(result.updated_at.getTime()).toBeGreaterThan(result.created_at.getTime());
    });

    it('should allow zero stock quantity', async () => {
      const result = await updateProductStock(productId, 0);

      expect(result.stock_quantity).toEqual(0);
    });

    it('should throw error for negative stock quantity', async () => {
      await expect(updateProductStock(productId, -5)).rejects.toThrow(/Stock quantity cannot be negative/i);
    });

    it('should throw error for non-existent product', async () => {
      await expect(updateProductStock(9999, 10)).rejects.toThrow(/Product with id 9999 not found/i);
    });
  });
});