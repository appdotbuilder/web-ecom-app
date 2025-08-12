import { db } from '../db';
import { customerAddressesTable, usersTable, ordersTable } from '../db/schema';
import { type CreateCustomerAddressInput, type CustomerAddress } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function createAddress(input: CreateCustomerAddressInput): Promise<CustomerAddress> {
  try {
    // Verify user exists
    const userExists = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (userExists.length === 0) {
      throw new Error('User not found');
    }

    // If this is being set as default, unset all other addresses for this user
    if (input.is_default) {
      await db.update(customerAddressesTable)
        .set({ 
          is_default: false,
          updated_at: new Date()
        })
        .where(eq(customerAddressesTable.user_id, input.user_id))
        .execute();
    }

    // Insert the new address
    const result = await db.insert(customerAddressesTable)
      .values({
        user_id: input.user_id,
        name: input.name,
        phone: input.phone,
        address_line1: input.address_line1,
        address_line2: input.address_line2,
        city: input.city,
        province: input.province,
        postal_code: input.postal_code,
        is_default: input.is_default
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Address creation failed:', error);
    throw error;
  }
}

export async function getAddressesByUserId(userId: number): Promise<CustomerAddress[]> {
  try {
    const addresses = await db.select()
      .from(customerAddressesTable)
      .where(eq(customerAddressesTable.user_id, userId))
      .execute();

    return addresses;
  } catch (error) {
    console.error('Failed to get addresses by user ID:', error);
    throw error;
  }
}

export async function getAddressById(id: number): Promise<CustomerAddress | null> {
  try {
    const addresses = await db.select()
      .from(customerAddressesTable)
      .where(eq(customerAddressesTable.id, id))
      .execute();

    return addresses.length > 0 ? addresses[0] : null;
  } catch (error) {
    console.error('Failed to get address by ID:', error);
    throw error;
  }
}

export async function updateAddress(input: { 
  id: number; 
  name?: string; 
  phone?: string; 
  address_line1?: string; 
  address_line2?: string | null; 
  city?: string; 
  province?: string; 
  postal_code?: string; 
  is_default?: boolean 
}): Promise<CustomerAddress> {
  try {
    // Get current address to verify it exists and get user_id
    const currentAddress = await getAddressById(input.id);
    if (!currentAddress) {
      throw new Error('Address not found');
    }

    // If is_default is being set to true, unset all other addresses for this user
    if (input.is_default === true) {
      await db.update(customerAddressesTable)
        .set({ 
          is_default: false,
          updated_at: new Date()
        })
        .where(eq(customerAddressesTable.user_id, currentAddress.user_id))
        .execute();
    }

    // Build update object with only provided fields
    const updateData: Record<string, any> = {
      updated_at: new Date()
    };

    if (input.name !== undefined) updateData['name'] = input.name;
    if (input.phone !== undefined) updateData['phone'] = input.phone;
    if (input.address_line1 !== undefined) updateData['address_line1'] = input.address_line1;
    if (input.address_line2 !== undefined) updateData['address_line2'] = input.address_line2;
    if (input.city !== undefined) updateData['city'] = input.city;
    if (input.province !== undefined) updateData['province'] = input.province;
    if (input.postal_code !== undefined) updateData['postal_code'] = input.postal_code;
    if (input.is_default !== undefined) updateData['is_default'] = input.is_default;

    // Update the address
    const result = await db.update(customerAddressesTable)
      .set(updateData)
      .where(eq(customerAddressesTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Address update failed:', error);
    throw error;
  }
}

export async function deleteAddress(id: number): Promise<{ success: boolean }> {
  try {
    // Get the address to verify it exists and get user_id
    const address = await getAddressById(id);
    if (!address) {
      throw new Error('Address not found');
    }

    // Check if this is the only address for the user
    const userAddresses = await getAddressesByUserId(address.user_id);
    if (userAddresses.length === 1) {
      throw new Error('Cannot delete the only address for this user');
    }

    // Check if address is being used in pending orders
    const pendingOrders = await db.select()
      .from(ordersTable)
      .where(
        and(
          eq(ordersTable.user_id, address.user_id),
          eq(ordersTable.status, 'pending')
        )
      )
      .execute();

    // Check if any pending order uses this address (stored as JSON string)
    const addressInUse = pendingOrders.some(order => {
      try {
        const shippingAddress = JSON.parse(order.shipping_address);
        return shippingAddress.id === id;
      } catch {
        return false;
      }
    });

    if (addressInUse) {
      throw new Error('Cannot delete address that is used in pending orders');
    }

    // Delete the address
    await db.delete(customerAddressesTable)
      .where(eq(customerAddressesTable.id, id))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Address deletion failed:', error);
    throw error;
  }
}

export async function setDefaultAddress(addressId: number, userId: number): Promise<CustomerAddress> {
  try {
    // Verify the address exists and belongs to the user
    const address = await getAddressById(addressId);
    if (!address) {
      throw new Error('Address not found');
    }
    if (address.user_id !== userId) {
      throw new Error('Address does not belong to this user');
    }

    // Unset all other addresses as default for this user
    await db.update(customerAddressesTable)
      .set({ 
        is_default: false,
        updated_at: new Date()
      })
      .where(eq(customerAddressesTable.user_id, userId))
      .execute();

    // Set this address as default
    const result = await db.update(customerAddressesTable)
      .set({ 
        is_default: true,
        updated_at: new Date()
      })
      .where(eq(customerAddressesTable.id, addressId))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Setting default address failed:', error);
    throw error;
  }
}