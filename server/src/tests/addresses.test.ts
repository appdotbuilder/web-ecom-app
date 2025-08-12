import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, customerAddressesTable, ordersTable } from '../db/schema';
import { type CreateCustomerAddressInput } from '../schema';
import { 
  createAddress,
  getAddressesByUserId,
  getAddressById,
  updateAddress,
  deleteAddress,
  setDefaultAddress
} from '../handlers/addresses';
import { eq } from 'drizzle-orm';

describe('Address Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        full_name: 'Test User',
        phone: '1234567890',
        role: 'customer'
      })
      .returning()
      .execute();

    testUserId = userResult[0].id;
  });

  describe('createAddress', () => {
    const testInput: CreateCustomerAddressInput = {
      user_id: 0, // Will be set in tests
      name: 'John Doe',
      phone: '1234567890',
      address_line1: '123 Main St',
      address_line2: 'Apt 2B',
      city: 'Jakarta',
      province: 'DKI Jakarta',
      postal_code: '12345',
      is_default: false
    };

    it('should create an address successfully', async () => {
      const input = { ...testInput, user_id: testUserId };
      const result = await createAddress(input);

      expect(result.name).toEqual('John Doe');
      expect(result.phone).toEqual('1234567890');
      expect(result.address_line1).toEqual('123 Main St');
      expect(result.address_line2).toEqual('Apt 2B');
      expect(result.city).toEqual('Jakarta');
      expect(result.province).toEqual('DKI Jakarta');
      expect(result.postal_code).toEqual('12345');
      expect(result.is_default).toEqual(false);
      expect(result.user_id).toEqual(testUserId);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should save address to database', async () => {
      const input = { ...testInput, user_id: testUserId };
      const result = await createAddress(input);

      const addresses = await db.select()
        .from(customerAddressesTable)
        .where(eq(customerAddressesTable.id, result.id))
        .execute();

      expect(addresses).toHaveLength(1);
      expect(addresses[0].name).toEqual('John Doe');
      expect(addresses[0].user_id).toEqual(testUserId);
    });

    it('should set as default and unset other defaults when is_default is true', async () => {
      // Create first address as default
      const firstInput = { ...testInput, user_id: testUserId, is_default: true };
      const firstAddress = await createAddress(firstInput);

      // Create second address as default
      const secondInput = { 
        ...testInput, 
        user_id: testUserId, 
        name: 'Jane Doe',
        address_line1: '456 Oak St',
        is_default: true 
      };
      const secondAddress = await createAddress(secondInput);

      // Check that first address is no longer default
      const updatedFirstAddress = await getAddressById(firstAddress.id);
      expect(updatedFirstAddress?.is_default).toBe(false);

      // Check that second address is default
      expect(secondAddress.is_default).toBe(true);
    });

    it('should throw error for non-existent user', async () => {
      const input = { ...testInput, user_id: 99999 };
      
      await expect(createAddress(input)).rejects.toThrow(/User not found/i);
    });
  });

  describe('getAddressesByUserId', () => {
    it('should return empty array when user has no addresses', async () => {
      const addresses = await getAddressesByUserId(testUserId);
      expect(addresses).toHaveLength(0);
    });

    it('should return user addresses', async () => {
      // Create test addresses
      await createAddress({
        user_id: testUserId,
        name: 'Address 1',
        phone: '1111111111',
        address_line1: '123 First St',
        address_line2: null,
        city: 'Jakarta',
        province: 'DKI Jakarta',
        postal_code: '12345',
        is_default: true
      });

      await createAddress({
        user_id: testUserId,
        name: 'Address 2',
        phone: '2222222222',
        address_line1: '456 Second St',
        address_line2: 'Suite 100',
        city: 'Bandung',
        province: 'Jawa Barat',
        postal_code: '54321',
        is_default: false
      });

      const addresses = await getAddressesByUserId(testUserId);
      expect(addresses).toHaveLength(2);
      expect(addresses[0].name).toEqual('Address 1');
      expect(addresses[1].name).toEqual('Address 2');
    });
  });

  describe('getAddressById', () => {
    it('should return null for non-existent address', async () => {
      const address = await getAddressById(99999);
      expect(address).toBeNull();
    });

    it('should return address when found', async () => {
      const createdAddress = await createAddress({
        user_id: testUserId,
        name: 'Test Address',
        phone: '1234567890',
        address_line1: '123 Test St',
        address_line2: null,
        city: 'Jakarta',
        province: 'DKI Jakarta',
        postal_code: '12345',
        is_default: false
      });

      const foundAddress = await getAddressById(createdAddress.id);
      expect(foundAddress).not.toBeNull();
      expect(foundAddress?.name).toEqual('Test Address');
      expect(foundAddress?.id).toEqual(createdAddress.id);
    });
  });

  describe('updateAddress', () => {
    let testAddressId: number;

    beforeEach(async () => {
      const address = await createAddress({
        user_id: testUserId,
        name: 'Original Name',
        phone: '1234567890',
        address_line1: '123 Original St',
        address_line2: null,
        city: 'Jakarta',
        province: 'DKI Jakarta',
        postal_code: '12345',
        is_default: false
      });
      testAddressId = address.id;
    });

    it('should update address fields', async () => {
      const result = await updateAddress({
        id: testAddressId,
        name: 'Updated Name',
        city: 'Bandung',
        address_line2: 'Floor 2'
      });

      expect(result.name).toEqual('Updated Name');
      expect(result.city).toEqual('Bandung');
      expect(result.address_line2).toEqual('Floor 2');
      expect(result.address_line1).toEqual('123 Original St'); // Unchanged
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should set as default and unset other defaults', async () => {
      // Create another address as default first
      const defaultAddress = await createAddress({
        user_id: testUserId,
        name: 'Default Address',
        phone: '9876543210',
        address_line1: '999 Default St',
        address_line2: null,
        city: 'Jakarta',
        province: 'DKI Jakarta',
        postal_code: '99999',
        is_default: true
      });

      // Update first address to be default
      const result = await updateAddress({
        id: testAddressId,
        is_default: true
      });

      expect(result.is_default).toBe(true);

      // Check that previous default is no longer default
      const updatedDefaultAddress = await getAddressById(defaultAddress.id);
      expect(updatedDefaultAddress?.is_default).toBe(false);
    });

    it('should throw error for non-existent address', async () => {
      await expect(updateAddress({
        id: 99999,
        name: 'New Name'
      })).rejects.toThrow(/Address not found/i);
    });
  });

  describe('deleteAddress', () => {
    it('should delete address successfully', async () => {
      // Create two addresses so we can delete one
      const address1 = await createAddress({
        user_id: testUserId,
        name: 'Address 1',
        phone: '1111111111',
        address_line1: '123 First St',
        address_line2: null,
        city: 'Jakarta',
        province: 'DKI Jakarta',
        postal_code: '12345',
        is_default: false
      });

      await createAddress({
        user_id: testUserId,
        name: 'Address 2',
        phone: '2222222222',
        address_line1: '456 Second St',
        address_line2: null,
        city: 'Bandung',
        province: 'Jawa Barat',
        postal_code: '54321',
        is_default: true
      });

      const result = await deleteAddress(address1.id);
      expect(result.success).toBe(true);

      // Verify address is deleted
      const deletedAddress = await getAddressById(address1.id);
      expect(deletedAddress).toBeNull();
    });

    it('should throw error when trying to delete the only address', async () => {
      const address = await createAddress({
        user_id: testUserId,
        name: 'Only Address',
        phone: '1234567890',
        address_line1: '123 Only St',
        address_line2: null,
        city: 'Jakarta',
        province: 'DKI Jakarta',
        postal_code: '12345',
        is_default: true
      });

      await expect(deleteAddress(address.id)).rejects.toThrow(/Cannot delete the only address/i);
    });

    it('should throw error for non-existent address', async () => {
      await expect(deleteAddress(99999)).rejects.toThrow(/Address not found/i);
    });

    it('should throw error when address is used in pending orders', async () => {
      // Create two addresses
      const address1 = await createAddress({
        user_id: testUserId,
        name: 'Address 1',
        phone: '1111111111',
        address_line1: '123 First St',
        address_line2: null,
        city: 'Jakarta',
        province: 'DKI Jakarta',
        postal_code: '12345',
        is_default: false
      });

      await createAddress({
        user_id: testUserId,
        name: 'Address 2',
        phone: '2222222222',
        address_line1: '456 Second St',
        address_line2: null,
        city: 'Bandung',
        province: 'Jawa Barat',
        postal_code: '54321',
        is_default: true
      });

      // Create a pending order using address1
      await db.insert(ordersTable)
        .values({
          user_id: testUserId,
          order_number: 'ORDER-001',
          status: 'pending',
          total_amount: '100.00',
          shipping_cost: '10.00',
          shipping_address: JSON.stringify({ id: address1.id, name: address1.name })
        })
        .execute();

      await expect(deleteAddress(address1.id)).rejects.toThrow(/Cannot delete address that is used in pending orders/i);
    });
  });

  describe('setDefaultAddress', () => {
    let address1Id: number;
    let address2Id: number;

    beforeEach(async () => {
      const addr1 = await createAddress({
        user_id: testUserId,
        name: 'Address 1',
        phone: '1111111111',
        address_line1: '123 First St',
        address_line2: null,
        city: 'Jakarta',
        province: 'DKI Jakarta',
        postal_code: '12345',
        is_default: true
      });

      const addr2 = await createAddress({
        user_id: testUserId,
        name: 'Address 2',
        phone: '2222222222',
        address_line1: '456 Second St',
        address_line2: null,
        city: 'Bandung',
        province: 'Jawa Barat',
        postal_code: '54321',
        is_default: false
      });

      address1Id = addr1.id;
      address2Id = addr2.id;
    });

    it('should set address as default and unset others', async () => {
      const result = await setDefaultAddress(address2Id, testUserId);
      
      expect(result.is_default).toBe(true);
      expect(result.id).toEqual(address2Id);

      // Check that first address is no longer default
      const address1 = await getAddressById(address1Id);
      expect(address1?.is_default).toBe(false);
    });

    it('should throw error for non-existent address', async () => {
      await expect(setDefaultAddress(99999, testUserId)).rejects.toThrow(/Address not found/i);
    });

    it('should throw error when address does not belong to user', async () => {
      // Create another user
      const anotherUser = await db.insert(usersTable)
        .values({
          email: 'another@example.com',
          password_hash: 'hashedpassword',
          full_name: 'Another User',
          phone: '9876543210',
          role: 'customer'
        })
        .returning()
        .execute();

      await expect(setDefaultAddress(address1Id, anotherUser[0].id))
        .rejects.toThrow(/Address does not belong to this user/i);
    });
  });
});