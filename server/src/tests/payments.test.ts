import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, productsTable, ordersTable, paymentsTable, customerAddressesTable } from '../db/schema';
import { type ProcessPaymentInput } from '../schema';
import { 
  processPayment, 
  handlePaymentNotification, 
  getPaymentByOrderId, 
  checkPaymentStatus, 
  refundPayment 
} from '../handlers/payments';
import { eq } from 'drizzle-orm';

describe('Payment Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create prerequisite data
  const createTestData = async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        full_name: 'Test User',
        phone: '1234567890',
        role: 'customer'
      })
      .returning()
      .execute();
    
    const user = userResult[0];

    // Create category
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Test Category',
        description: 'Test category description'
      })
      .returning()
      .execute();
    
    const category = categoryResult[0];

    // Create product
    const productResult = await db.insert(productsTable)
      .values({
        name: 'Test Product',
        description: 'Test product description',
        price: '100.00',
        stock_quantity: 10,
        category_id: category.id,
        weight: '500.00',
        is_active: true
      })
      .returning()
      .execute();
    
    const product = productResult[0];

    // Create customer address
    const addressResult = await db.insert(customerAddressesTable)
      .values({
        user_id: user.id,
        name: 'Test User',
        phone: '1234567890',
        address_line1: '123 Test Street',
        city: 'Test City',
        province: 'Test Province',
        postal_code: '12345',
        is_default: true
      })
      .returning()
      .execute();
    
    const address = addressResult[0];

    // Create order
    const orderResult = await db.insert(ordersTable)
      .values({
        user_id: user.id,
        order_number: 'ORD-TEST-001',
        status: 'pending',
        total_amount: '150.00',
        shipping_cost: '50.00',
        shipping_address: JSON.stringify(address)
      })
      .returning()
      .execute();

    return {
      user,
      category,
      product,
      address,
      order: orderResult[0]
    };
  };

  describe('processPayment', () => {
    it('should create a payment record for valid order', async () => {
      const { order } = await createTestData();
      
      const input: ProcessPaymentInput = {
        order_id: order.id,
        payment_method: 'credit_card'
      };

      const result = await processPayment(input);

      expect(result.order_id).toEqual(order.id);
      expect(result.payment_method).toEqual('credit_card');
      expect(result.payment_status).toEqual('pending');
      expect(result.amount).toEqual(150.00);
      expect(result.midtrans_transaction_id).toBeDefined();
      expect(result.midtrans_payment_type).toEqual('credit_card');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(typeof result.amount).toBe('number');
    });

    it('should save payment to database', async () => {
      const { order } = await createTestData();
      
      const input: ProcessPaymentInput = {
        order_id: order.id,
        payment_method: 'bank_transfer'
      };

      const result = await processPayment(input);

      const payments = await db.select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, result.id))
        .execute();

      expect(payments).toHaveLength(1);
      expect(payments[0].order_id).toEqual(order.id);
      expect(payments[0].payment_method).toEqual('bank_transfer');
      expect(parseFloat(payments[0].amount)).toEqual(150.00);
    });

    it('should throw error for non-existent order', async () => {
      const input: ProcessPaymentInput = {
        order_id: 9999,
        payment_method: 'credit_card'
      };

      await expect(processPayment(input)).rejects.toThrow(/Order with ID 9999 not found/i);
    });

    it('should throw error if payment already exists for order', async () => {
      const { order } = await createTestData();
      
      const input: ProcessPaymentInput = {
        order_id: order.id,
        payment_method: 'credit_card'
      };

      // Create first payment
      await processPayment(input);

      // Try to create second payment for same order
      await expect(processPayment(input)).rejects.toThrow(/Payment already exists for order/i);
    });
  });

  describe('handlePaymentNotification', () => {
    it('should update payment status to paid for successful notification', async () => {
      const { order } = await createTestData();
      
      // Create payment first
      const payment = await processPayment({
        order_id: order.id,
        payment_method: 'credit_card'
      });

      const notification = {
        transaction_id: payment.midtrans_transaction_id,
        transaction_status: 'settlement',
        payment_type: 'credit_card'
      };

      const result = await handlePaymentNotification(notification);

      expect(result.success).toBe(true);

      // Check payment status updated
      const updatedPayment = await db.select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, payment.id))
        .execute();

      expect(updatedPayment[0].payment_status).toEqual('paid');
      expect(updatedPayment[0].paid_at).toBeInstanceOf(Date);

      // Check order status updated
      const updatedOrder = await db.select()
        .from(ordersTable)
        .where(eq(ordersTable.id, order.id))
        .execute();

      expect(updatedOrder[0].status).toEqual('paid');
    });

    it('should handle cancelled payment notification', async () => {
      const { order } = await createTestData();
      
      const payment = await processPayment({
        order_id: order.id,
        payment_method: 'bank_transfer'
      });

      const notification = {
        transaction_id: payment.midtrans_transaction_id,
        transaction_status: 'cancel',
        payment_type: 'bank_transfer'
      };

      const result = await handlePaymentNotification(notification);

      expect(result.success).toBe(true);

      const updatedPayment = await db.select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, payment.id))
        .execute();

      expect(updatedPayment[0].payment_status).toEqual('cancelled');
      expect(updatedPayment[0].paid_at).toBeNull();
    });

    it('should handle failed payment notification', async () => {
      const { order } = await createTestData();
      
      const payment = await processPayment({
        order_id: order.id,
        payment_method: 'e_wallet'
      });

      const notification = {
        transaction_id: payment.midtrans_transaction_id,
        transaction_status: 'failure',
        payment_type: 'gopay'
      };

      const result = await handlePaymentNotification(notification);

      expect(result.success).toBe(true);

      const updatedPayment = await db.select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, payment.id))
        .execute();

      expect(updatedPayment[0].payment_status).toEqual('failed');
    });

    it('should throw error for missing transaction_id', async () => {
      const notification = {
        transaction_status: 'settlement',
        payment_type: 'credit_card'
      };

      await expect(handlePaymentNotification(notification)).rejects.toThrow(/Missing transaction_id/i);
    });

    it('should throw error for non-existent transaction', async () => {
      const notification = {
        transaction_id: 'NON_EXISTENT_ID',
        transaction_status: 'settlement',
        payment_type: 'credit_card'
      };

      await expect(handlePaymentNotification(notification)).rejects.toThrow(/Payment not found for transaction ID/i);
    });
  });

  describe('getPaymentByOrderId', () => {
    it('should return payment for existing order', async () => {
      const { order } = await createTestData();
      
      const payment = await processPayment({
        order_id: order.id,
        payment_method: 'credit_card'
      });

      const result = await getPaymentByOrderId(order.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(payment.id);
      expect(result!.order_id).toEqual(order.id);
      expect(result!.amount).toEqual(150.00);
      expect(typeof result!.amount).toBe('number');
    });

    it('should return null for order without payment', async () => {
      const { order } = await createTestData();

      const result = await getPaymentByOrderId(order.id);

      expect(result).toBeNull();
    });

    it('should return null for non-existent order', async () => {
      const result = await getPaymentByOrderId(9999);

      expect(result).toBeNull();
    });
  });

  describe('checkPaymentStatus', () => {
    it('should return payment for existing payment ID', async () => {
      const { order } = await createTestData();
      
      const payment = await processPayment({
        order_id: order.id,
        payment_method: 'bank_transfer'
      });

      const result = await checkPaymentStatus(payment.id);

      expect(result.id).toEqual(payment.id);
      expect(result.order_id).toEqual(order.id);
      expect(result.payment_status).toEqual('pending');
      expect(result.amount).toEqual(150.00);
      expect(typeof result.amount).toBe('number');
    });

    it('should throw error for non-existent payment ID', async () => {
      await expect(checkPaymentStatus(9999)).rejects.toThrow(/Payment with ID 9999 not found/i);
    });
  });

  describe('refundPayment', () => {
    it('should process full refund for paid payment', async () => {
      const { order } = await createTestData();
      
      // Create and mark payment as paid
      const payment = await processPayment({
        order_id: order.id,
        payment_method: 'credit_card'
      });

      await db.update(paymentsTable)
        .set({ payment_status: 'paid', paid_at: new Date() })
        .where(eq(paymentsTable.id, payment.id))
        .execute();

      const result = await refundPayment(payment.id);

      expect(result.success).toBe(true);
      expect(result.refund_id).toMatch(/^REF-\d+-\d+$/);

      // Check payment status updated to cancelled
      const updatedPayment = await db.select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, payment.id))
        .execute();

      expect(updatedPayment[0].payment_status).toEqual('cancelled');
    });

    it('should process partial refund for paid payment', async () => {
      const { order } = await createTestData();
      
      const payment = await processPayment({
        order_id: order.id,
        payment_method: 'credit_card'
      });

      await db.update(paymentsTable)
        .set({ payment_status: 'paid', paid_at: new Date() })
        .where(eq(paymentsTable.id, payment.id))
        .execute();

      const result = await refundPayment(payment.id, 50.00);

      expect(result.success).toBe(true);
      expect(result.refund_id).toMatch(/^REF-\d+-\d+$/);

      // Payment status should remain 'paid' for partial refund
      const updatedPayment = await db.select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, payment.id))
        .execute();

      expect(updatedPayment[0].payment_status).toEqual('paid');
    });

    it('should throw error for non-existent payment', async () => {
      await expect(refundPayment(9999)).rejects.toThrow(/Payment with ID 9999 not found/i);
    });

    it('should throw error for unpaid payment', async () => {
      const { order } = await createTestData();
      
      const payment = await processPayment({
        order_id: order.id,
        payment_method: 'credit_card'
      });

      await expect(refundPayment(payment.id)).rejects.toThrow(/Cannot refund a payment that is not paid/i);
    });

    it('should throw error when refund amount exceeds payment amount', async () => {
      const { order } = await createTestData();
      
      const payment = await processPayment({
        order_id: order.id,
        payment_method: 'credit_card'
      });

      await db.update(paymentsTable)
        .set({ payment_status: 'paid', paid_at: new Date() })
        .where(eq(paymentsTable.id, payment.id))
        .execute();

      await expect(refundPayment(payment.id, 200.00)).rejects.toThrow(/Refund amount cannot exceed payment amount/i);
    });
  });
});