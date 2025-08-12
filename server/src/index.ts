import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  loginInputSchema,
  createUserInputSchema,
  updateUserInputSchema,
  createCategoryInputSchema,
  updateCategoryInputSchema,
  createProductInputSchema,
  updateProductInputSchema,
  getProductsInputSchema,
  createCustomerAddressInputSchema,
  addToCartInputSchema,
  updateCartItemInputSchema,
  createOrderInputSchema,
  updateOrderStatusInputSchema,
  getOrdersInputSchema,
  processPaymentInputSchema,
  calculateShippingInputSchema
} from './schema';

// Import handlers
import { login, register, verifyToken } from './handlers/auth';
import { getUsers, getUserById, updateUser, deleteUser } from './handlers/users';
import { createCategory, getCategories, getCategoryById, updateCategory, deleteCategory } from './handlers/categories';
import { createProduct, getProducts, getProductById, updateProduct, deleteProduct, updateProductStock } from './handlers/products';
import { createAddress, getAddressesByUserId, getAddressById, updateAddress, deleteAddress, setDefaultAddress } from './handlers/addresses';
import { addToCart, getCartByUserId, updateCartItem, removeCartItem, clearCart, getCartTotal } from './handlers/cart';
import { createOrder, getOrders, getOrderById, getOrdersByUserId, updateOrderStatus, cancelOrder, getOrderItems } from './handlers/orders';
import { processPayment, handlePaymentNotification, getPaymentByOrderId, checkPaymentStatus, refundPayment } from './handlers/payments';
import { calculateShippingCost, getCities, getProvinces, trackShipment, getCouriers } from './handlers/shipping';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  auth: router({
    login: publicProcedure
      .input(loginInputSchema)
      .mutation(({ input }) => login(input)),
    register: publicProcedure
      .input(createUserInputSchema)
      .mutation(({ input }) => register(input)),
    verifyToken: publicProcedure
      .input(z.string())
      .query(({ input }) => verifyToken(input))
  }),

  // User management routes (Admin)
  users: router({
    getAll: publicProcedure
      .query(() => getUsers()),
    getById: publicProcedure
      .input(z.number())
      .query(({ input }) => getUserById(input)),
    update: publicProcedure
      .input(updateUserInputSchema)
      .mutation(({ input }) => updateUser(input)),
    delete: publicProcedure
      .input(z.number())
      .mutation(({ input }) => deleteUser(input))
  }),

  // Category management routes
  categories: router({
    create: publicProcedure
      .input(createCategoryInputSchema)
      .mutation(({ input }) => createCategory(input)),
    getAll: publicProcedure
      .query(() => getCategories()),
    getById: publicProcedure
      .input(z.number())
      .query(({ input }) => getCategoryById(input)),
    update: publicProcedure
      .input(updateCategoryInputSchema)
      .mutation(({ input }) => updateCategory(input)),
    delete: publicProcedure
      .input(z.number())
      .mutation(({ input }) => deleteCategory(input))
  }),

  // Product management routes
  products: router({
    create: publicProcedure
      .input(createProductInputSchema)
      .mutation(({ input }) => createProduct(input)),
    getAll: publicProcedure
      .input(getProductsInputSchema.optional())
      .query(({ input }) => getProducts(input)),
    getById: publicProcedure
      .input(z.number())
      .query(({ input }) => getProductById(input)),
    update: publicProcedure
      .input(updateProductInputSchema)
      .mutation(({ input }) => updateProduct(input)),
    delete: publicProcedure
      .input(z.number())
      .mutation(({ input }) => deleteProduct(input)),
    updateStock: publicProcedure
      .input(z.object({ productId: z.number(), quantity: z.number() }))
      .mutation(({ input }) => updateProductStock(input.productId, input.quantity))
  }),

  // Customer address routes
  addresses: router({
    create: publicProcedure
      .input(createCustomerAddressInputSchema)
      .mutation(({ input }) => createAddress(input)),
    getByUserId: publicProcedure
      .input(z.number())
      .query(({ input }) => getAddressesByUserId(input)),
    getById: publicProcedure
      .input(z.number())
      .query(({ input }) => getAddressById(input)),
    update: publicProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        phone: z.string().optional(),
        address_line1: z.string().optional(),
        address_line2: z.string().nullable().optional(),
        city: z.string().optional(),
        province: z.string().optional(),
        postal_code: z.string().optional(),
        is_default: z.boolean().optional()
      }))
      .mutation(({ input }) => updateAddress(input)),
    delete: publicProcedure
      .input(z.number())
      .mutation(({ input }) => deleteAddress(input)),
    setDefault: publicProcedure
      .input(z.object({ addressId: z.number(), userId: z.number() }))
      .mutation(({ input }) => setDefaultAddress(input.addressId, input.userId))
  }),

  // Shopping cart routes
  cart: router({
    add: publicProcedure
      .input(addToCartInputSchema)
      .mutation(({ input }) => addToCart(input)),
    getByUserId: publicProcedure
      .input(z.number())
      .query(({ input }) => getCartByUserId(input)),
    updateItem: publicProcedure
      .input(updateCartItemInputSchema)
      .mutation(({ input }) => updateCartItem(input)),
    removeItem: publicProcedure
      .input(z.object({ cartItemId: z.number(), userId: z.number() }))
      .mutation(({ input }) => removeCartItem(input.cartItemId, input.userId)),
    clear: publicProcedure
      .input(z.number())
      .mutation(({ input }) => clearCart(input)),
    getTotal: publicProcedure
      .input(z.number())
      .query(({ input }) => getCartTotal(input))
  }),

  // Order management routes
  orders: router({
    create: publicProcedure
      .input(createOrderInputSchema)
      .mutation(({ input }) => createOrder(input)),
    getAll: publicProcedure
      .input(getOrdersInputSchema.optional())
      .query(({ input }) => getOrders(input)),
    getById: publicProcedure
      .input(z.number())
      .query(({ input }) => getOrderById(input)),
    getByUserId: publicProcedure
      .input(z.object({
        userId: z.number(),
        page: z.number().optional(),
        limit: z.number().optional()
      }))
      .query(({ input }) => getOrdersByUserId(input.userId, input.page, input.limit)),
    updateStatus: publicProcedure
      .input(updateOrderStatusInputSchema)
      .mutation(({ input }) => updateOrderStatus(input)),
    cancel: publicProcedure
      .input(z.object({ orderId: z.number(), userId: z.number() }))
      .mutation(({ input }) => cancelOrder(input.orderId, input.userId)),
    getItems: publicProcedure
      .input(z.number())
      .query(({ input }) => getOrderItems(input))
  }),

  // Payment routes
  payments: router({
    process: publicProcedure
      .input(processPaymentInputSchema)
      .mutation(({ input }) => processPayment(input)),
    handleNotification: publicProcedure
      .input(z.any())
      .mutation(({ input }) => handlePaymentNotification(input)),
    getByOrderId: publicProcedure
      .input(z.number())
      .query(({ input }) => getPaymentByOrderId(input)),
    checkStatus: publicProcedure
      .input(z.number())
      .query(({ input }) => checkPaymentStatus(input)),
    refund: publicProcedure
      .input(z.object({ paymentId: z.number(), amount: z.number().optional() }))
      .mutation(({ input }) => refundPayment(input.paymentId, input.amount))
  }),

  // Shipping routes
  shipping: router({
    calculateCost: publicProcedure
      .input(calculateShippingInputSchema)
      .mutation(({ input }) => calculateShippingCost(input)),
    getCities: publicProcedure
      .query(() => getCities()),
    getProvinces: publicProcedure
      .query(() => getProvinces()),
    trackShipment: publicProcedure
      .input(z.object({ trackingNumber: z.string(), courier: z.string() }))
      .query(({ input }) => trackShipment(input.trackingNumber, input.courier)),
    getCouriers: publicProcedure
      .query(() => getCouriers())
  })
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC E-commerce server listening at port: ${port}`);
}

start();