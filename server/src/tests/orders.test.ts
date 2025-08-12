import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  ordersTable, 
  orderItemsTable, 
  usersTable, 
  categoriesTable, 
  productsTable, 
  customerAddressesTable 
} from '../db/schema';
import { 
  type CreateOrderInput,
  type UpdateOrderStatusInput,
  type GetOrdersInput
} from '../schema';
import {
  createOrder,
  getOrders,
  getOrderById,
  getOrdersByUserId,
  updateOrderStatus,
  cancelOrder,
  getOrderItems
} from '../handlers/orders';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashed_password',
  full_name: 'Test User',
  phone: '1234567890',
  role: 'customer' as const
};

const testCategory = {
  name: 'Electronics',
  description: 'Electronic products'
};

const testProduct = {
  name: 'Test Product',
  description: 'A test product',
  price: '29.99',
  stock_quantity: 100,
  category_id: 1, // Will be updated after category creation
  image_url: 'http://example.com/image.jpg',
  weight: '500.00',
  is_active: true
};

const testAddress = {
  user_id: 1, // Will be updated after user creation
  name: 'John Doe',
  phone: '1234567890',
  address_line1: '123 Test Street',
  address_line2: 'Apt 4B',
  city: 'Test City',
  province: 'Test Province',
  postal_code: '12345',
  is_default: true
};

