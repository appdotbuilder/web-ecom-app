import { z } from 'zod';

// User role enum
export const userRoleSchema = z.enum(['admin', 'customer']);
export type UserRole = z.infer<typeof userRoleSchema>;

// Order status enum
export const orderStatusSchema = z.enum(['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled']);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

// Payment status enum
export const paymentStatusSchema = z.enum(['pending', 'paid', 'failed', 'cancelled']);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  full_name: z.string(),
  phone: z.string().nullable(),
  role: userRoleSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Category schema
export const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Category = z.infer<typeof categorySchema>;

// Product schema
export const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  price: z.number(),
  stock_quantity: z.number().int(),
  category_id: z.number(),
  image_url: z.string().nullable(),
  weight: z.number(), // Weight in grams for shipping calculation
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Product = z.infer<typeof productSchema>;

// Customer address schema
export const customerAddressSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  name: z.string(),
  phone: z.string(),
  address_line1: z.string(),
  address_line2: z.string().nullable(),
  city: z.string(),
  province: z.string(),
  postal_code: z.string(),
  is_default: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type CustomerAddress = z.infer<typeof customerAddressSchema>;

// Cart item schema
export const cartItemSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  product_id: z.number(),
  quantity: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type CartItem = z.infer<typeof cartItemSchema>;

// Order schema
export const orderSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  order_number: z.string(),
  status: orderStatusSchema,
  total_amount: z.number(),
  shipping_cost: z.number(),
  shipping_address: z.string(), // JSON string of address
  shipping_tracking_number: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Order = z.infer<typeof orderSchema>;

// Order item schema
export const orderItemSchema = z.object({
  id: z.number(),
  order_id: z.number(),
  product_id: z.number(),
  quantity: z.number().int(),
  unit_price: z.number(),
  total_price: z.number(),
  created_at: z.coerce.date()
});

export type OrderItem = z.infer<typeof orderItemSchema>;

// Payment schema
export const paymentSchema = z.object({
  id: z.number(),
  order_id: z.number(),
  payment_method: z.string(),
  payment_status: paymentStatusSchema,
  amount: z.number(),
  midtrans_transaction_id: z.string().nullable(),
  midtrans_payment_type: z.string().nullable(),
  paid_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Payment = z.infer<typeof paymentSchema>;

// Input schemas for creating entities
export const createUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string(),
  phone: z.string().nullable(),
  role: userRoleSchema
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const createCategoryInputSchema = z.object({
  name: z.string(),
  description: z.string().nullable()
});

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;

export const createProductInputSchema = z.object({
  name: z.string(),
  description: z.string().nullable(),
  price: z.number().positive(),
  stock_quantity: z.number().int().nonnegative(),
  category_id: z.number(),
  image_url: z.string().nullable(),
  weight: z.number().positive(),
  is_active: z.boolean()
});

export type CreateProductInput = z.infer<typeof createProductInputSchema>;

export const createCustomerAddressInputSchema = z.object({
  user_id: z.number(),
  name: z.string(),
  phone: z.string(),
  address_line1: z.string(),
  address_line2: z.string().nullable(),
  city: z.string(),
  province: z.string(),
  postal_code: z.string(),
  is_default: z.boolean()
});

export type CreateCustomerAddressInput = z.infer<typeof createCustomerAddressInputSchema>;

export const addToCartInputSchema = z.object({
  user_id: z.number(),
  product_id: z.number(),
  quantity: z.number().int().positive()
});

export type AddToCartInput = z.infer<typeof addToCartInputSchema>;

export const createOrderInputSchema = z.object({
  user_id: z.number(),
  shipping_address_id: z.number(),
  items: z.array(z.object({
    product_id: z.number(),
    quantity: z.number().int().positive()
  }))
});

export type CreateOrderInput = z.infer<typeof createOrderInputSchema>;

// Input schemas for updating entities
export const updateUserInputSchema = z.object({
  id: z.number(),
  email: z.string().email().optional(),
  full_name: z.string().optional(),
  phone: z.string().nullable().optional(),
  role: userRoleSchema.optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

export const updateCategoryInputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  description: z.string().nullable().optional()
});

export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;

export const updateProductInputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  price: z.number().positive().optional(),
  stock_quantity: z.number().int().nonnegative().optional(),
  category_id: z.number().optional(),
  image_url: z.string().nullable().optional(),
  weight: z.number().positive().optional(),
  is_active: z.boolean().optional()
});

export type UpdateProductInput = z.infer<typeof updateProductInputSchema>;

export const updateOrderStatusInputSchema = z.object({
  id: z.number(),
  status: orderStatusSchema,
  shipping_tracking_number: z.string().nullable().optional()
});

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusInputSchema>;

export const updateCartItemInputSchema = z.object({
  id: z.number(),
  quantity: z.number().int().positive()
});

export type UpdateCartItemInput = z.infer<typeof updateCartItemInputSchema>;

// Payment processing schemas
export const processPaymentInputSchema = z.object({
  order_id: z.number(),
  payment_method: z.string()
});

export type ProcessPaymentInput = z.infer<typeof processPaymentInputSchema>;

// Shipping calculation schemas
export const calculateShippingInputSchema = z.object({
  origin_city_id: z.number(),
  destination_city_id: z.number(),
  weight: z.number().positive(),
  courier: z.string()
});

export type CalculateShippingInput = z.infer<typeof calculateShippingInputSchema>;

// Auth schemas
export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const authResponseSchema = z.object({
  user: userSchema,
  token: z.string()
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

// List/filter schemas
export const getProductsInputSchema = z.object({
  category_id: z.number().optional(),
  search: z.string().optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
  is_active: z.boolean().optional()
});

export type GetProductsInput = z.infer<typeof getProductsInputSchema>;

export const getOrdersInputSchema = z.object({
  user_id: z.number().optional(),
  status: orderStatusSchema.optional(),
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional()
});

export type GetOrdersInput = z.infer<typeof getOrdersInputSchema>;