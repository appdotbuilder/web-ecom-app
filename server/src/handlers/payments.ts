import { db } from '../db';
import { paymentsTable, ordersTable } from '../db/schema';
import { type ProcessPaymentInput, type Payment } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function processPayment(input: ProcessPaymentInput): Promise<Payment> {
  try {
    // First, get the order to validate it exists and get the total amount
    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, input.order_id))
      .execute();

    if (orders.length === 0) {
      throw new Error(`Order with ID ${input.order_id} not found`);
    }

    const order = orders[0];
    
    // Check if payment already exists for this order
    const existingPayments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.order_id, input.order_id))
      .execute();

    if (existingPayments.length > 0) {
      throw new Error(`Payment already exists for order ${input.order_id}`);
    }

    // Generate a mock Midtrans transaction ID for this implementation
    const transactionId = `MT-${Date.now()}-${input.order_id}`;
    
    // Create payment record
    const result = await db.insert(paymentsTable)
      .values({
        order_id: input.order_id,
        payment_method: input.payment_method,
        payment_status: 'pending',
        amount: order.total_amount, // total_amount is already a string from the database
        midtrans_transaction_id: transactionId,
        midtrans_payment_type: input.payment_method
      })
      .returning()
      .execute();

    const payment = result[0];
    
    // Convert numeric fields back to numbers before returning
    return {
      ...payment,
      amount: parseFloat(payment.amount)
    };
  } catch (error) {
    console.error('Payment processing failed:', error);
    throw error;
  }
}

export async function handlePaymentNotification(notification: any): Promise<{ success: boolean }> {
  try {
    const { transaction_id, transaction_status, payment_type } = notification;
    
    if (!transaction_id) {
      throw new Error('Missing transaction_id in notification');
    }

    // Find payment by transaction ID
    const payments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.midtrans_transaction_id, transaction_id))
      .execute();

    if (payments.length === 0) {
      throw new Error(`Payment not found for transaction ID: ${transaction_id}`);
    }

    const payment = payments[0];
    
    // Map Midtrans status to our payment status
    let paymentStatus: 'pending' | 'paid' | 'failed' | 'cancelled';
    let paidAt: Date | null = null;
    
    switch (transaction_status) {
      case 'capture':
      case 'settlement':
        paymentStatus = 'paid';
        paidAt = new Date();
        break;
      case 'pending':
        paymentStatus = 'pending';
        break;
      case 'cancel':
      case 'expire':
        paymentStatus = 'cancelled';
        break;
      case 'deny':
      case 'failure':
        paymentStatus = 'failed';
        break;
      default:
        paymentStatus = 'pending';
    }

    // Update payment status
    await db.update(paymentsTable)
      .set({
        payment_status: paymentStatus,
        midtrans_payment_type: payment_type || payment.midtrans_payment_type,
        paid_at: paidAt,
        updated_at: new Date()
      })
      .where(eq(paymentsTable.id, payment.id))
      .execute();

    // If payment is successful, update order status to 'paid'
    if (paymentStatus === 'paid') {
      await db.update(ordersTable)
        .set({
          status: 'paid',
          updated_at: new Date()
        })
        .where(eq(ordersTable.id, payment.order_id))
        .execute();
    }

    return { success: true };
  } catch (error) {
    console.error('Payment notification handling failed:', error);
    throw error;
  }
}

export async function getPaymentByOrderId(orderId: number): Promise<Payment | null> {
  try {
    const payments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.order_id, orderId))
      .execute();

    if (payments.length === 0) {
      return null;
    }

    const payment = payments[0];
    
    // Convert numeric fields back to numbers before returning
    return {
      ...payment,
      amount: parseFloat(payment.amount)
    };
  } catch (error) {
    console.error('Get payment by order ID failed:', error);
    throw error;
  }
}

export async function checkPaymentStatus(paymentId: number): Promise<Payment> {
  try {
    const payments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, paymentId))
      .execute();

    if (payments.length === 0) {
      throw new Error(`Payment with ID ${paymentId} not found`);
    }

    const payment = payments[0];
    
    // In a real implementation, this would also query Midtrans API
    // to get the latest status and update our records if needed
    
    // Convert numeric fields back to numbers before returning
    return {
      ...payment,
      amount: parseFloat(payment.amount)
    };
  } catch (error) {
    console.error('Check payment status failed:', error);
    throw error;
  }
}

export async function refundPayment(paymentId: number, amount?: number): Promise<{ success: boolean; refund_id: string }> {
  try {
    const payments = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, paymentId))
      .execute();

    if (payments.length === 0) {
      throw new Error(`Payment with ID ${paymentId} not found`);
    }

    const payment = payments[0];
    
    if (payment.payment_status !== 'paid') {
      throw new Error('Cannot refund a payment that is not paid');
    }

    const paymentAmount = parseFloat(payment.amount);
    const refundAmount = amount || paymentAmount;
    
    if (refundAmount > paymentAmount) {
      throw new Error('Refund amount cannot exceed payment amount');
    }

    // In a real implementation, this would call Midtrans refund API
    const refundId = `REF-${Date.now()}-${paymentId}`;
    
    // For full refunds, update payment status to cancelled
    if (refundAmount === paymentAmount) {
      await db.update(paymentsTable)
        .set({
          payment_status: 'cancelled',
          updated_at: new Date()
        })
        .where(eq(paymentsTable.id, paymentId))
        .execute();
    }
    
    return {
      success: true,
      refund_id: refundId
    };
  } catch (error) {
    console.error('Payment refund failed:', error);
    throw error;
  }
}