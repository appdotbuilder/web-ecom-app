import { type CalculateShippingInput } from '../schema';

// Mock data for Indonesian provinces
const PROVINCES = [
  { province_id: 1, province_name: 'Bali' },
  { province_id: 2, province_name: 'Bangka Belitung' },
  { province_id: 3, province_name: 'Banten' },
  { province_id: 4, province_name: 'Bengkulu' },
  { province_id: 5, province_name: 'DI Yogyakarta' },
  { province_id: 6, province_name: 'DKI Jakarta' },
  { province_id: 7, province_name: 'Gorontalo' },
  { province_id: 8, province_name: 'Jambi' },
  { province_id: 9, province_name: 'Jawa Barat' },
  { province_id: 10, province_name: 'Jawa Tengah' },
  { province_id: 11, province_name: 'Jawa Timur' },
  { province_id: 12, province_name: 'Kalimantan Barat' },
  { province_id: 13, province_name: 'Kalimantan Selatan' },
  { province_id: 14, province_name: 'Kalimantan Tengah' },
  { province_id: 15, province_name: 'Kalimantan Timur' },
  { province_id: 16, province_name: 'Kepulauan Riau' },
  { province_id: 17, province_name: 'Lampung' },
  { province_id: 18, province_name: 'Maluku' },
  { province_id: 19, province_name: 'Maluku Utara' },
  { province_id: 20, province_name: 'Nusa Tenggara Barat' },
  { province_id: 21, province_name: 'Nusa Tenggara Timur' },
  { province_id: 22, province_name: 'Papua' },
  { province_id: 23, province_name: 'Papua Barat' },
  { province_id: 24, province_name: 'Riau' },
  { province_id: 25, province_name: 'Sulawesi Barat' },
  { province_id: 26, province_name: 'Sulawesi Selatan' },
  { province_id: 27, province_name: 'Sulawesi Tengah' },
  { province_id: 28, province_name: 'Sulawesi Tenggara' },
  { province_id: 29, province_name: 'Sulawesi Utara' },
  { province_id: 30, province_name: 'Sumatera Barat' },
  { province_id: 31, province_name: 'Sumatera Selatan' },
  { province_id: 32, province_name: 'Sumatera Utara' },
  { province_id: 33, province_name: 'Aceh' },
  { province_id: 34, province_name: 'Kalimantan Utara' }
];

// Mock data for major Indonesian cities
const CITIES = [
  { city_id: 1, city_name: 'Jakarta Pusat', province: 'DKI Jakarta' },
  { city_id: 2, city_name: 'Jakarta Utara', province: 'DKI Jakarta' },
  { city_id: 3, city_name: 'Jakarta Barat', province: 'DKI Jakarta' },
  { city_id: 4, city_name: 'Jakarta Selatan', province: 'DKI Jakarta' },
  { city_id: 5, city_name: 'Jakarta Timur', province: 'DKI Jakarta' },
  { city_id: 6, city_name: 'Bogor', province: 'Jawa Barat' },
  { city_id: 7, city_name: 'Depok', province: 'Jawa Barat' },
  { city_id: 8, city_name: 'Tangerang', province: 'Banten' },
  { city_id: 9, city_name: 'Bekasi', province: 'Jawa Barat' },
  { city_id: 10, city_name: 'Bandung', province: 'Jawa Barat' },
  { city_id: 11, city_name: 'Surabaya', province: 'Jawa Timur' },
  { city_id: 12, city_name: 'Medan', province: 'Sumatera Utara' },
  { city_id: 13, city_name: 'Semarang', province: 'Jawa Tengah' },
  { city_id: 14, city_name: 'Makassar', province: 'Sulawesi Selatan' },
  { city_id: 15, city_name: 'Palembang', province: 'Sumatera Selatan' },
  { city_id: 16, city_name: 'Batam', province: 'Kepulauan Riau' },
  { city_id: 17, city_name: 'Pekanbaru', province: 'Riau' },
  { city_id: 18, city_name: 'Bandar Lampung', province: 'Lampung' },
  { city_id: 19, city_name: 'Padang', province: 'Sumatera Barat' },
  { city_id: 20, city_name: 'Malang', province: 'Jawa Timur' },
  { city_id: 21, city_name: 'Samarinda', province: 'Kalimantan Timur' },
  { city_id: 22, city_name: 'Balikpapan', province: 'Kalimantan Timur' },
  { city_id: 23, city_name: 'Banjarmasin', province: 'Kalimantan Selatan' },
  { city_id: 24, city_name: 'Pontianak', province: 'Kalimantan Barat' },
  { city_id: 25, city_name: 'Denpasar', province: 'Bali' },
  { city_id: 26, city_name: 'Manado', province: 'Sulawesi Utara' },
  { city_id: 27, city_name: 'Ambon', province: 'Maluku' },
  { city_id: 28, city_name: 'Jayapura', province: 'Papua' },
  { city_id: 29, city_name: 'Kupang', province: 'Nusa Tenggara Timur' },
  { city_id: 30, city_name: 'Mataram', province: 'Nusa Tenggara Barat' }
];