describe('Orders Handler', () => {
  let userId: number;
  let categoryId: number;
  let productId: number;
  let addressId: number;

  beforeEach(async () => {
    await createDB();

    // Create test user
    const [user] = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = user.id;

    // Create test category
    const [category] = await db.insert(categoriesTable)
      .values(testCategory)
      .returning()
      .execute();
    categoryId = category.id;

    // Create test product
    const [product] = await db.insert(productsTable)
      .values({
        ...testProduct,
        category_id: categoryId
      })
      .returning()
      .execute();
    productId = product.id;

    // Create test address
    const [address] = await db.insert(customerAddressesTable)
      .values({
        ...testAddress,
        user_id: userId
      })
      .returning()
      .execute();
    addressId = address.id;
  });

  afterEach(resetDB);

  describe('createOrder', () => {
    const createOrderInput: CreateOrderInput = {
      user_id: 1, // Will be updated in test
      shipping_address_id: 1, // Will be updated in test
      items: [
        {
          product_id: 1, // Will be updated in test
          quantity: 2
        }
      ]
    };

    it('should create an order successfully', async () => {
      const input: CreateOrderInput = {
        ...createOrderInput,
        user_id: userId,
        shipping_address_id: addressId,
        items: [
          {
            product_id: productId,
            quantity: 2
          }
        ]
      };

      const result = await createOrder(input);

      expect(result.id).toBeDefined();
      expect(result.user_id).toBe(userId);
      expect(result.order_number).toMatch(/^ORD-\d+-[A-Z0-9]{6}$/);
      expect(result.status).toBe('pending');
      expect(typeof result.total_amount).toBe('number');
      expect(typeof result.shipping_cost).toBe('number');
      expect(result.total_amount).toBeGreaterThan(0);
      expect(result.shipping_cost).toBeGreaterThan(0);
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);

      // Verify shipping address is stored as JSON
      const shippingAddress = JSON.parse(result.shipping_address);
      expect(shippingAddress.name).toBe('John Doe');
      expect(shippingAddress.city).toBe('Test City');
    });

    it('should create order items and update product stock', async () => {
      const input: CreateOrderInput = {
        ...createOrderInput,
        user_id: userId,
        shipping_address_id: addressId,
        items: [
          {
            product_id: productId,
            quantity: 3
          }
        ]
      };

      const order = await createOrder(input);

      // Check order items were created
      const orderItems = await db.select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.order_id, order.id))
        .execute();

      expect(orderItems).toHaveLength(1);
      expect(orderItems[0].product_id).toBe(productId);
      expect(orderItems[0].quantity).toBe(3);
      expect(typeof parseFloat(orderItems[0].unit_price)).toBe('number');
      expect(typeof parseFloat(orderItems[0].total_price)).toBe('number');

      // Check product stock was updated
      const [updatedProduct] = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, productId))
        .execute();

      expect(updatedProduct.stock_quantity).toBe(97); // 100 - 3
    });

    it('should fail when shipping address does not belong to user', async () => {
      // Create address for different user
      const [otherUser] = await db.insert(usersTable)
        .values({
          ...testUser,
          email: 'other@example.com'
        })
        .returning()
        .execute();

      const [otherAddress] = await db.insert(customerAddressesTable)
        .values({
          ...testAddress,
          user_id: otherUser.id
        })
        .returning()
        .execute();

      const input: CreateOrderInput = {
        ...createOrderInput,
        user_id: userId,
        shipping_address_id: otherAddress.id,
        items: [
          {
            product_id: productId,
            quantity: 1
          }
        ]
      };

      await expect(createOrder(input)).rejects.toThrow(/shipping address not found or does not belong to user/i);
    });

    it('should fail when product does not exist', async () => {
      const input: CreateOrderInput = {
        ...createOrderInput,
        user_id: userId,
        shipping_address_id: addressId,
        items: [
          {
            product_id: 99999,
            quantity: 1
          }
        ]
      };

      await expect(createOrder(input)).rejects.toThrow(/product with id 99999 not found or inactive/i);
    });

    it('should fail when insufficient stock', async () => {
      const input: CreateOrderInput = {
        ...createOrderInput,
        user_id: userId,
        shipping_address_id: addressId,
        items: [
          {
            product_id: productId,
            quantity: 150 // More than available stock (100)
          }
        ]
      };

      await expect(createOrder(input)).rejects.toThrow(/insufficient stock/i);
    });
  });

  describe('getOrders', () => {
    let orderId: number;

    beforeEach(async () => {
      // Create test order
      const input: CreateOrderInput = {
        user_id: userId,
        shipping_address_id: addressId,
        items: [
          {
            product_id: productId,
            quantity: 1
          }
        ]
      };
      const order = await createOrder(input);
      orderId = order.id;
    });

    it('should fetch orders with pagination', async () => {
      const result = await getOrders({ page: 1, limit: 10 });

      expect(result.orders).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.orders[0].id).toBe(orderId);
      expect(typeof result.orders[0].total_amount).toBe('number');
      expect(typeof result.orders[0].shipping_cost).toBe('number');
    });

    it('should filter orders by user_id', async () => {
      const result = await getOrders({ user_id: userId });

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].user_id).toBe(userId);
    });

    it('should filter orders by status', async () => {
      const result = await getOrders({ status: 'pending' });

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].status).toBe('pending');
    });

    it('should return empty results for non-existent user', async () => {
      const result = await getOrders({ user_id: 99999 });

      expect(result.orders).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('getOrderById', () => {
    let orderId: number;

    beforeEach(async () => {
      const input: CreateOrderInput = {
        user_id: userId,
        shipping_address_id: addressId,
        items: [
          {
            product_id: productId,
            quantity: 1
          }
        ]
      };
      const order = await createOrder(input);
      orderId = order.id;
    });

    it('should fetch order by id', async () => {
      const result = await getOrderById(orderId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(orderId);
      expect(result!.user_id).toBe(userId);
      expect(typeof result!.total_amount).toBe('number');
      expect(typeof result!.shipping_cost).toBe('number');
    });

    it('should return null for non-existent order', async () => {
      const result = await getOrderById(99999);

      expect(result).toBeNull();
    });
  });

  describe('getOrdersByUserId', () => {
    let orderId: number;

    beforeEach(async () => {
      const input: CreateOrderInput = {
        user_id: userId,
        shipping_address_id: addressId,
        items: [
          {
            product_id: productId,
            quantity: 1
          }
        ]
      };
      const order = await createOrder(input);
      orderId = order.id;
    });

    it('should fetch orders by user id', async () => {
      const result = await getOrdersByUserId(userId);

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].id).toBe(orderId);
      expect(result.orders[0].user_id).toBe(userId);
    });

    it('should return empty results for user with no orders', async () => {
      const [otherUser] = await db.insert(usersTable)
        .values({
          ...testUser,
          email: 'other@example.com'
        })
        .returning()
        .execute();

      const result = await getOrdersByUserId(otherUser.id);

      expect(result.orders).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('updateOrderStatus', () => {
    let orderId: number;

    beforeEach(async () => {
      const input: CreateOrderInput = {
        user_id: userId,
        shipping_address_id: addressId,
        items: [
          {
            product_id: productId,
            quantity: 1
          }
        ]
      };
      const order = await createOrder(input);
      orderId = order.id;
    });

    it('should update order status', async () => {
      const input: UpdateOrderStatusInput = {
        id: orderId,
        status: 'paid'
      };

      const result = await updateOrderStatus(input);

      expect(result.id).toBe(orderId);
      expect(result.status).toBe('paid');
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should update order status with tracking number', async () => {
      const input: UpdateOrderStatusInput = {
        id: orderId,
        status: 'shipped',
        shipping_tracking_number: 'TRK123456789'
      };

      const result = await updateOrderStatus(input);

      expect(result.id).toBe(orderId);
      expect(result.status).toBe('shipped');
      expect(result.shipping_tracking_number).toBe('TRK123456789');
    });

    it('should fail for non-existent order', async () => {
      const input: UpdateOrderStatusInput = {
        id: 99999,
        status: 'paid'
      };

      await expect(updateOrderStatus(input)).rejects.toThrow(/order with id 99999 not found/i);
    });
  });

  describe('cancelOrder', () => {
    let orderId: number;

    beforeEach(async () => {
      const input: CreateOrderInput = {
        user_id: userId,
        shipping_address_id: addressId,
        items: [
          {
            product_id: productId,
            quantity: 5
          }
        ]
      };
      const order = await createOrder(input);
      orderId = order.id;
    });

    it('should cancel pending order and restore stock', async () => {
      // Check initial stock
      const [productBefore] = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, productId))
        .execute();

      const initialStock = productBefore.stock_quantity; // Should be 95 (100 - 5)

      const result = await cancelOrder(orderId, userId);

      expect(result.id).toBe(orderId);
      expect(result.status).toBe('cancelled');
      expect(result.user_id).toBe(userId);

      // Check stock was restored
      const [productAfter] = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, productId))
        .execute();

      expect(productAfter.stock_quantity).toBe(initialStock + 5); // Stock restored
    });

    it('should fail when order does not belong to user', async () => {
      const [otherUser] = await db.insert(usersTable)
        .values({
          ...testUser,
          email: 'other@example.com'
        })
        .returning()
        .execute();

      await expect(cancelOrder(orderId, otherUser.id)).rejects.toThrow(/not found or does not belong to user/i);
    });

    it('should fail when order is not pending', async () => {
      // Update order status to paid
      await db.update(ordersTable)
        .set({ status: 'paid' })
        .where(eq(ordersTable.id, orderId))
        .execute();

      await expect(cancelOrder(orderId, userId)).rejects.toThrow(/cannot cancel order with status 'paid'/i);
    });
  });

  describe('getOrderItems', () => {
    let orderId: number;

    beforeEach(async () => {
      const input: CreateOrderInput = {
        user_id: userId,
        shipping_address_id: addressId,
        items: [
          {
            product_id: productId,
            quantity: 2
          }
        ]
      };
      const order = await createOrder(input);
      orderId = order.id;
    });

    it('should fetch order items', async () => {
      const result = await getOrderItems(orderId);

      expect(result).toHaveLength(1);
      expect(result[0].order_id).toBe(orderId);
      expect(result[0].product_id).toBe(productId);
      expect(result[0].quantity).toBe(2);
      expect(typeof result[0].unit_price).toBe('number');
      expect(typeof result[0].total_price).toBe('number');
      expect(result[0].created_at).toBeInstanceOf(Date);
    });

    it('should return empty array for order with no items', async () => {
      // Create order manually without items for edge case
      const [emptyOrder] = await db.insert(ordersTable)
        .values({
          user_id: userId,
          order_number: 'TEST-EMPTY',
          status: 'pending',
          total_amount: '0.00',
          shipping_cost: '0.00',
          shipping_address: '{}'
        })
        .returning()
        .execute();

      const result = await getOrderItems(emptyOrder.id);

      expect(result).toHaveLength(0);
    });
  });
});