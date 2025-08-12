import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, productsTable, cartItemsTable } from '../db/schema';
import { type AddToCartInput, type UpdateCartItemInput } from '../schema';
import { 
  addToCart, 
  getCartByUserId, 
  updateCartItem, 
  removeCartItem, 
  clearCart, 
  getCartTotal 
} from '../handlers/cart';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashedpassword',
  full_name: 'Test User',
  phone: null,
  role: 'customer' as const
};

const testCategory = {
  name: 'Test Category',
  description: 'A test category'
};

const testProduct = {
  name: 'Test Product',
  description: 'A test product',
  price: '19.99',
  stock_quantity: 100,
  category_id: 1,
  image_url: null,
  weight: '500.00',
  is_active: true
};

const testInactiveProduct = {
  name: 'Inactive Product',
  description: 'An inactive test product',
  price: '29.99',
  stock_quantity: 50,
  category_id: 1,
  image_url: null,
  weight: '750.00',
  is_active: false
};

describe('Cart Handlers', () => {
  let userId: number;
  let categoryId: number;
  let productId: number;
  let inactiveProductId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test user
    const user = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = user[0].id;

    // Create test category
    const category = await db.insert(categoriesTable)
      .values(testCategory)
      .returning()
      .execute();
    categoryId = category[0].id;

    // Create test products
    const product = await db.insert(productsTable)
      .values({ ...testProduct, category_id: categoryId })
      .returning()
      .execute();
    productId = product[0].id;

    const inactiveProduct = await db.insert(productsTable)
      .values({ ...testInactiveProduct, category_id: categoryId })
      .returning()
      .execute();
    inactiveProductId = inactiveProduct[0].id;
  });

  afterEach(resetDB);

  describe('addToCart', () => {
    const addToCartInput: AddToCartInput = {
      user_id: 1, // Will be set to userId in tests
      product_id: 1, // Will be set to productId in tests
      quantity: 2
    };

    it('should add a new product to cart', async () => {
      const input = { ...addToCartInput, user_id: userId, product_id: productId };
      const result = await addToCart(input);

      expect(result.user_id).toEqual(userId);
      expect(result.product_id).toEqual(productId);
      expect(result.quantity).toEqual(2);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should update quantity if product already exists in cart', async () => {
      const input = { ...addToCartInput, user_id: userId, product_id: productId };
      
      // Add product first time
      const firstAdd = await addToCart(input);
      
      // Add same product again
      const secondAdd = await addToCart(input);

      expect(secondAdd.id).toEqual(firstAdd.id);
      expect(secondAdd.quantity).toEqual(4); // 2 + 2
      expect(secondAdd.updated_at.getTime()).toBeGreaterThan(firstAdd.updated_at.getTime());
    });

    it('should save cart item to database', async () => {
      const input = { ...addToCartInput, user_id: userId, product_id: productId };
      const result = await addToCart(input);

      const cartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.id, result.id))
        .execute();

      expect(cartItems).toHaveLength(1);
      expect(cartItems[0].user_id).toEqual(userId);
      expect(cartItems[0].product_id).toEqual(productId);
      expect(cartItems[0].quantity).toEqual(2);
    });

    it('should throw error for non-existent user', async () => {
      const input = { ...addToCartInput, user_id: 99999, product_id: productId };
      
      await expect(addToCart(input)).rejects.toThrow(/user not found/i);
    });

    it('should throw error for non-existent product', async () => {
      const input = { ...addToCartInput, user_id: userId, product_id: 99999 };
      
      await expect(addToCart(input)).rejects.toThrow(/product not found or not active/i);
    });

    it('should throw error for inactive product', async () => {
      const input = { ...addToCartInput, user_id: userId, product_id: inactiveProductId };
      
      await expect(addToCart(input)).rejects.toThrow(/product not found or not active/i);
    });
  });

  describe('getCartByUserId', () => {
    it('should return empty array for user with no cart items', async () => {
      const result = await getCartByUserId(userId);
      expect(result).toEqual([]);
    });

    it('should return all cart items for user', async () => {
      // Add items to cart
      await addToCart({ user_id: userId, product_id: productId, quantity: 2 });
      
      const result = await getCartByUserId(userId);

      expect(result).toHaveLength(1);
      expect(result[0].user_id).toEqual(userId);
      expect(result[0].product_id).toEqual(productId);
      expect(result[0].quantity).toEqual(2);
    });

    it('should throw error for non-existent user', async () => {
      await expect(getCartByUserId(99999)).rejects.toThrow(/user not found/i);
    });
  });

  describe('updateCartItem', () => {
    let cartItemId: number;

    beforeEach(async () => {
      const cartItem = await addToCart({ 
        user_id: userId, 
        product_id: productId, 
        quantity: 2 
      });
      cartItemId = cartItem.id;
    });

    it('should update cart item quantity', async () => {
      const input: UpdateCartItemInput = {
        id: cartItemId,
        quantity: 5
      };

      const result = await updateCartItem(input);

      expect(result.id).toEqual(cartItemId);
      expect(result.quantity).toEqual(5);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save updated quantity to database', async () => {
      const input: UpdateCartItemInput = {
        id: cartItemId,
        quantity: 3
      };

      await updateCartItem(input);

      const cartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.id, cartItemId))
        .execute();

      expect(cartItems[0].quantity).toEqual(3);
    });

    it('should throw error for non-existent cart item', async () => {
      const input: UpdateCartItemInput = {
        id: 99999,
        quantity: 5
      };

      await expect(updateCartItem(input)).rejects.toThrow(/cart item not found/i);
    });
  });

  describe('removeCartItem', () => {
    let cartItemId: number;

    beforeEach(async () => {
      const cartItem = await addToCart({ 
        user_id: userId, 
        product_id: productId, 
        quantity: 2 
      });
      cartItemId = cartItem.id;
    });

    it('should remove cart item successfully', async () => {
      const result = await removeCartItem(cartItemId, userId);
      expect(result.success).toBe(true);
    });

    it('should remove cart item from database', async () => {
      await removeCartItem(cartItemId, userId);

      const cartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.id, cartItemId))
        .execute();

      expect(cartItems).toHaveLength(0);
    });

    it('should throw error for non-existent cart item', async () => {
      await expect(removeCartItem(99999, userId)).rejects.toThrow(/cart item not found or does not belong to user/i);
    });

    it('should throw error when cart item belongs to different user', async () => {
      // Create another user
      const anotherUser = await db.insert(usersTable)
        .values({
          email: 'another@example.com',
          password_hash: 'hashedpassword',
          full_name: 'Another User',
          phone: null,
          role: 'customer' as const
        })
        .returning()
        .execute();

      await expect(removeCartItem(cartItemId, anotherUser[0].id)).rejects.toThrow(/cart item not found or does not belong to user/i);
    });
  });

  describe('clearCart', () => {
    beforeEach(async () => {
      // Add multiple items to cart
      await addToCart({ user_id: userId, product_id: productId, quantity: 2 });
    });

    it('should clear all cart items for user', async () => {
      const result = await clearCart(userId);
      expect(result.success).toBe(true);
    });

    it('should remove all cart items from database', async () => {
      await clearCart(userId);

      const cartItems = await db.select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.user_id, userId))
        .execute();

      expect(cartItems).toHaveLength(0);
    });

    it('should throw error for non-existent user', async () => {
      await expect(clearCart(99999)).rejects.toThrow(/user not found/i);
    });
  });

  describe('getCartTotal', () => {
    it('should return zero totals for empty cart', async () => {
      const result = await getCartTotal(userId);
      expect(result.subtotal).toEqual(0);
      expect(result.totalItems).toEqual(0);
    });

    it('should calculate correct totals for cart with items', async () => {
      // Add items to cart
      await addToCart({ user_id: userId, product_id: productId, quantity: 2 });

      const result = await getCartTotal(userId);

      expect(result.subtotal).toBeCloseTo(39.98, 2); // 19.99 * 2
      expect(result.totalItems).toEqual(2);
    });

    it('should calculate correct totals for multiple different products', async () => {
      // Create another product
      const anotherProduct = await db.insert(productsTable)
        .values({
          name: 'Another Product',
          description: 'Another test product',
          price: '25.50',
          stock_quantity: 50,
          category_id: categoryId,
          image_url: null,
          weight: '300.00',
          is_active: true
        })
        .returning()
        .execute();

      // Add items to cart
      await addToCart({ user_id: userId, product_id: productId, quantity: 2 });
      await addToCart({ user_id: userId, product_id: anotherProduct[0].id, quantity: 1 });

      const result = await getCartTotal(userId);

      expect(result.subtotal).toBeCloseTo(65.48, 2); // (19.99 * 2) + (25.50 * 1)
      expect(result.totalItems).toEqual(3); // 2 + 1
    });

    it('should throw error for non-existent user', async () => {
      await expect(getCartTotal(99999)).rejects.toThrow(/user not found/i);
    });
  });
});