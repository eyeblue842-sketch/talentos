export const INDIA_RECRUITER_LOCATIONS = [
  'Ahmedabad, Gujarat',
  'Bengaluru, Karnataka',
  'Bhubaneswar, Odisha',
  'Chandigarh, Chandigarh',
  'Chennai, Tamil Nadu',
  'Coimbatore, Tamil Nadu',
  'Dehradun, Uttarakhand',
  'Delhi, Delhi',
  'Gurugram, Haryana',
  'Hyderabad, Telangana',
  'Indore, Madhya Pradesh',
  'Jaipur, Rajasthan',
  'Kochi, Kerala',
  'Kolkata, West Bengal',
  'Lucknow, Uttar Pradesh',
  'Mumbai, Maharashtra',
  'Mysuru, Karnataka',
  'Nagpur, Maharashtra',
  'Noida, Uttar Pradesh',
  'Patna, Bihar',
  'Pune, Maharashtra',
  'Surat, Gujarat',
  'Thiruvananthapuram, Kerala',
  'Vadodara, Gujarat',
  'Visakhapatnam, Andhra Pradesh',
];

export function filterIndiaLocations(query = '') {
  const normalized = String(query || '').trim().toLowerCase();
  if (!normalized) return INDIA_RECRUITER_LOCATIONS;
  return INDIA_RECRUITER_LOCATIONS.filter((location) => location.toLowerCase().includes(normalized));
}
