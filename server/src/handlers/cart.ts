import { db } from '../db';
import { cartItemsTable, productsTable, usersTable } from '../db/schema';
import { type AddToCartInput, type UpdateCartItemInput, type CartItem } from '../schema';
import { eq, and, sum, SQL } from 'drizzle-orm';

export async function addToCart(input: AddToCartInput): Promise<CartItem> {
  try {
    // Validate that user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Validate that product exists and is active
    const product = await db.select()
      .from(productsTable)
      .where(and(
        eq(productsTable.id, input.product_id),
        eq(productsTable.is_active, true)
      ))
      .execute();

    if (product.length === 0) {
      throw new Error('Product not found or not active');
    }

    // Check if product already exists in cart
    const existingCartItem = await db.select()
      .from(cartItemsTable)
      .where(and(
        eq(cartItemsTable.user_id, input.user_id),
        eq(cartItemsTable.product_id, input.product_id)
      ))
      .execute();

    if (existingCartItem.length > 0) {
      // Update existing cart item quantity
      const updatedItem = await db.update(cartItemsTable)
        .set({
          quantity: existingCartItem[0].quantity + input.quantity,
          updated_at: new Date()
        })
        .where(eq(cartItemsTable.id, existingCartItem[0].id))
        .returning()
        .execute();

      return updatedItem[0];
    } else {
      // Create new cart item
      const result = await db.insert(cartItemsTable)
        .values({
          user_id: input.user_id,
          product_id: input.product_id,
          quantity: input.quantity
        })
        .returning()
        .execute();

      return result[0];
    }
  } catch (error) {
    console.error('Add to cart failed:', error);
    throw error;
  }
}

export async function getCartByUserId(userId: number): Promise<CartItem[]> {
  try {
    // Validate that user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Get cart items for the user
    const cartItems = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.user_id, userId))
      .execute();

    return cartItems;
  } catch (error) {
    console.error('Get cart by user ID failed:', error);
    throw error;
  }
}

export async function updateCartItem(input: UpdateCartItemInput): Promise<CartItem> {
  try {
    // First check if cart item exists
    const existingItem = await db.select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.id, input.id))
      .execute();

    if (existingItem.length === 0) {
      throw new Error('Cart item not found');
    }

    // Update the cart item
    const result = await db.update(cartItemsTable)
      .set({
        quantity: input.quantity,
        updated_at: new Date()
      })
      .where(eq(cartItemsTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Update cart item failed:', error);
    throw error;
  }
}

export async function removeCartItem(cartItemId: number, userId: number): Promise<{ success: boolean }> {
  try {
    // Validate that cart item exists and belongs to the user
    const cartItem = await db.select()
      .from(cartItemsTable)
      .where(and(
        eq(cartItemsTable.id, cartItemId),
        eq(cartItemsTable.user_id, userId)
      ))
      .execute();

    if (cartItem.length === 0) {
      throw new Error('Cart item not found or does not belong to user');
    }

    // Delete the cart item
    await db.delete(cartItemsTable)
      .where(eq(cartItemsTable.id, cartItemId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Remove cart item failed:', error);
    throw error;
  }
}

export async function clearCart(userId: number): Promise<{ success: boolean }> {
  try {
    // Validate that user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Delete all cart items for the user
    await db.delete(cartItemsTable)
      .where(eq(cartItemsTable.user_id, userId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Clear cart failed:', error);
    throw error;
  }
}

export async function getCartTotal(userId: number): Promise<{ subtotal: number; totalItems: number }> {
  try {
    // Validate that user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Get cart items with product details for calculation
    const cartItemsWithProducts = await db.select({
      quantity: cartItemsTable.quantity,
      price: productsTable.price
    })
      .from(cartItemsTable)
      .innerJoin(productsTable, eq(cartItemsTable.product_id, productsTable.id))
      .where(eq(cartItemsTable.user_id, userId))
      .execute();

    if (cartItemsWithProducts.length === 0) {
      return { subtotal: 0, totalItems: 0 };
    }

    // Calculate subtotal and total items
    let subtotal = 0;
    let totalItems = 0;

    for (const item of cartItemsWithProducts) {
      const price = parseFloat(item.price); // Convert numeric to number
      subtotal += price * item.quantity;
      totalItems += item.quantity;
    }

    return { subtotal, totalItems };
  } catch (error) {
    console.error('Get cart total failed:', error);
    throw error;
  }
}