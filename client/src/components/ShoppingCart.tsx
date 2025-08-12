import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { trpc } from '@/utils/trpc';
import { useState, useEffect, useCallback } from 'react';
import type { User, CartItem, Product, CustomerAddress } from '../../../server/src/schema';

interface CartItemWithProduct extends CartItem {
  product: Product;
}

interface ShoppingCartProps {
  user: User;
  onCartUpdate: (count: number) => void;
}

export function ShoppingCart({ user, onCartUpdate }: ShoppingCartProps) {
  const [cartItems, setCartItems] = useState<CartItemWithProduct[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isCheckoutDialogOpen, setIsCheckoutDialogOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [shippingCost, setShippingCost] = useState<number>(0);

  const loadCartItems = useCallback(async () => {
    try {
      const items = await trpc.cart.getByUserId.query(user.id);
      
      // Fetch product details for each cart item
      const itemsWithProducts = await Promise.all(
        items.map(async (item) => {
          const product = await trpc.products.getById.query(item.product_id);
          if (!product) {
            throw new Error(`Product not found for ID: ${item.product_id}`);
          }
          return { ...item, product };
        })
      );
      
      setCartItems(itemsWithProducts);
      
      // Update cart count
      const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
      onCartUpdate(totalCount);
    } catch (error) {
      console.error('Failed to load cart items:', error);
      setError('Gagal memuat keranjang belanja');
    }
  }, [user.id, onCartUpdate]);

  const loadAddresses = useCallback(async () => {
    try {
      const result = await trpc.addresses.getByUserId.query(user.id);
      setAddresses(result);
      
      // Set default address if available
      const defaultAddress = result.find(addr => addr.is_default);
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
      }
    } catch (error) {
      console.error('Failed to load addresses:', error);
    }
  }, [user.id]);

  useEffect(() => {
    loadCartItems();
    loadAddresses();
  }, [loadCartItems, loadAddresses]);

  const handleUpdateQuantity = async (cartItemId: number, newQuantity: number) => {
    if (newQuantity < 1) return;

    setIsLoading(true);
    setError(null);

    try {
      await trpc.cart.updateItem.mutate({
        id: cartItemId,
        quantity: newQuantity
      });
      
      await loadCartItems();
    } catch (error: any) {
      setError(error.message || 'Gagal mengupdate quantity');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveItem = async (cartItemId: number) => {
    if (!confirm('Yakin ingin menghapus item dari keranjang?')) return;

    setIsLoading(true);
    setError(null);

    try {
      await trpc.cart.removeItem.mutate({
        cartItemId,
        userId: user.id
      });
      
      await loadCartItems();
      setSuccess('Item berhasil dihapus dari keranjang');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.message || 'Gagal menghapus item');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearCart = async () => {
    if (!confirm('Yakin ingin mengosongkan keranjang belanja?')) return;

    setIsLoading(true);
    setError(null);

    try {
      await trpc.cart.clear.mutate(user.id);
      await loadCartItems();
      setSuccess('Keranjang berhasil dikosongkan');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.message || 'Gagal mengosongkan keranjang');
    } finally {
      setIsLoading(false);
    }
  };

  const calculateSubtotal = () => {
    return cartItems.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  };

  const calculateTotalWeight = () => {
    return cartItems.reduce((sum, item) => sum + (item.product.weight * item.quantity), 0);
  };

  const handleCheckout = async () => {
    if (!selectedAddressId) {
      setError('Pilih alamat pengiriman terlebih dahulu');
      return;
    }

    if (cartItems.length === 0) {
      setError('Keranjang kosong');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const orderItems = cartItems.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity
      }));

      const order = await trpc.orders.create.mutate({
        user_id: user.id,
        shipping_address_id: selectedAddressId,
        items: orderItems
      });

      // Clear cart after successful order creation
      await trpc.cart.clear.mutate(user.id);
      await loadCartItems();
      
      setIsCheckoutDialogOpen(false);
      setSuccess(`Pesanan berhasil dibuat! Nomor pesanan: ${order.order_number}`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (error: any) {
      setError(error.message || 'Gagal membuat pesanan');
    } finally {
      setIsLoading(false);
    }
  };

  const getSelectedAddress = () => {
    return addresses.find(addr => addr.id === selectedAddressId);
  };

  if (cartItems.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">🛒 Keranjang Belanja</h2>
        </div>

        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        <div className="text-center py-12">
          <div className="text-6xl mb-4">🛒</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Keranjang Anda Kosong</h3>
          <p className="text-gray-500 mb-6">
            Mulai berbelanja dan tambahkan produk ke keranjang Anda
          </p>
          <Button onClick={() => window.location.reload()} variant="outline">
            🛍️ Lihat Produk
          </Button>
        </div>
      </div>
    );
  }

  const subtotal = calculateSubtotal();
  const totalWeight = calculateTotalWeight();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">🛒 Keranjang Belanja</h2>
        <Badge variant="outline" className="text-blue-600">
          {cartItems.length} item dalam keranjang
        </Badge>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {cartItems.map((item: CartItemWithProduct) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-center space-x-4">
                  {/* Product Image */}
                  <div className="w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {item.product.image_url ? (
                      <img
                        src={item.product.image_url}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                        onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                          e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiM5N2EzYjQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-2xl">📦</span>
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{item.product.name}</h3>
                    <p className="text-sm text-gray-600">Berat: {item.product.weight}g</p>
                    <p className="text-lg font-bold text-blue-600">
                      Rp {item.product.price.toLocaleString('id-ID')}
                    </p>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                      disabled={item.quantity <= 1 || isLoading}
                    >
                      -
                    </Button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                      disabled={item.quantity >= item.product.stock_quantity || isLoading}
                    >
                      +
                    </Button>
                  </div>

                  {/* Item Total & Remove */}
                  <div className="text-right">
                    <p className="font-bold">
                      Rp {(item.product.price * item.quantity).toLocaleString('id-ID')}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-red-600 hover:text-red-700 mt-1"
                      disabled={isLoading}
                    >
                      🗑️ Hapus
                    </Button>
                  </div>
                </div>

                {/* Stock Warning */}
                {item.quantity > item.product.stock_quantity && (
                  <Alert className="mt-3 border-yellow-200 bg-yellow-50">
                    <AlertDescription className="text-yellow-700">
                      ⚠️ Quantity melebihi stok yang tersedia ({item.product.stock_quantity})
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          ))}

          {/* Clear Cart Button */}
          <div className="flex justify-end">
            <Button 
              variant="outline" 
              onClick={handleClearCart}
              disabled={isLoading}
              className="text-red-600 hover:text-red-700"
            >
              🗑️ Kosongkan Keranjang
            </Button>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>Ringkasan Pesanan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal ({cartItems.length} item):</span>
                  <span>Rp {subtotal.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Berat:</span>
                  <span>{totalWeight.toLocaleString('id-ID')}g</span>
                </div>
                <div className="border-t pt-2">
                  <div className="flex justify-between font-bold">
                    <span>Total:</span>
                    <span className="text-lg text-blue-600">
                      Rp {(subtotal + shippingCost).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Checkout Button */}
              <Dialog open={isCheckoutDialogOpen} onOpenChange={setIsCheckoutDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full" size="lg">
                    🚚 Lanjut ke Checkout
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Checkout - Pilih Alamat Pengiriman</DialogTitle>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    {addresses.length > 0 ? (
                      <div>
                        <Label>Alamat Pengiriman:</Label>
                        <Select 
                          value={selectedAddressId?.toString() || ''} 
                          onValueChange={(value) => setSelectedAddressId(parseInt(value))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih alamat pengiriman" />
                          </SelectTrigger>
                          <SelectContent>
                            {addresses.map((address: CustomerAddress) => (
                              <SelectItem key={address.id} value={address.id.toString()}>
                                <div className="text-left">
                                  <div className="font-semibold">{address.name}</div>
                                  <div className="text-sm text-gray-600">
                                    {address.address_line1}, {address.city}, {address.province}
                                  </div>
                                  {address.is_default && (
                                    <Badge className="text-xs mt-1">Default</Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <Alert className="border-yellow-200 bg-yellow-50">
                        <AlertDescription className="text-yellow-700">
                          ⚠️ Anda belum memiliki alamat pengiriman. Silakan tambahkan di halaman profil terlebih dahulu.
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Order Summary in Dialog */}
                    {selectedAddressId && (
                      <div className="border rounded-lg p-4 bg-gray-50">
                        <h4 className="font-semibold mb-2">Ringkasan Pesanan:</h4>
                        <div className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span>Rp {subtotal.toLocaleString('id-ID')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Biaya Pengiriman:</span>
                            <span>Akan dihitung otomatis</span>
                          </div>
                          <div className="border-t pt-1 flex justify-between font-semibold">
                            <span>Estimasi Total:</span>
                            <span className="text-blue-600">
                              Rp {subtotal.toLocaleString('id-ID')}+
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <DialogFooter>
                    <Button
                      onClick={handleCheckout}
                      disabled={isLoading || !selectedAddressId || addresses.length === 0}
                      className="w-full"
                    >
                      {isLoading ? 'Membuat Pesanan...' : '✅ Buat Pesanan'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}