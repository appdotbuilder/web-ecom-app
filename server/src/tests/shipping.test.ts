import { describe, it, expect } from 'bun:test';
import { 
  calculateShippingCost, 
  getCities, 
  getProvinces, 
  trackShipment, 
  getCouriers 
} from '../handlers/shipping';
import { type CalculateShippingInput } from '../schema';

describe('Shipping Handlers', () => {
  describe('calculateShippingCost', () => {
    it('should calculate shipping cost for same city', async () => {
      const input: CalculateShippingInput = {
        origin_city_id: 1, // Jakarta Pusat
        destination_city_id: 1, // Jakarta Pusat (same city)
        weight: 1000, // 1kg
        courier: 'jne'
      };

      const result = await calculateShippingCost(input);

      expect(result.costs).toBeArray();
      expect(result.costs.length).toBeGreaterThan(0);
      
      // Check cost structure
      result.costs.forEach(cost => {
        expect(cost).toHaveProperty('service');
        expect(cost).toHaveProperty('cost');
        expect(cost).toHaveProperty('etd');
        expect(typeof cost.service).toBe('string');
        expect(typeof cost.cost).toBe('number');
        expect(typeof cost.etd).toBe('string');
        expect(cost.cost).toBeGreaterThan(0);
      });
    });

    it('should calculate shipping cost for different cities same province', async () => {
      const input: CalculateShippingInput = {
        origin_city_id: 1, // Jakarta Pusat
        destination_city_id: 2, // Jakarta Utara (same province)
        weight: 2000, // 2kg
        courier: 'jne'
      };

      const result = await calculateShippingCost(input);

      expect(result.costs).toBeArray();
      expect(result.costs.length).toBeGreaterThan(0);
      
      // Cost should be higher than same city
      const sameCityResult = await calculateShippingCost({
        ...input,
        destination_city_id: 1
      });

      // Compare similar service costs
      const regCost = result.costs.find(c => c.service === 'REG')?.cost || 0;
      const sameCityRegCost = sameCityResult.costs.find(c => c.service === 'REG')?.cost || 0;
      expect(regCost).toBeGreaterThan(sameCityRegCost);
    });

    it('should calculate shipping cost for different regions', async () => {
      const input: CalculateShippingInput = {
        origin_city_id: 1, // Jakarta Pusat (DKI Jakarta)
        destination_city_id: 12, // Medan (Sumatera Utara)
        weight: 1500, // 1.5kg
        courier: 'jne'
      };

      const result = await calculateShippingCost(input);

      expect(result.costs).toBeArray();
      expect(result.costs.length).toBeGreaterThan(0);

      // Verify JNE services
      const services = result.costs.map(c => c.service);
      expect(services).toContain('REG');
      expect(services).toContain('YES');
      expect(services).toContain('OKE');

      // YES should be more expensive than REG
      const regCost = result.costs.find(c => c.service === 'REG')?.cost || 0;
      const yesCost = result.costs.find(c => c.service === 'YES')?.cost || 0;
      expect(yesCost).toBeGreaterThan(regCost);
    });

    it('should handle different couriers', async () => {
      const baseInput: CalculateShippingInput = {
        origin_city_id: 1,
        destination_city_id: 11, // Surabaya
        weight: 1000,
        courier: 'jne'
      };

      // Test different couriers
      const couriers = ['jne', 'pos', 'tiki', 'jnt', 'sicepat'];
      
      for (const courier of couriers) {
        const result = await calculateShippingCost({
          ...baseInput,
          courier
        });

        expect(result.costs).toBeArray();
        expect(result.costs.length).toBeGreaterThan(0);
        
        // Each courier should have different services
        result.costs.forEach(cost => {
          expect(cost.service).toBeDefined();
          expect(cost.cost).toBeGreaterThan(0);
          expect(cost.etd).toMatch(/\d+(-\d+)?\s+hari/);
        });
      }
    });

    it('should handle weight scaling correctly', async () => {
      const baseInput: CalculateShippingInput = {
        origin_city_id: 1,
        destination_city_id: 10, // Bandung
        weight: 1000,
        courier: 'jne'
      };

      const result1kg = await calculateShippingCost(baseInput);
      const result2kg = await calculateShippingCost({
        ...baseInput,
        weight: 2000
      });

      const regCost1kg = result1kg.costs.find(c => c.service === 'REG')?.cost || 0;
      const regCost2kg = result2kg.costs.find(c => c.service === 'REG')?.cost || 0;
      
      // 2kg should cost more than 1kg
      expect(regCost2kg).toBeGreaterThan(regCost1kg);
    });

    it('should throw error for invalid weight', async () => {
      const input: CalculateShippingInput = {
        origin_city_id: 1,
        destination_city_id: 2,
        weight: -100, // Invalid negative weight
        courier: 'jne'
      };

      await expect(calculateShippingCost(input)).rejects.toThrow(/weight must be positive/i);
    });

    it('should throw error for unsupported courier', async () => {
      const input: CalculateShippingInput = {
        origin_city_id: 1,
        destination_city_id: 2,
        weight: 1000,
        courier: 'invalid_courier'
      };

      await expect(calculateShippingCost(input)).rejects.toThrow(/unsupported courier/i);
    });

    it('should handle unknown cities gracefully', async () => {
      const input: CalculateShippingInput = {
        origin_city_id: 99999, // Non-existent city
        destination_city_id: 1,
        weight: 1000,
        courier: 'jne'
      };

      const result = await calculateShippingCost(input);
      
      // Should still return costs (defaulting to most expensive zone)
      expect(result.costs).toBeArray();
      expect(result.costs.length).toBeGreaterThan(0);
    });
  });

  describe('getCities', () => {
    it('should return list of cities', async () => {
      const cities = await getCities();

      expect(cities).toBeArray();
      expect(cities.length).toBeGreaterThan(0);

      // Check structure of first city
      const firstCity = cities[0];
      expect(firstCity).toHaveProperty('city_id');
      expect(firstCity).toHaveProperty('city_name');
      expect(firstCity).toHaveProperty('province');
      expect(typeof firstCity.city_id).toBe('number');
      expect(typeof firstCity.city_name).toBe('string');
      expect(typeof firstCity.province).toBe('string');
    });

    it('should include major Indonesian cities', async () => {
      const cities = await getCities();
      const cityNames = cities.map(c => c.city_name);

      // Check for major cities
      expect(cityNames).toContain('Jakarta Pusat');
      expect(cityNames).toContain('Surabaya');
      expect(cityNames).toContain('Bandung');
      expect(cityNames).toContain('Medan');
    });

    it('should have cities with correct provinces', async () => {
      const cities = await getCities();
      
      const jakarta = cities.find(c => c.city_name === 'Jakarta Pusat');
      expect(jakarta?.province).toBe('DKI Jakarta');

      const surabaya = cities.find(c => c.city_name === 'Surabaya');
      expect(surabaya?.province).toBe('Jawa Timur');

      const bandung = cities.find(c => c.city_name === 'Bandung');
      expect(bandung?.province).toBe('Jawa Barat');
    });
  });

  describe('getProvinces', () => {
    it('should return list of provinces', async () => {
      const provinces = await getProvinces();

      expect(provinces).toBeArray();
      expect(provinces.length).toBeGreaterThan(0);

      // Check structure of first province
      const firstProvince = provinces[0];
      expect(firstProvince).toHaveProperty('province_id');
      expect(firstProvince).toHaveProperty('province_name');
      expect(typeof firstProvince.province_id).toBe('number');
      expect(typeof firstProvince.province_name).toBe('string');
    });

    it('should include major Indonesian provinces', async () => {
      const provinces = await getProvinces();
      const provinceNames = provinces.map(p => p.province_name);

      // Check for major provinces
      expect(provinceNames).toContain('DKI Jakarta');
      expect(provinceNames).toContain('Jawa Barat');
      expect(provinceNames).toContain('Jawa Timur');
      expect(provinceNames).toContain('Sumatera Utara');
      expect(provinceNames).toContain('Bali');
    });

    it('should have unique province IDs', async () => {
      const provinces = await getProvinces();
      const ids = provinces.map(p => p.province_id);
      const uniqueIds = [...new Set(ids)];

      expect(ids.length).toBe(uniqueIds.length);
    });
  });

  describe('getCouriers', () => {
    it('should return list of couriers', async () => {
      const couriers = await getCouriers();

      expect(couriers).toBeArray();
      expect(couriers.length).toBeGreaterThan(0);

      // Check structure of first courier
      const firstCourier = couriers[0];
      expect(firstCourier).toHaveProperty('code');
      expect(firstCourier).toHaveProperty('name');
      expect(typeof firstCourier.code).toBe('string');
      expect(typeof firstCourier.name).toBe('string');
    });

    it('should include major Indonesian couriers', async () => {
      const couriers = await getCouriers();
      const courierCodes = couriers.map(c => c.code);
      const courierNames = couriers.map(c => c.name);

      // Check for major couriers
      expect(courierCodes).toContain('jne');
      expect(courierCodes).toContain('pos');
      expect(courierCodes).toContain('tiki');
      expect(courierCodes).toContain('jnt');
      
      expect(courierNames).toContain('JNE');
      expect(courierNames).toContain('POS Indonesia');
      expect(courierNames).toContain('TIKI');
      expect(courierNames).toContain('J&T Express');
    });

    it('should have unique courier codes', async () => {
      const couriers = await getCouriers();
      const codes = couriers.map(c => c.code);
      const uniqueCodes = [...new Set(codes)];

      expect(codes.length).toBe(uniqueCodes.length);
    });
  });

  describe('trackShipment', () => {
    it('should track shipment with valid tracking number', async () => {
      const result = await trackShipment('JNE123456789', 'jne');

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('history');
      expect(typeof result.status).toBe('string');
      expect(result.history).toBeArray();

      // Check history structure
      result.history.forEach(entry => {
        expect(entry).toHaveProperty('date');
        expect(entry).toHaveProperty('description');
        expect(entry).toHaveProperty('location');
        expect(typeof entry.date).toBe('string');
        expect(typeof entry.description).toBe('string');
        expect(typeof entry.location).toBe('string');
      });
    });

    it('should return consistent results for same tracking number', async () => {
      const trackingNumber = 'TEST123456';
      
      const result1 = await trackShipment(trackingNumber, 'jne');
      const result2 = await trackShipment(trackingNumber, 'jne');

      // Should return same status for same tracking number
      expect(result1.status).toBe(result2.status);
      expect(result1.history.length).toBe(result2.history.length);
    });

    it('should work with different couriers', async () => {
      const trackingNumber = 'TRACK123456';
      const couriers = ['jne', 'pos', 'tiki', 'jnt'];

      for (const courier of couriers) {
        const result = await trackShipment(trackingNumber, courier);
        
        expect(result.status).toBeDefined();
        expect(result.history).toBeArray();
        expect(result.history.length).toBeGreaterThan(0);
      }
    });

    it('should have proper date format in history', async () => {
      const result = await trackShipment('DATE123456', 'jne');

      result.history.forEach(entry => {
        // Check date format (YYYY-MM-DD HH:MM)
        expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
      });
    });

    it('should throw error for empty tracking number', async () => {
      await expect(trackShipment('', 'jne')).rejects.toThrow(/tracking number and courier are required/i);
    });

    it('should throw error for empty courier', async () => {
      await expect(trackShipment('TRACK123', '')).rejects.toThrow(/tracking number and courier are required/i);
    });

    it('should throw error for unsupported courier', async () => {
      await expect(trackShipment('TRACK123', 'invalid_courier')).rejects.toThrow(/unsupported courier/i);
    });

    it('should have different tracking results for different tracking numbers', async () => {
      const result1 = await trackShipment('TRACK111', 'jne');
      const result2 = await trackShipment('TRACK222', 'jne');

      // Different tracking numbers should potentially have different statuses
      // (though they could be the same by chance)
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1.history).toBeArray();
      expect(result2.history).toBeArray();
    });
  });

  describe('Integration Tests', () => {
    it('should work together - get cities and calculate shipping', async () => {
      const cities = await getCities();
      const jakarta = cities.find(c => c.city_name === 'Jakarta Pusat');
      const surabaya = cities.find(c => c.city_name === 'Surabaya');

      expect(jakarta).toBeDefined();
      expect(surabaya).toBeDefined();

      if (jakarta && surabaya) {
        const shippingCost = await calculateShippingCost({
          origin_city_id: jakarta.city_id,
          destination_city_id: surabaya.city_id,
          weight: 1000,
          courier: 'jne'
        });

        expect(shippingCost.costs).toBeArray();
        expect(shippingCost.costs.length).toBeGreaterThan(0);
      }
    });

    it('should work together - get couriers and calculate shipping', async () => {
      const couriers = await getCouriers();
      const jne = couriers.find(c => c.code === 'jne');

      expect(jne).toBeDefined();

      if (jne) {
        const shippingCost = await calculateShippingCost({
          origin_city_id: 1,
          destination_city_id: 11,
          weight: 1000,
          courier: jne.code
        });

        expect(shippingCost.costs).toBeArray();
        expect(shippingCost.costs.length).toBeGreaterThan(0);
      }
    });

    it('should work together - get couriers and track shipment', async () => {
      const couriers = await getCouriers();
      const firstCourier = couriers[0];

      expect(firstCourier).toBeDefined();

      const tracking = await trackShipment('INT123456', firstCourier.code);
      
      expect(tracking.status).toBeDefined();
      expect(tracking.history).toBeArray();
    });
  });
});