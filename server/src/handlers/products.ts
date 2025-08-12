import { db } from '../db';
import { productsTable, categoriesTable, orderItemsTable } from '../db/schema';
import { type CreateProductInput, type UpdateProductInput, type GetProductsInput, type Product } from '../schema';
import { eq, and, or, ilike, count, gte, SQL } from 'drizzle-orm';

export async function createProduct(input: CreateProductInput): Promise<Product> {
  try {
    // Validate that category exists before creating product
    const categoryExists = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, input.category_id))
      .execute();

    if (categoryExists.length === 0) {
      throw new Error(`Category with id ${input.category_id} does not exist`);
    }

    // Insert product record
    const result = await db.insert(productsTable)
      .values({
        name: input.name,
        description: input.description,
        price: input.price.toString(), // Convert number to string for numeric column
        stock_quantity: input.stock_quantity,
        category_id: input.category_id,
        image_url: input.image_url,
        weight: input.weight.toString(), // Convert number to string for numeric column
        is_active: input.is_active
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers before returning
    const product = result[0];
    return {
      ...product,
      price: parseFloat(product.price),
      weight: parseFloat(product.weight)
    };
  } catch (error) {
    console.error('Product creation failed:', error);
    throw error;
  }
}

export async function getProducts(input?: GetProductsInput): Promise<{ products: Product[]; total: number; page: number; limit: number }> {
  try {
    // Set defaults for pagination
    const page = input?.page || 1;
    const limit = input?.limit || 10;
    const offset = (page - 1) * limit;

    // Build query conditions
    const conditions: SQL<unknown>[] = [];

    if (input?.category_id !== undefined) {
      conditions.push(eq(productsTable.category_id, input.category_id));
    }

    if (input?.search) {
      conditions.push(
        or(
          ilike(productsTable.name, `%${input.search}%`),
          ilike(productsTable.description, `%${input.search}%`)
        )!
      );
    }

    if (input?.is_active !== undefined) {
      conditions.push(eq(productsTable.is_active, input.is_active));
    }

    // Execute paginated query
    const baseQuery = db.select().from(productsTable);
    const results = conditions.length > 0
      ? await baseQuery
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .limit(limit)
          .offset(offset)
          .execute()
      : await baseQuery
          .limit(limit)
          .offset(offset)
          .execute();

    // Get total count for pagination
    const baseCountQuery = db.select({ count: count() }).from(productsTable);
    const countQuery = conditions.length > 0
      ? baseCountQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : baseCountQuery;
    
    const totalResult = await countQuery.execute();
    const total = totalResult[0].count;

    // Convert numeric fields back to numbers
    const products = results.map(product => ({
      ...product,
      price: parseFloat(product.price),
      weight: parseFloat(product.weight)
    }));

    return {
      products,
      total,
      page,
      limit
    };
  } catch (error) {
    console.error('Failed to fetch products:', error);
    throw error;
  }
}

export async function getProductById(id: number): Promise<Product | null> {
  try {
    const results = await db.select()
      .from(productsTable)
      .where(eq(productsTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    // Convert numeric fields back to numbers
    const product = results[0];
    return {
      ...product,
      price: parseFloat(product.price),
      weight: parseFloat(product.weight)
    };
  } catch (error) {
    console.error('Failed to fetch product:', error);
    throw error;
  }
}

export async function updateProduct(input: UpdateProductInput): Promise<Product> {
  try {
    // Check if product exists
    const existingProduct = await getProductById(input.id);
    if (!existingProduct) {
      throw new Error(`Product with id ${input.id} not found`);
    }

    // Validate category exists if category_id is being updated
    if (input.category_id !== undefined) {
      const categoryExists = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, input.category_id))
        .execute();

      if (categoryExists.length === 0) {
        throw new Error(`Category with id ${input.category_id} does not exist`);
      }
    }

    // Build update values, converting numbers to strings for numeric columns
    const updateValues: any = {
      updated_at: new Date()
    };

    if (input.name !== undefined) updateValues.name = input.name;
    if (input.description !== undefined) updateValues.description = input.description;
    if (input.price !== undefined) updateValues.price = input.price.toString();
    if (input.stock_quantity !== undefined) updateValues.stock_quantity = input.stock_quantity;
    if (input.category_id !== undefined) updateValues.category_id = input.category_id;
    if (input.image_url !== undefined) updateValues.image_url = input.image_url;
    if (input.weight !== undefined) updateValues.weight = input.weight.toString();
    if (input.is_active !== undefined) updateValues.is_active = input.is_active;

    // Update product
    const result = await db.update(productsTable)
      .set(updateValues)
      .where(eq(productsTable.id, input.id))
      .returning()
      .execute();

    // Convert numeric fields back to numbers
    const product = result[0];
    return {
      ...product,
      price: parseFloat(product.price),
      weight: parseFloat(product.weight)
    };
  } catch (error) {
    console.error('Product update failed:', error);
    throw error;
  }
}

export async function deleteProduct(id: number): Promise<{ success: boolean }> {
  try {
    // Check if product exists
    const existingProduct = await getProductById(id);
    if (!existingProduct) {
      throw new Error(`Product with id ${id} not found`);
    }

    // Check if product is in any order items (prevent deletion if referenced)
    const orderItemsWithProduct = await db.select()
      .from(orderItemsTable)
      .where(eq(orderItemsTable.product_id, id))
      .execute();

    if (orderItemsWithProduct.length > 0) {
      throw new Error(`Cannot delete product with id ${id} because it is referenced in existing orders`);
    }

    // Delete the product
    await db.delete(productsTable)
      .where(eq(productsTable.id, id))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Product deletion failed:', error);
    throw error;
  }
}

export async function updateProductStock(productId: number, quantity: number): Promise<Product> {
  try {
    // Check if product exists
    const existingProduct = await getProductById(productId);
    if (!existingProduct) {
      throw new Error(`Product with id ${productId} not found`);
    }

    // Validate stock quantity is not negative
    if (quantity < 0) {
      throw new Error('Stock quantity cannot be negative');
    }

    // Update stock quantity
    const result = await db.update(productsTable)
      .set({
        stock_quantity: quantity,
        updated_at: new Date()
      })
      .where(eq(productsTable.id, productId))
      .returning()
      .execute();

    // Convert numeric fields back to numbers
    const product = result[0];
    return {
      ...product,
      price: parseFloat(product.price),
      weight: parseFloat(product.weight)
    };
  } catch (error) {
    console.error('Stock update failed:', error);
    throw error;
  }
}