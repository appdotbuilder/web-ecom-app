import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { trpc } from '@/utils/trpc';
import { useState, useEffect, useCallback } from 'react';
import type { User, Order, OrderItem, Product, Payment } from '../../../server/src/schema';

interface OrderItemWithProduct extends OrderItem {
  product: Product;
}

interface CustomerOrdersProps {
  user: User;
}

export function CustomerOrders({ user }: CustomerOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItemWithProduct[]>([]);
  const [orderPayment, setOrderPayment] = useState<Payment | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isOrderDetailOpen, setIsOrderDetailOpen] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const result = await trpc.orders.getByUserId.query({
        userId: user.id,
        page: 1,
        limit: 50
      });
      setOrders(result.orders);
    } catch (error) {
      console.error('Failed to load orders:', error);
      setError('Gagal memuat riwayat pesanan');
    }
  }, [user.id]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const loadOrderDetails = async (order: Order) => {
    setIsLoading(true);
    try {
      // Load order items
      const items = await trpc.orders.getItems.query(order.id);
      const itemsWithProducts = await Promise.all(
        items.map(async (item) => {
          const product = await trpc.products.getById.query(item.product_id);
          if (!product) {
            throw new Error(`Product not found for ID: ${item.product_id}`);
          }
          return { ...item, product };
        })
      );
      setOrderItems(itemsWithProducts);

      // Load payment info
      try {
        const payment = await trpc.payments.getByOrderId.query(order.id);
        setOrderPayment(payment);
      } catch {
        setOrderPayment(null); // Payment might not exist yet
      }

      setSelectedOrder(order);
      setIsOrderDetailOpen(true);
    } catch (error: any) {
      setError(error.message || 'Gagal memuat detail pesanan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    if (!confirm('Yakin ingin membatalkan pesanan ini?')) return;

    setIsLoading(true);
    setError(null);

    try {
      await trpc.orders.cancel.mutate({
        orderId,
        userId: user.id
      });
      
      await loadOrders();
      setIsOrderDetailOpen(false);
      setSuccess('Pesanan berhasil dibatalkan');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.message || 'Gagal membatalkan pesanan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProcessPayment = async (orderId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      await trpc.payments.process.mutate({
        order_id: orderId,
        payment_method: 'midtrans'
      });
      
      setSuccess('Proses pembayaran dimulai. Silakan ikuti instruksi pembayaran.');
      setTimeout(() => setSuccess(null), 5000);
      
      // Reload order details to get updated payment info
      if (selectedOrder) {
        await loadOrderDetails(selectedOrder);
      }
    } catch (error: any) {
      setError(error.message || 'Gagal memproses pembayaran');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'pending': return 'secondary';
      case 'paid': return 'default';
      case 'processing': return 'outline';
      case 'shipped': return 'default';
      case 'delivered': return 'default';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Menunggu Pembayaran';
      case 'paid': return 'Sudah Dibayar';
      case 'processing': return 'Sedang Diproses';
      case 'shipped': return 'Dikirim';
      case 'delivered': return 'Selesai';
      case 'cancelled': return 'Dibatalkan';
      default: return status.toUpperCase();
    }
  };

  const getPaymentStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Menunggu Pembayaran';
      case 'paid': return 'Sudah Dibayar';
      case 'failed': return 'Gagal';
      case 'cancelled': return 'Dibatalkan';
      default: return status.toUpperCase();
    }
  };

  const canCancelOrder = (order: Order) => {
    return ['pending', 'paid'].includes(order.status);
  };

  const canPayOrder = (order: Order) => {
    return order.status === 'pending';
  };

  if (orders.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">📋 Riwayat Pesanan</h2>
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
          <div className="text-6xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Belum Ada Pesanan</h3>
          <p className="text-gray-500 mb-6">
            Anda belum memiliki riwayat pesanan. Mulai berbelanja sekarang!
          </p>
          <Button onClick={() => window.location.reload()} variant="outline">
            🛍️ Mulai Belanja
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">📋 Riwayat Pesanan</h2>
        <Badge variant="outline" className="text-blue-600">
          {orders.length} pesanan
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

      <div className="grid gap-4">
        {orders.map((order: Order) => (
          <Card key={order.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">#{order.order_number}</CardTitle>
                  <p className="text-sm text-gray-600">
                    {order.created_at.toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
                <Badge variant={getStatusBadgeVariant(order.status)}>
                  {getStatusText(order.status)}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total Produk:</span>
                    <span className="font-semibold">Rp {order.total_amount.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Biaya Pengiriman:</span>
                    <span className="font-semibold">Rp {order.shipping_cost.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-2">
                    <span>Total Bayar:</span>
                    <span className="text-blue-600">
                      Rp {(order.total_amount + order.shipping_cost).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  {order.shipping_tracking_number && (
                    <div className="text-sm">
                      <span className="font-semibold">Nomor Resi: </span>
                      <code className="bg-gray-100 px-2 py-1 rounded text-xs">
                        {order.shipping_tracking_number}
                      </code>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Dialog open={isOrderDetailOpen} onOpenChange={setIsOrderDetailOpen}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => loadOrderDetails(order)}
                      disabled={isLoading}
                    >
                      👁️ Detail Pesanan
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>
                        Detail Pesanan #{selectedOrder?.order_number}
                      </DialogTitle>
                    </DialogHeader>
                    
                    {selectedOrder && (
                      <div className="space-y-6">
                        {/* Order Info */}
                        <div className="grid md:grid-cols-2 gap-4">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">Informasi Pesanan</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                              <div className="flex justify-between">
                                <span>Status:</span>
                                <Badge variant={getStatusBadgeVariant(selectedOrder.status)}>
                                  {getStatusText(selectedOrder.status)}
                                </Badge>
                              </div>
                              <div className="flex justify-between">
                                <span>Tanggal:</span>
                                <span>{selectedOrder.created_at.toLocaleDateString('id-ID')}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Total Produk:</span>
                                <span>Rp {selectedOrder.total_amount.toLocaleString('id-ID')}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Biaya Kirim:</span>
                                <span>Rp {selectedOrder.shipping_cost.toLocaleString('id-ID')}</span>
                              </div>
                              <div className="flex justify-between font-bold border-t pt-2">
                                <span>Total:</span>
                                <span className="text-blue-600">
                                  Rp {(selectedOrder.total_amount + selectedOrder.shipping_cost).toLocaleString('id-ID')}
                                </span>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Payment Info */}
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-lg">Informasi Pembayaran</CardTitle>
                            </CardHeader>
                            <CardContent>
                              {orderPayment ? (
                                <div className="space-y-2">
                                  <div className="flex justify-between">
                                    <span>Status:</span>
                                    <Badge variant={orderPayment.payment_status === 'paid' ? 'default' : 'secondary'}>
                                      {getPaymentStatusText(orderPayment.payment_status)}
                                    </Badge>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Metode:</span>
                                    <span className="capitalize">{orderPayment.payment_method}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Jumlah:</span>
                                    <span>Rp {orderPayment.amount.toLocaleString('id-ID')}</span>
                                  </div>
                                  {orderPayment.paid_at && (
                                    <div className="flex justify-between">
                                      <span>Dibayar:</span>
                                      <span>{orderPayment.paid_at.toLocaleDateString('id-ID')}</span>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-center py-4">
                                  <p className="text-gray-500 mb-4">Belum ada informasi pembayaran</p>
                                  {canPayOrder(selectedOrder) && (
                                    <Button 
                                      onClick={() => handleProcessPayment(selectedOrder.id)}
                                      disabled={isLoading}
                                    >
                                      💳 Bayar Sekarang
                                    </Button>
                                  )}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </div>

                        {/* Order Items */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Item Pesanan</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-4">
                              {orderItems.map((item: OrderItemWithProduct) => (
                                <div key={item.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                                  <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                                    {item.product.image_url ? (
                                      <img
                                        src={item.product.image_url}
                                        alt={item.product.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center">
                                        <span className="text-xl">📦</span>
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex-1">
                                    <h4 className="font-semibold">{item.product.name}</h4>
                                    <p className="text-sm text-gray-600">
                                      Rp {item.unit_price.toLocaleString('id-ID')} x {item.quantity}
                                    </p>
                                  </div>
                                  
                                  <div className="text-right">
                                    <p className="font-bold">
                                      Rp {item.total_price.toLocaleString('id-ID')}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Shipping Address */}
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-lg">Alamat Pengiriman</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <pre className="whitespace-pre-wrap text-sm">
                                {selectedOrder.shipping_address}
                              </pre>
                            </div>
                            {selectedOrder.shipping_tracking_number && (
                              <div className="mt-4">
                                <p className="text-sm font-semibold">Nomor Resi:</p>
                                <code className="bg-gray-100 px-3 py-2 rounded text-sm">
                                  {selectedOrder.shipping_tracking_number}
                                </code>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>

                {canPayOrder(order) && (
                  <Button 
                    size="sm"
                    onClick={() => handleProcessPayment(order.id)}
                    disabled={isLoading}
                  >
                    💳 Bayar
                  </Button>
                )}

                {canCancelOrder(order) && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleCancelOrder(order.id)}
                    disabled={isLoading}
                    className="text-red-600 hover:text-red-700"
                  >
                    ❌ Batalkan
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}