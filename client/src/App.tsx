import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import { useState, useEffect, useCallback } from 'react';
import type { User, Product, Category, CartItem, Order, CustomerAddress } from '../../server/src/schema';
import { AdminPanel } from '@/components/AdminPanel';
import { ProductCatalog } from '@/components/ProductCatalog';
import { ShoppingCart } from '@/components/ShoppingCart';
import { CustomerOrders } from '@/components/CustomerOrders';
import { UserProfile } from '@/components/UserProfile';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('products');
  const [cartItemsCount, setCartItemsCount] = useState(0);

  // Auth form states
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authForm, setAuthForm] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: ''
  });

  // Load cart count when user changes
  const loadCartCount = useCallback(async () => {
    if (!user) {
      setCartItemsCount(0);
      return;
    }

    try {
      const cartItems = await trpc.cart.getByUserId.query(user.id);
      const count = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      setCartItemsCount(count);
    } catch (error) {
      console.error('Failed to load cart count:', error);
    }
  }, [user]);

  useEffect(() => {
    loadCartCount();
  }, [loadCartCount]);

  // Check for stored auth token on app start
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      verifyStoredToken(token);
    }
  }, []);

  const verifyStoredToken = async (token: string) => {
    try {
      const userData = await trpc.auth.verifyToken.query(token);
      setUser(userData);
    } catch (error) {
      localStorage.removeItem('auth_token');
      console.error('Invalid token:', error);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isLoginMode) {
        const response = await trpc.auth.login.mutate({
          email: authForm.email,
          password: authForm.password
        });
        
        setUser(response.user);
        localStorage.setItem('auth_token', response.token);
      } else {
        const response = await trpc.auth.register.mutate({
          email: authForm.email,
          password: authForm.password,
          full_name: authForm.full_name,
          phone: authForm.phone || null,
          role: 'customer' as const
        });
        
        setUser(response.user);
        localStorage.setItem('auth_token', response.token);
      }

      setAuthForm({ email: '', password: '', full_name: '', phone: '' });
    } catch (error: any) {
      setError(error.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('auth_token');
    setActiveTab('products');
    setCartItemsCount(0);
  };

  const updateCartCount = (newCount: number) => {
    setCartItemsCount(newCount);
  };

  // If not authenticated, show login/register form
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-800">
              🛒 Selamat Datang di E-Commerce
            </CardTitle>
            <p className="text-gray-600 mt-2">
              {isLoginMode ? 'Masuk ke akun Anda' : 'Buat akun baru'}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              <Input
                type="email"
                placeholder="Email"
                value={authForm.email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setAuthForm((prev) => ({ ...prev, email: e.target.value }))
                }
                required
              />
              
              <Input
                type="password"
                placeholder="Password"
                value={authForm.password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setAuthForm((prev) => ({ ...prev, password: e.target.value }))
                }
                required
              />

              {!isLoginMode && (
                <>
                  <Input
                    placeholder="Nama Lengkap"
                    value={authForm.full_name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setAuthForm((prev) => ({ ...prev, full_name: e.target.value }))
                    }
                    required
                  />
                  <Input
                    placeholder="Nomor Telepon (opsional)"
                    value={authForm.phone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setAuthForm((prev) => ({ ...prev, phone: e.target.value }))
                    }
                  />
                </>
              )}

              {error && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertDescription className="text-red-700">{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Loading...' : (isLoginMode ? 'Masuk' : 'Daftar')}
              </Button>

              <div className="text-center">
                <Button 
                  type="button"
                  variant="link" 
                  onClick={() => {
                    setIsLoginMode(!isLoginMode);
                    setError(null);
                  }}
                  className="text-blue-600"
                >
                  {isLoginMode ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main application interface
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-800">🛒 E-Commerce</h1>
            <Badge variant="secondary" className="hidden sm:flex">
              {user.role === 'admin' ? '👑 Admin' : '👤 Customer'}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600 hidden sm:block">
              Halo, {user.full_name}
            </span>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleLogout}
              className="text-red-600 hover:text-red-700"
            >
              Keluar
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b">
        <div className="container mx-auto px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5 bg-transparent border-none">
              <TabsTrigger 
                value="products" 
                className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700"
              >
                🛍️ Produk
              </TabsTrigger>
              
              {user.role === 'customer' && (
                <>
                  <TabsTrigger 
                    value="cart"
                    className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700 relative"
                  >
                    🛒 Keranjang
                    {cartItemsCount > 0 && (
                      <Badge className="absolute -top-2 -right-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] h-5 flex items-center justify-center">
                        {cartItemsCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger 
                    value="orders"
                    className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700"
                  >
                    📋 Pesanan
                  </TabsTrigger>
                  <TabsTrigger 
                    value="profile"
                    className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700"
                  >
                    👤 Profil
                  </TabsTrigger>
                </>
              )}
              
              {user.role === 'admin' && (
                <TabsTrigger 
                  value="admin"
                  className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-700"
                >
                  ⚙️ Admin Panel
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} className="w-full">
          <TabsContent value="products">
            <ProductCatalog user={user} onCartUpdate={updateCartCount} />
          </TabsContent>

          {user.role === 'customer' && (
            <>
              <TabsContent value="cart">
                <ShoppingCart user={user} onCartUpdate={updateCartCount} />
              </TabsContent>
              
              <TabsContent value="orders">
                <CustomerOrders user={user} />
              </TabsContent>
              
              <TabsContent value="profile">
                <UserProfile user={user} onUserUpdate={setUser} />
              </TabsContent>
            </>
          )}

          {user.role === 'admin' && (
            <TabsContent value="admin">
              <AdminPanel user={user} />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}

export default App;