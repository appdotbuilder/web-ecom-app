import { db } from '../db';
import { 
  ordersTable, 
  orderItemsTable, 
  productsTable, 
  customerAddressesTable,
  usersTable 
} from '../db/schema';
import { 
  type CreateOrderInput, 
  type UpdateOrderStatusInput, 
  type GetOrdersInput, 
  type Order, 
  type OrderItem 
} from '../schema';
import { eq, and, desc, count, SQL } from 'drizzle-orm';

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  try {
    // Validate shipping address exists and belongs to user
    const shippingAddress = await db.select()
      .from(customerAddressesTable)
      .where(
        and(
          eq(customerAddressesTable.id, input.shipping_address_id),
          eq(customerAddressesTable.user_id, input.user_id)
        )
      )
      .execute();

    if (shippingAddress.length === 0) {
      throw new Error('Shipping address not found or does not belong to user');
    }

    // Validate products exist and have sufficient stock
    const products = await db.select()
      .from(productsTable)
      .where(eq(productsTable.is_active, true))
      .execute();

    const productMap = new Map(products.map(p => [p.id, p]));

    let totalAmount = 0;
    let totalWeight = 0;

    // Validate all items and calculate totals
    for (const item of input.items) {
      const product = productMap.get(item.product_id);
      if (!product) {
        throw new Error(`Product with id ${item.product_id} not found or inactive`);
      }
      if (product.stock_quantity < item.quantity) {
        throw new Error(`Insufficient stock for product ${product.name}. Available: ${product.stock_quantity}, requested: ${item.quantity}`);
      }
      
      const itemTotal = parseFloat(product.price) * item.quantity;
      totalAmount += itemTotal;
      totalWeight += parseFloat(product.weight) * item.quantity;
    }

    // Calculate shipping cost (simplified calculation based on weight)
    // In a real application, this would integrate with shipping APIs
    const shippingCost = Math.max(10, Math.ceil(totalWeight / 1000) * 5); // $10 minimum, $5 per kg

    const finalTotal = totalAmount + shippingCost;

    // Generate unique order number
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create order
    const [order] = await db.insert(ordersTable)
      .values({
        user_id: input.user_id,
        order_number: orderNumber,
        status: 'pending',
        total_amount: finalTotal.toString(),
        shipping_cost: shippingCost.toString(),
        shipping_address: JSON.stringify({
          name: shippingAddress[0].name,
          phone: shippingAddress[0].phone,
          address_line1: shippingAddress[0].address_line1,
          address_line2: shippingAddress[0].address_line2,
          city: shippingAddress[0].city,
          province: shippingAddress[0].province,
          postal_code: shippingAddress[0].postal_code
        })
      })
      .returning()
      .execute();

    // Create order items and update stock
    for (const item of input.items) {
      const product = productMap.get(item.product_id)!;
      const unitPrice = parseFloat(product.price);
      const totalPrice = unitPrice * item.quantity;

      // Create order item
      await db.insert(orderItemsTable)
        .values({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: unitPrice.toString(),
          total_price: totalPrice.toString()
        })
        .execute();

      // Update product stock
      await db.update(productsTable)
        .set({
          stock_quantity: product.stock_quantity - item.quantity,
          updated_at: new Date()
        })
        .where(eq(productsTable.id, item.product_id))
        .execute();
    }

    return {
      ...order,
      total_amount: parseFloat(order.total_amount),
      shipping_cost: parseFloat(order.shipping_cost)
    };
  } catch (error) {
    console.error('Order creation failed:', error);
    throw error;
  }
}

export async function getOrders(input?: GetOrdersInput): Promise<{ orders: Order[]; total: number; page: number; limit: number }> {
  try {
    const page = input?.page || 1;
    const limit = input?.limit || 10;
    const offset = (page - 1) * limit;

    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    if (input?.user_id !== undefined) {
      conditions.push(eq(ordersTable.user_id, input.user_id));
    }

    if (input?.status) {
      conditions.push(eq(ordersTable.status, input.status));
    }

    // Build queries with conditions applied from the start
    const baseQuery = db.select().from(ordersTable);
    const baseCountQuery = db.select({ count: count() }).from(ordersTable);

    const query = conditions.length > 0
      ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : baseQuery;

    const countQuery = conditions.length > 0
      ? baseCountQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : baseCountQuery;

    // Apply ordering and pagination to final query
    const ordersQuery = query.orderBy(desc(ordersTable.created_at))
      .limit(limit)
      .offset(offset);

    const [orders, totalResult] = await Promise.all([
      ordersQuery.execute(),
      countQuery.execute()
    ]);

    return {
      orders: orders.map(order => ({
        ...order,
        total_amount: parseFloat(order.total_amount),
        shipping_cost: parseFloat(order.shipping_cost)
      })),
      total: totalResult[0].count,
      page,
      limit
    };
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    throw error;
  }
}