// Available couriers in Indonesia
const COURIERS = [
  { code: 'jne', name: 'JNE' },
  { code: 'pos', name: 'POS Indonesia' },
  { code: 'tiki', name: 'TIKI' },
  { code: 'anteraja', name: 'AnterAja' },
  { code: 'jnt', name: 'J&T Express' },
  { code: 'sicepat', name: 'SiCepat' },
  { code: 'ninja', name: 'Ninja Express' },
  { code: 'lion', name: 'Lion Parcel' }
];

// Distance zones for shipping calculation (simplified)
const DISTANCE_ZONES = {
  'same_city': 1,
  'same_province': 2,
  'java_bali': 3,
  'sumatra': 4,
  'kalimantan': 5,
  'sulawesi': 6,
  'eastern_indonesia': 7
};

function getDistanceZone(originCityId: number, destinationCityId: number): number {
  const originCity = CITIES.find(c => c.city_id === originCityId);
  const destCity = CITIES.find(c => c.city_id === destinationCityId);
  
  if (!originCity || !destCity) {
    return DISTANCE_ZONES.eastern_indonesia; // Default to most expensive zone
  }

  // Same city
  if (originCityId === destinationCityId) {
    return DISTANCE_ZONES.same_city;
  }

  // Same province
  if (originCity.province === destCity.province) {
    return DISTANCE_ZONES.same_province;
  }

  // Java-Bali region
  const javaBaliProvinces = ['DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'Jawa Timur', 'DI Yogyakarta', 'Banten', 'Bali'];
  if (javaBaliProvinces.includes(originCity.province) && javaBaliProvinces.includes(destCity.province)) {
    return DISTANCE_ZONES.java_bali;
  }

  // Sumatra region
  const sumatraProvinces = ['Sumatera Utara', 'Sumatera Barat', 'Sumatera Selatan', 'Riau', 'Kepulauan Riau', 'Jambi', 'Bengkulu', 'Lampung', 'Aceh', 'Bangka Belitung'];
  if (sumatraProvinces.includes(originCity.province) && sumatraProvinces.includes(destCity.province)) {
    return DISTANCE_ZONES.sumatra;
  }

  // Kalimantan region
  const kalimantanProvinces = ['Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara'];
  if (kalimantanProvinces.includes(originCity.province) && kalimantanProvinces.includes(destCity.province)) {
    return DISTANCE_ZONES.kalimantan;
  }

  // Sulawesi region
  const sulawesiProvinces = ['Sulawesi Utara', 'Sulawesi Tengah', 'Sulawesi Selatan', 'Sulawesi Tenggara', 'Sulawesi Barat', 'Gorontalo'];
  if (sulawesiProvinces.includes(originCity.province) && sulawesiProvinces.includes(destCity.province)) {
    return DISTANCE_ZONES.sulawesi;
  }

  // Different regions - eastern indonesia (most expensive)
  return DISTANCE_ZONES.eastern_indonesia;
}

function calculateCourierCost(courier: string, weight: number, zone: number): Array<{ service: string; cost: number; etd: string }> {
  const baseCost = Math.ceil(weight / 1000) * 1000; // Round up to nearest kg
  
  switch (courier) {
    case 'jne':
      return [
        { service: 'REG', cost: baseCost * zone * 9, etd: `${zone + 1}-${zone + 3} hari` },
        { service: 'YES', cost: baseCost * zone * 15, etd: `${Math.max(1, zone - 1)}-${zone + 1} hari` },
        { service: 'OKE', cost: baseCost * zone * 7, etd: `${zone + 2}-${zone + 5} hari` }
      ];
    case 'pos':
      return [
        { service: 'Pos Reguler', cost: baseCost * zone * 7, etd: `${zone + 2}-${zone + 4} hari` },
        { service: 'Pos Express', cost: baseCost * zone * 12, etd: `${zone}-${zone + 2} hari` }
      ];
    case 'tiki':
      return [
        { service: 'REG', cost: baseCost * zone * 8, etd: `${zone + 1}-${zone + 3} hari` },
        { service: 'ONS', cost: baseCost * zone * 14, etd: `${Math.max(1, zone - 1)}-${zone + 1} hari` }
      ];
    case 'jnt':
      return [
        { service: 'EZ', cost: baseCost * zone * 6, etd: `${zone + 2}-${zone + 4} hari` },
        { service: 'REG', cost: baseCost * zone * 8, etd: `${zone + 1}-${zone + 3} hari` }
      ];
    case 'sicepat':
      return [
        { service: 'REG', cost: baseCost * zone * 8, etd: `${zone + 1}-${zone + 3} hari` },
        { service: 'BEST', cost: baseCost * zone * 12, etd: `${zone}-${zone + 2} hari` }
      ];
    case 'anteraja':
      return [
        { service: 'REG', cost: baseCost * zone * 7, etd: `${zone + 1}-${zone + 4} hari` },
        { service: 'NEXT DAY', cost: baseCost * zone * 18, etd: '1 hari' }
      ];
    case 'ninja':
      return [
        { service: 'REG', cost: baseCost * zone * 9, etd: `${zone + 1}-${zone + 3} hari` }
      ];
    case 'lion':
      return [
        { service: 'REG', cost: baseCost * zone * 10, etd: `${zone + 1}-${zone + 4} hari` },
        { service: 'CARGO', cost: baseCost * zone * 6, etd: `${zone + 3}-${zone + 7} hari` }
      ];
    default:
      return [
        { service: 'REG', cost: baseCost * zone * 10, etd: `${zone + 1}-${zone + 4} hari` }
      ];
  }
}

export async function calculateShippingCost(input: CalculateShippingInput): Promise<{ costs: Array<{ service: string; cost: number; etd: string }> }> {
  try {
    const { origin_city_id, destination_city_id, weight, courier } = input;

    // Validate input
    if (weight <= 0) {
      throw new Error('Weight must be positive');
    }

    // Check if courier is supported
    const courierExists = COURIERS.some(c => c.code === courier);
    if (!courierExists) {
      throw new Error(`Unsupported courier: ${courier}`);
    }

    // Get distance zone
    const zone = getDistanceZone(origin_city_id, destination_city_id);

    // Calculate costs for the specified courier
    const costs = calculateCourierCost(courier, weight, zone);

    return { costs };
  } catch (error) {
    console.error('Shipping cost calculation failed:', error);
    throw error;
  }
}

export async function getCities(): Promise<Array<{ city_id: number; city_name: string; province: string }>> {
  try {
    // In a real implementation, this would call RajaOngkir API
    // For now, return our mock data
    return [...CITIES];
  } catch (error) {
    console.error('Failed to fetch cities:', error);
    throw error;
  }
}

export async function getProvinces(): Promise<Array<{ province_id: number; province_name: string }>> {
  try {
    // In a real implementation, this would call RajaOngkir API
    // For now, return our mock data
    return [...PROVINCES];
  } catch (error) {
    console.error('Failed to fetch provinces:', error);
    throw error;
  }
}

export async function trackShipment(trackingNumber: string, courier: string): Promise<{ status: string; history: Array<{ date: string; description: string; location: string }> }> {
  try {
    if (!trackingNumber || !courier) {
      throw new Error('Tracking number and courier are required');
    }

    // Check if courier is supported
    const courierExists = COURIERS.some(c => c.code === courier);
    if (!courierExists) {
      throw new Error(`Unsupported courier: ${courier}`);
    }

    // Mock tracking data based on tracking number pattern
    const statuses = ['Diterima di Gudang', 'Dalam Perjalanan', 'Tiba di Kota Tujuan', 'Dalam Pengiriman', 'Terkirim'];
    const currentDate = new Date();
    
    // Generate mock status based on tracking number (for consistent results in tests)
    const statusIndex = Math.abs(trackingNumber.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % statuses.length;
    const currentStatus = statuses[statusIndex];

    // Generate mock history
    const history = [];
    for (let i = 0; i <= statusIndex; i++) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() - (statusIndex - i));
      history.push({
        date: date.toISOString().slice(0, 16).replace('T', ' '),
        description: statuses[i],
        location: i === 0 ? 'Jakarta' : i === statusIndex ? 'Kota Tujuan' : 'Dalam Perjalanan'
      });
    }

    return {
      status: currentStatus,
      history
    };
  } catch (error) {
    console.error('Shipment tracking failed:', error);
    throw error;
  }
}

export async function getCouriers(): Promise<Array<{ code: string; name: string }>> {
  try {
    // Return available couriers
    return [...COURIERS];
  } catch (error) {
    console.error('Failed to fetch couriers:', error);
    throw error;
  }
}