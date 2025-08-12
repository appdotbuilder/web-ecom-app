import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { trpc } from '@/utils/trpc';
import { useState, useEffect, useCallback } from 'react';
import type { User, Product, Category, Order, CreateProductInput, CreateCategoryInput } from '../../../server/src/schema';

interface AdminPanelProps {
  user: User;
}

export function AdminPanel({ user }: AdminPanelProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [productForm, setProductForm] = useState<CreateProductInput>({
    name: '',
    description: null,
    price: 0,
    stock_quantity: 0,
    category_id: 0,
    image_url: null,
    weight: 0,
    is_active: true
  });

  const [categoryForm, setCategoryForm] = useState<CreateCategoryInput>({
    name: '',
    description: null
  });

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);

  // Load data
  const loadProducts = useCallback(async () => {
    try {
      const result = await trpc.products.getAll.query();
      setProducts(result.products);
    } catch (error) {
      console.error('Failed to load products:', error);
    }
  }, []);

  const loadCategories = useCallback(async () => {
    try {
      const result = await trpc.categories.getAll.query();
      setCategories(result);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const result = await trpc.orders.getAll.query();
      setOrders(result.orders);
    } catch (error) {
      console.error('Failed to load orders:', error);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    loadCategories();
    loadOrders();
  }, [loadProducts, loadCategories, loadOrders]);

  // Product operations
  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (editingProduct) {
        await trpc.products.update.mutate({
          id: editingProduct.id,
          ...productForm
        });
      } else {
        await trpc.products.create.mutate(productForm);
      }
      
      await loadProducts();
      setIsProductDialogOpen(false);
      resetProductForm();
    } catch (error: any) {
      setError(error.message || 'Failed to save product');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Yakin ingin menghapus produk ini?')) return;

    try {
      await trpc.products.delete.mutate(id);
      await loadProducts();
    } catch (error: any) {
      setError(error.message || 'Failed to delete product');
    }
  };

  const resetProductForm = () => {
    setProductForm({
      name: '',
      description: null,
      price: 0,
      stock_quantity: 0,
      category_id: 0,
      image_url: null,
      weight: 0,
      is_active: true
    });
    setEditingProduct(null);
  };

  const openProductDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: product.name,
        description: product.description,
        price: product.price,
        stock_quantity: product.stock_quantity,
        category_id: product.category_id,
        image_url: product.image_url,
        weight: product.weight,
        is_active: product.is_active
      });
    } else {
      resetProductForm();
    }
    setIsProductDialogOpen(true);
  };

  // Category operations
  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (editingCategory) {
        await trpc.categories.update.mutate({
          id: editingCategory.id,
          ...categoryForm
        });
      } else {
        await trpc.categories.create.mutate(categoryForm);
      }
      
      await loadCategories();
      setIsCategoryDialogOpen(false);
      resetCategoryForm();
    } catch (error: any) {
      setError(error.message || 'Failed to save category');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm('Yakin ingin menghapus kategori ini?')) return;

    try {
      await trpc.categories.delete.mutate(id);
      await loadCategories();
    } catch (error: any) {
      setError(error.message || 'Failed to delete category');
    }
  };

  const resetCategoryForm = () => {
    setCategoryForm({ name: '', description: null });
    setEditingCategory(null);
  };

  const openCategoryDialog = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        description: category.description
      });
    } else {
      resetCategoryForm();
    }
    setIsCategoryDialogOpen(true);
  };

  // Order status update
  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    try {
      await trpc.orders.updateStatus.mutate({
        id: orderId,
        status: status as any
      });
      await loadOrders();
    } catch (error: any) {
      setError(error.message || 'Failed to update order status');
    }
  };

  const getCategoryName = (categoryId: number) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Unknown';
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">⚙️ Admin Panel</h2>
        <Badge variant="outline" className="text-blue-600">
          Mengelola sistem e-commerce
        </Badge>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="products" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="products">📦 Produk ({products.length})</TabsTrigger>
          <TabsTrigger value="categories">🏷️ Kategori ({categories.length})</TabsTrigger>
          <TabsTrigger value="orders">📋 Pesanan ({orders.length})</TabsTrigger>
        </TabsList>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Manajemen Produk</h3>
            <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => openProductDialog()}>
                  ➕ Tambah Produk
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleProductSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nama Produk</Label>
                      <Input
                        value={productForm.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setProductForm((prev: CreateProductInput) => ({ ...prev, name: e.target.value }))
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label>Kategori</Label>
                      <Select 
                        value={productForm.category_id.toString()} 
                        onValueChange={(value) =>
                          setProductForm((prev: CreateProductInput) => ({ ...prev, category_id: parseInt(value) }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih kategori" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category: Category) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label>Deskripsi</Label>
                    <Textarea
                      value={productForm.description || ''}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setProductForm((prev: CreateProductInput) => ({ ...prev, description: e.target.value || null }))
                      }
                      placeholder="Deskripsi produk (opsional)"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label>Harga (Rp)</Label>
                      <Input
                        type="number"
                        value={productForm.price}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setProductForm((prev: CreateProductInput) => ({ ...prev, price: parseFloat(e.target.value) || 0 }))
                        }
                        min="0"
                        step="1000"
                        required
                      />
                    </div>
                    <div>
                      <Label>Stok</Label>
                      <Input
                        type="number"
                        value={productForm.stock_quantity}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setProductForm((prev: CreateProductInput) => ({ ...prev, stock_quantity: parseInt(e.target.value) || 0 }))
                        }
                        min="0"
                        required
                      />
                    </div>
                    <div>
                      <Label>Berat (gram)</Label>
                      <Input
                        type="number"
                        value={productForm.weight}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setProductForm((prev: CreateProductInput) => ({ ...prev, weight: parseFloat(e.target.value) || 0 }))
                        }
                        min="0"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label>URL Gambar</Label>
                    <Input
                      value={productForm.image_url || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setProductForm((prev: CreateProductInput) => ({ ...prev, image_url: e.target.value || null }))
                      }
                      placeholder="https://example.com/image.jpg (opsional)"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={productForm.is_active}
                      onCheckedChange={(checked) =>
                        setProductForm((prev: CreateProductInput) => ({ ...prev, is_active: checked }))
                      }
                    />
                    <Label>Produk Aktif</Label>
                  </div>

                  <DialogFooter>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Menyimpan...' : (editingProduct ? 'Update' : 'Simpan')}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {products.map((product: Product) => (
              <Card key={product.id}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{product.name}</CardTitle>
                      <p className="text-sm text-gray-600">{getCategoryName(product.category_id)}</p>
                    </div>
                    <Badge variant={product.is_active ? 'default' : 'secondary'}>
                      {product.is_active ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {product.description && (
                    <p className="text-sm text-gray-700 mb-3 line-clamp-2">{product.description}</p>
                  )}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Harga:</span>
                      <span className="font-semibold">Rp {product.price.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Stok:</span>
                      <span className={product.stock_quantity < 10 ? 'text-red-600 font-semibold' : ''}>
                        {product.stock_quantity}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Berat:</span>
                      <span>{product.weight}g</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => openProductDialog(product)}
                      className="flex-1"
                    >
                      ✏️ Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDeleteProduct(product.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      🗑️ Hapus
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Manajemen Kategori</h3>
            <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => openCategoryDialog()}>
                  ➕ Tambah Kategori
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>
                    {editingCategory ? 'Edit Kategori' : 'Tambah Kategori Baru'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCategorySubmit} className="space-y-4">
                  <div>
                    <Label>Nama Kategori</Label>
                    <Input
                      value={categoryForm.name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setCategoryForm((prev: CreateCategoryInput) => ({ ...prev, name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>Deskripsi</Label>
                    <Textarea
                      value={categoryForm.description || ''}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setCategoryForm((prev: CreateCategoryInput) => ({ ...prev, description: e.target.value || null }))
                      }
                      placeholder="Deskripsi kategori (opsional)"
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Menyimpan...' : (editingCategory ? 'Update' : 'Simpan')}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {categories.map((category: Category) => (
              <Card key={category.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{category.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  {category.description && (
                    <p className="text-sm text-gray-700 mb-4">{category.description}</p>
                  )}
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => openCategoryDialog(category)}
                      className="flex-1"
                    >
                      ✏️ Edit
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDeleteCategory(category.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      🗑️ Hapus
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="space-y-4">
          <h3 className="text-lg font-semibold">Manajemen Pesanan</h3>
          
          <div className="grid gap-4">
            {orders.map((order: Order) => (
              <Card key={order.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">#{order.order_number}</CardTitle>
                      <p className="text-sm text-gray-600">
                        {order.created_at.toLocaleDateString('id-ID')} - {order.created_at.toLocaleTimeString('id-ID')}
                      </p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(order.status)}>
                      {order.status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
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
                        <span>Total:</span>
                        <span>Rp {(order.total_amount + order.shipping_cost).toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                    <div>
                      {order.status !== 'cancelled' && order.status !== 'delivered' && (
                        <div className="space-y-2">
                          <Label>Update Status:</Label>
                          <Select onValueChange={(value) => handleUpdateOrderStatus(order.id, value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih status baru" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="paid">PAID - Pembayaran Diterima</SelectItem>
                              <SelectItem value="processing">PROCESSING - Sedang Diproses</SelectItem>
                              <SelectItem value="shipped">SHIPPED - Telah Dikirim</SelectItem>
                              <SelectItem value="delivered">DELIVERED - Telah Sampai</SelectItem>
                              <SelectItem value="cancelled">CANCELLED - Dibatalkan</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {order.shipping_tracking_number && (
                        <p className="text-xs text-gray-600 mt-2">
                          Resi: {order.shipping_tracking_number}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}