export async function getOrderById(id: number): Promise<Order | null> {
  try {
    const orders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, id))
      .execute();

    if (orders.length === 0) {
      return null;
    }

    const order = orders[0];
    return {
      ...order,
      total_amount: parseFloat(order.total_amount),
      shipping_cost: parseFloat(order.shipping_cost)
    };
  } catch (error) {
    console.error('Failed to fetch order by ID:', error);
    throw error;
  }
}

export async function getOrdersByUserId(userId: number, page = 1, limit = 10): Promise<{ orders: Order[]; total: number; page: number; limit: number }> {
  try {
    return await getOrders({ user_id: userId, page, limit });
  } catch (error) {
    console.error('Failed to fetch orders by user ID:', error);
    throw error;
  }
}

export async function updateOrderStatus(input: UpdateOrderStatusInput): Promise<Order> {
  try {
    // Check if order exists
    const existingOrders = await db.select()
      .from(ordersTable)
      .where(eq(ordersTable.id, input.id))
      .execute();

    if (existingOrders.length === 0) {
      throw new Error(`Order with id ${input.id} not found`);
    }

    // Update order
    const updateData: any = {
      status: input.status,
      updated_at: new Date()
    };

    if (input.shipping_tracking_number !== undefined) {
      updateData.shipping_tracking_number = input.shipping_tracking_number;
    }

    const [updatedOrder] = await db.update(ordersTable)
      .set(updateData)
      .where(eq(ordersTable.id, input.id))
      .returning()
      .execute();

    return {
      ...updatedOrder,
      total_amount: parseFloat(updatedOrder.total_amount),
      shipping_cost: parseFloat(updatedOrder.shipping_cost)
    };
  } catch (error) {
    console.error('Failed to update order status:', error);
    throw error;
  }
}

export async function cancelOrder(orderId: number, userId: number): Promise<Order> {
  try {
    // Check if order exists and belongs to user
    const existingOrders = await db.select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.id, orderId),
          eq(ordersTable.user_id, userId)
        )
      )
      .execute();

    if (existingOrders.length === 0) {
      throw new Error(`Order with id ${orderId} not found or does not belong to user`);
    }

    const order = existingOrders[0];

    // Only allow cancellation of pending orders
    if (order.status !== 'pending') {
      throw new Error(`Cannot cancel order with status '${order.status}'. Only pending orders can be cancelled.`);
    }

    // Get order items to restore stock
    const orderItems = await db.select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.order_id, orderId))
      .execute();

    // Restore product stock
    for (const item of orderItems) {
      // Get current stock
      const [currentProduct] = await db.select()
        .from(productsTable)
        .where(eq(productsTable.id, item.product_id))
        .execute();

      // Update with restored stock
      await db.update(productsTable)
        .set({
          stock_quantity: currentProduct.stock_quantity + item.quantity,
          updated_at: new Date()
        })
        .where(eq(productsTable.id, item.product_id))
        .execute();
    }

    // Update order status to cancelled
    const [updatedOrder] = await db.update(ordersTable)
      .set({
        status: 'cancelled',
        updated_at: new Date()
      })
      .where(eq(ordersTable.id, orderId))
      .returning()
      .execute();

    return {
      ...updatedOrder,
      total_amount: parseFloat(updatedOrder.total_amount),
      shipping_cost: parseFloat(updatedOrder.shipping_cost)
    };
  } catch (error) {
    console.error('Failed to cancel order:', error);
    throw error;
  }
}

export async function getOrderItems(orderId: number): Promise<OrderItem[]> {
  try {
    const orderItems = await db.select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.order_id, orderId))
      .execute();

    return orderItems.map(item => ({
      ...item,
      unit_price: parseFloat(item.unit_price),
      total_price: parseFloat(item.total_price)
    }));
  } catch (error) {
    console.error('Failed to fetch order items:', error);
    throw error;
  }
}