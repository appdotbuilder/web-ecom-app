import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/utils/trpc';
import { useState, useEffect, useCallback } from 'react';
import type { User, CustomerAddress, CreateCustomerAddressInput } from '../../../server/src/schema';

interface UserProfileProps {
  user: User;
  onUserUpdate: (user: User) => void;
}

export function UserProfile({ user, onUserUpdate }: UserProfileProps) {
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    full_name: user.full_name,
    phone: user.phone || '',
    email: user.email
  });

  // Address form state
  const [addressForm, setAddressForm] = useState<CreateCustomerAddressInput>({
    user_id: user.id,
    name: '',
    phone: '',
    address_line1: '',
    address_line2: null,
    city: '',
    province: '',
    postal_code: '',
    is_default: false
  });

  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null);
  const [isAddressDialogOpen, setIsAddressDialogOpen] = useState(false);

  const loadAddresses = useCallback(async () => {
    try {
      const result = await trpc.addresses.getByUserId.query(user.id);
      setAddresses(result);
    } catch (error) {
      console.error('Failed to load addresses:', error);
      setError('Gagal memuat alamat');
    }
  }, [user.id]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const updatedUser = await trpc.users.update.mutate({
        id: user.id,
        full_name: profileForm.full_name,
        phone: profileForm.phone || null,
        email: profileForm.email
      });
      
      onUserUpdate(updatedUser);
      setSuccess('Profil berhasil diperbarui! ✅');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.message || 'Gagal memperbarui profil');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (editingAddress) {
        await trpc.addresses.update.mutate({
          id: editingAddress.id,
          ...addressForm
        });
      } else {
        await trpc.addresses.create.mutate(addressForm);
      }
      
      await loadAddresses();
      setIsAddressDialogOpen(false);
      resetAddressForm();
      setSuccess(editingAddress ? 'Alamat berhasil diperbarui! ✅' : 'Alamat berhasil ditambahkan! ✅');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.message || 'Gagal menyimpan alamat');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAddress = async (id: number) => {
    if (!confirm('Yakin ingin menghapus alamat ini?')) return;

    setIsLoading(true);
    setError(null);

    try {
      await trpc.addresses.delete.mutate(id);
      await loadAddresses();
      setSuccess('Alamat berhasil dihapus! ✅');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.message || 'Gagal menghapus alamat');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetDefaultAddress = async (addressId: number) => {
    setIsLoading(true);
    setError(null);

    try {
      await trpc.addresses.setDefault.mutate({
        addressId,
        userId: user.id
      });
      
      await loadAddresses();
      setSuccess('Alamat default berhasil diubah! ✅');
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      setError(error.message || 'Gagal mengubah alamat default');
    } finally {
      setIsLoading(false);
    }
  };

  const resetAddressForm = () => {
    setAddressForm({
      user_id: user.id,
      name: '',
      phone: '',
      address_line1: '',
      address_line2: null,
      city: '',
      province: '',
      postal_code: '',
      is_default: false
    });
    setEditingAddress(null);
  };

  const openAddressDialog = (address?: CustomerAddress) => {
    if (address) {
      setEditingAddress(address);
      setAddressForm({
        user_id: user.id,
        name: address.name,
        phone: address.phone,
        address_line1: address.address_line1,
        address_line2: address.address_line2,
        city: address.city,
        province: address.province,
        postal_code: address.postal_code,
        is_default: address.is_default
      });
    } else {
      resetAddressForm();
    }
    setIsAddressDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">👤 Profil Pengguna</h2>
        <Badge variant="outline" className="text-blue-600">
          {user.role === 'admin' ? '👑 Administrator' : '👤 Customer'}
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

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile">📝 Informasi Profil</TabsTrigger>
          <TabsTrigger value="addresses">🏠 Alamat ({addresses.length})</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Informasi Profil</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="full_name">Nama Lengkap</Label>
                    <Input
                      id="full_name"
                      value={profileForm.full_name}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setProfileForm((prev) => ({ ...prev, full_name: e.target.value }))
                      }
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileForm.email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setProfileForm((prev) => ({ ...prev, email: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="phone">Nomor Telepon</Label>
                  <Input
                    id="phone"
                    value={profileForm.phone}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setProfileForm((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="Contoh: +62812345678"
                  />
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Informasi Akun</h4>
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">ID Pengguna:</span>
                      <span className="ml-2 font-mono">{user.id}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Role:</span>
                      <Badge className="ml-2" variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-gray-600">Terdaftar:</span>
                      <span className="ml-2">{user.created_at.toLocaleDateString('id-ID')}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Terakhir Update:</span>
                      <span className="ml-2">{user.updated_at.toLocaleDateString('id-ID')}</span>
                    </div>
                  </div>
                </div>

                <Button type="submit" disabled={isLoading} className="w-full">
                  {isLoading ? 'Menyimpan...' : '💾 Simpan Perubahan'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Addresses Tab */}
        <TabsContent value="addresses" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Kelola Alamat</h3>
            <Dialog open={isAddressDialogOpen} onOpenChange={setIsAddressDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => openAddressDialog()}>
                  ➕ Tambah Alamat
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingAddress ? 'Edit Alamat' : 'Tambah Alamat Baru'}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAddressSubmit} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Nama Penerima</Label>
                      <Input
                        id="name"
                        value={addressForm.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setAddressForm((prev: CreateCustomerAddressInput) => ({ ...prev, name: e.target.value }))
                        }
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="phone">Nomor Telepon</Label>
                      <Input
                        id="phone"
                        value={addressForm.phone}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setAddressForm((prev: CreateCustomerAddressInput) => ({ ...prev, phone: e.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="address_line1">Alamat Lengkap</Label>
                    <Input
                      id="address_line1"
                      value={addressForm.address_line1}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setAddressForm((prev: CreateCustomerAddressInput) => ({ ...prev, address_line1: e.target.value }))
                      }
                      placeholder="Jalan, Gang, Nomor Rumah"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="address_line2">Detail Tambahan (Opsional)</Label>
                    <Input
                      id="address_line2"
                      value={addressForm.address_line2 || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setAddressForm((prev: CreateCustomerAddressInput) => ({ ...prev, address_line2: e.target.value || null }))
                      }
                      placeholder="RT/RW, Kelurahan, Kecamatan"
                    />
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="city">Kota</Label>
                      <Input
                        id="city"
                        value={addressForm.city}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setAddressForm((prev: CreateCustomerAddressInput) => ({ ...prev, city: e.target.value }))
                        }
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="province">Provinsi</Label>
                      <Input
                        id="province"
                        value={addressForm.province}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setAddressForm((prev: CreateCustomerAddressInput) => ({ ...prev, province: e.target.value }))
                        }
                        required
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="postal_code">Kode Pos</Label>
                      <Input
                        id="postal_code"
                        value={addressForm.postal_code}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setAddressForm((prev: CreateCustomerAddressInput) => ({ ...prev, postal_code: e.target.value }))
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={addressForm.is_default}
                      onCheckedChange={(checked) =>
                        setAddressForm((prev: CreateCustomerAddressInput) => ({ ...prev, is_default: checked }))
                      }
                    />
                    <Label>Jadikan alamat default</Label>
                  </div>

                  <DialogFooter>
                    <Button type="submit" disabled={isLoading}>
                      {isLoading ? 'Menyimpan...' : (editingAddress ? 'Update Alamat' : 'Simpan Alamat')}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {addresses.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🏠</div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Belum Ada Alamat</h3>
              <p className="text-gray-500 mb-4">
                Tambahkan alamat pengiriman untuk memudahkan checkout
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {addresses.map((address: CustomerAddress) => (
                <Card key={address.id} className={`${address.is_default ? 'ring-2 ring-blue-500' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{address.name}</CardTitle>
                      {address.is_default && (
                        <Badge className="bg-blue-500">Default</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{address.phone}</p>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-1 text-sm mb-4">
                      <p>{address.address_line1}</p>
                      {address.address_line2 && <p>{address.address_line2}</p>}
                      <p>{address.city}, {address.province}</p>
                      <p>Kode Pos: {address.postal_code}</p>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => openAddressDialog(address)}
                        disabled={isLoading}
                      >
                        ✏️ Edit
                      </Button>
                      
                      {!address.is_default && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleSetDefaultAddress(address.id)}
                          disabled={isLoading}
                        >
                          ⭐ Jadikan Default
                        </Button>
                      )}
                      
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteAddress(address.id)}
                        disabled={isLoading || address.is_default}
                        className="text-red-600 hover:text-red-700"
                      >
                        🗑️ Hapus
                      </Button>
                    </div>
                    
                    {address.is_default && (
                      <p className="text-xs text-gray-500 mt-2">
                        * Alamat default tidak dapat dihapus
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}