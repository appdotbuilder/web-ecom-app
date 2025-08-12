import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import { useState, useEffect, useCallback } from 'react';
import type { User, Product, Category } from '../../../server/src/schema';

interface ProductCatalogProps {
  user: User;
  onCartUpdate: (count: number) => void;
}

export function ProductCatalog({ user, onCartUpdate }: ProductCatalogProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const loadProducts = useCallback(async () => {
    try {
      const filters = {
        is_active: true,
        ...(searchTerm && { search: searchTerm }),
        ...(selectedCategory !== 'all' && { category_id: parseInt(selectedCategory) })
      };
      
      const result = await trpc.products.getAll.query(filters);
      setProducts(result.products);
    } catch (error) {
      console.error('Failed to load products:', error);
      setError('Gagal memuat produk');
    }
  }, [searchTerm, selectedCategory]);

  const loadCategories = useCallback(async () => {
    try {
      const result = await trpc.categories.getAll.query();
      setCategories(result);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, [loadProducts, loadCategories]);

  const handleAddToCart = async (productId: number) => {
    if (user.role !== 'customer') {
      setError('Hanya customer yang dapat menambahkan produk ke keranjang');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await trpc.cart.add.mutate({
        user_id: user.id,
        product_id: productId,
        quantity: 1
      });

      // Update cart count
      const cartItems = await trpc.cart.getByUserId.query(user.id);
      const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      onCartUpdate(totalCount);

      setSuccess('Produk berhasil ditambahkan ke keranjang! 🛒');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.message || 'Gagal menambahkan produk ke keranjang');
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryName = (categoryId: number) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Kategori Tidak Diketahui';
  };

  const filteredProducts = products.filter((product: Product) => {
    const matchesSearch = !searchTerm || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || 
      product.category_id.toString() === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">🛍️ Katalog Produk</h2>
        <Badge variant="outline" className="text-blue-600">
          {filteredProducts.length} produk tersedia
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="🔍 Cari produk..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            className="w-full"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Pilih kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {categories.map((category: Category) => (
              <SelectItem key={category.id} value={category.id.toString()}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Tidak ada produk ditemukan</h3>
          <p className="text-gray-500">
            {searchTerm || selectedCategory !== 'all' 
              ? 'Coba ubah filter pencarian Anda'
              : 'Belum ada produk yang tersedia saat ini'
            }
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product: Product) => (
            <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-square bg-gray-100 relative">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                      e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk3YTNiNCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📦</div>
                      <span className="text-sm text-gray-500">No Image</span>
                    </div>
                  </div>
                )}
                
                {/* Stock indicator */}
                {product.stock_quantity <= 0 && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <Badge variant="destructive" className="text-white">
                      Habis
                    </Badge>
                  </div>
                )}
                
                {/* Low stock warning */}
                {product.stock_quantity > 0 && product.stock_quantity <= 5 && (
                  <Badge className="absolute top-2 right-2 bg-orange-500 text-white">
                    Stok Terbatas
                  </Badge>
                )}
              </div>
              
              <CardHeader className="pb-2">
                <CardTitle className="text-lg line-clamp-2">{product.name}</CardTitle>
                <Badge variant="secondary" className="w-fit text-xs">
                  {getCategoryName(product.category_id)}
                </Badge>
              </CardHeader>
              
              <CardContent className="pt-0">
                {product.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {product.description}
                  </p>
                )}
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold text-blue-600">
                      Rp {product.price.toLocaleString('id-ID')}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Stok: {product.stock_quantity}</span>
                    <span className="text-gray-600">Berat: {product.weight}g</span>
                  </div>
                </div>

                {user.role === 'customer' && (
                  <Button
                    onClick={() => handleAddToCart(product.id)}
                    disabled={isLoading || product.stock_quantity <= 0}
                    className="w-full"
                    variant={product.stock_quantity <= 0 ? 'outline' : 'default'}
                  >
                    {product.stock_quantity <= 0 ? (
                      <>❌ Stok Habis</>
                    ) : isLoading ? (
                      <>⏳ Menambahkan...</>
                    ) : (
                      <>🛒 Tambah ke Keranjang</>
                    )}
                  </Button>
                )}

                {user.role === 'admin' && (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">
                      Admin View - ID: {product.id}
                    </div>
                    <Badge variant={product.is_active ? 'default' : 'secondary'} className="w-full justify-center">
                      {product.is_active ? 'Produk Aktif' : 'Produk Nonaktif'}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}