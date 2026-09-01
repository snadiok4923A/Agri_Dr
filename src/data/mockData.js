// ==================== FARM DATA ====================
export const farmData = {
  name: 'Green Valley Farm',
  owner: 'Rajesh Kumar',
  totalLand: 8.6,
  activeCrops: 4,
  expectedYield: 12.8,
  farmHealth: 84,
  location: 'West Bengal, India',
};

// ==================== FIELD DATA ====================
export const fields = [
  {
    id: 'field-a',
    name: 'Field A',
    crop: 'Rice',
    variety: 'IR-64',
    cropId: 'rice-a',
    area: 2.4,
    health: 87,
    status: 'healthy',
    soilMoisture: 72,
    cropAge: 48,
    growthStage: 'Tillering',
    soil: { ph: 6.7, nitrogen: 85, phosphorus: 72, potassium: 88, organicMatter: 3.2, moisture: 72 },
    irrigation: { status: 'optimal', lastIrrigated: '2 days ago', nextIrrigation: 'In 3 days' },
    coordinates: { x: 15, y: 20, width: 35, height: 30 },
  },
  {
    id: 'field-b',
    name: 'Field B',
    crop: 'Rice',
    variety: 'Swarna',
    cropId: 'rice-b',
    area: 1.8,
    health: 74,
    status: 'needs-attention',
    soilMoisture: 31,
    cropAge: 44,
    growthStage: 'Tillering',
    soil: { ph: 6.2, nitrogen: 68, phosphorus: 55, potassium: 78, organicMatter: 2.8, moisture: 31 },
    irrigation: { status: 'needs-irrigation', lastIrrigated: '5 days ago', nextIrrigation: 'Now' },
    coordinates: { x: 55, y: 15, width: 30, height: 35 },
  },
  {
    id: 'field-c',
    name: 'Field C',
    crop: 'Rice',
    variety: 'Basmati',
    cropId: 'rice-c',
    area: 2.2,
    health: 91,
    status: 'healthy',
    soilMoisture: 68,
    cropAge: 55,
    growthStage: 'Vegetative',
    soil: { ph: 6.5, nitrogen: 82, phosphorus: 67, potassium: 91, organicMatter: 3.5, moisture: 68 },
    irrigation: { status: 'optimal', lastIrrigated: '1 day ago', nextIrrigation: 'In 4 days' },
    coordinates: { x: 20, y: 55, width: 25, height: 25 },
  },
  {
    id: 'field-d',
    name: 'Field D',
    crop: 'Rice',
    variety: 'Samba Mahsuri',
    cropId: 'rice-d',
    area: 2.2,
    health: 82,
    status: 'healthy',
    soilMoisture: 65,
    cropAge: 38,
    growthStage: 'Vegetative',
    soil: { ph: 6.5, nitrogen: 79, phosphorus: 74, potassium: 85, organicMatter: 3.0, moisture: 65 },
    irrigation: { status: 'optimal', lastIrrigated: '1 day ago', nextIrrigation: 'In 2 days' },
    coordinates: { x: 55, y: 55, width: 35, height: 30 },
  },
];

// ==================== CROP DATA ====================
export const crops = [
  {
    id: 'rice-a',
    name: 'Rice',
    variety: 'IR-64',
    field: 'Field A',
    fieldId: 'field-a',
    day: 48,
    totalDays: 120,
    stage: 'Tillering',
    health: 87,
    expectedYield: 3.8,
    potentialYield: 4.3,
    timeline: [
      { stage: 'Seed', completed: true },
      { stage: 'Germination', completed: true },
      { stage: 'Vegetative', completed: true },
      { stage: 'Tillering', completed: false, current: true },
      { stage: 'Flowering', completed: false },
      { stage: 'Harvest', completed: false },
    ],
    factors: { water: 72, nutrition: 81, temperature: 88, diseaseProtection: 92, environment: 91 },
  },
  {
    id: 'rice-b',
    name: 'Rice',
    variety: 'Swarna',
    field: 'Field B',
    fieldId: 'field-b',
    day: 44,
    totalDays: 120,
    stage: 'Tillering',
    health: 74,
    expectedYield: 3.2,
    potentialYield: 4.0,
    timeline: [
      { stage: 'Seed', completed: true },
      { stage: 'Germination', completed: true },
      { stage: 'Vegetative', completed: true },
      { stage: 'Tillering', completed: false, current: true },
      { stage: 'Flowering', completed: false },
      { stage: 'Harvest', completed: false },
    ],
    factors: { water: 55, nutrition: 68, temperature: 82, diseaseProtection: 78, environment: 85 },
  },
  {
    id: 'rice-c',
    name: 'Rice',
    variety: 'Basmati',
    field: 'Field C',
    fieldId: 'field-c',
    day: 55,
    totalDays: 130,
    stage: 'Vegetative',
    health: 91,
    expectedYield: 4.1,
    potentialYield: 4.6,
    timeline: [
      { stage: 'Seed', completed: true },
      { stage: 'Germination', completed: true },
      { stage: 'Vegetative', completed: false, current: true },
      { stage: 'Tillering', completed: false },
      { stage: 'Flowering', completed: false },
      { stage: 'Harvest', completed: false },
    ],
    factors: { water: 82, nutrition: 79, temperature: 85, diseaseProtection: 94, environment: 88 },
  },
  {
    id: 'rice-d',
    name: 'Rice',
    variety: 'Samba Mahsuri',
    field: 'Field D',
    fieldId: 'field-d',
    day: 38,
    totalDays: 115,
    stage: 'Vegetative',
    health: 82,
    expectedYield: 3.5,
    potentialYield: 4.1,
    timeline: [
      { stage: 'Seed', completed: true },
      { stage: 'Germination', completed: true },
      { stage: 'Vegetative', completed: false, current: true },
      { stage: 'Tillering', completed: false },
      { stage: 'Flowering', completed: false },
      { stage: 'Harvest', completed: false },
    ],
    factors: { water: 75, nutrition: 70, temperature: 80, diseaseProtection: 85, environment: 87 },
  },
];

// ==================== WEATHER DATA ====================
export const weatherData = {
  current: {
    temperature: 29,
    feelsLike: 32,
    humidity: 78,
    rainProbability: 62,
    wind: 12,
    condition: 'Partly Cloudy',
    icon: 'cloud-sun',
  },
  farmImpact: {
    message: 'Rain is expected tonight. Irrigation may not be necessary today.',
    irrigationNeeded: false,
    alert: 'Moderate rain expected between 6 PM - 11 PM',
    sprayAdvisory: 'Avoid spraying for next 24 hours',
  },
  forecast: [
    { day: 'Today', high: 31, low: 24, rain: 62, icon: 'cloud-rain', humidity: 78 },
    { day: 'Tomorrow', high: 30, low: 23, rain: 45, icon: 'cloud', humidity: 72 },
    { day: 'Wed', high: 32, low: 25, rain: 20, icon: 'sun', humidity: 65 },
    { day: 'Thu', high: 33, low: 26, rain: 15, icon: 'sun', humidity: 60 },
    { day: 'Fri', high: 31, low: 24, rain: 40, icon: 'cloud-sun', humidity: 68 },
    { day: 'Sat', high: 29, low: 23, rain: 70, icon: 'cloud-rain', humidity: 80 },
    { day: 'Sun', high: 28, low: 22, rain: 55, icon: 'cloud-rain', humidity: 75 },
  ],
  rainfallTrend: [
    { week: 'W1', rainfall: 25 },
    { week: 'W2', rainfall: 18 },
    { week: 'W3', rainfall: 42 },
    { week: 'W4', rainfall: 35 },
  ],
};

// ==================== SOIL DATA ====================
export const soilData = {
  overall: { ph: 6.7, status: 'Good', issue: 'Phosphorus slightly low' },
  fields: {
    'field-a': { ph: 6.7, nitrogen: 85, phosphorus: 72, potassium: 88, organicMatter: 3.2, moisture: 72 },
    'field-b': { ph: 6.2, nitrogen: 68, phosphorus: 55, potassium: 78, organicMatter: 2.8, moisture: 31 },
    'field-c': { ph: 6.5, nitrogen: 82, phosphorus: 67, potassium: 91, organicMatter: 3.5, moisture: 68 },
    'field-d': { ph: 6.5, nitrogen: 79, phosphorus: 74, potassium: 85, organicMatter: 3.0, moisture: 65 },
  },
};

// ==================== IRRIGATION DATA ====================
export const irrigationData = {
  fields: [
    { fieldId: 'field-a', name: 'Field A', moisture: 72, status: 'optimal' },
    { fieldId: 'field-b', name: 'Field B', moisture: 31, status: 'needs-irrigation' },
    { fieldId: 'field-c', name: 'Field C', moisture: 68, status: 'optimal' },
    { fieldId: 'field-d', name: 'Field D', moisture: 65, status: 'optimal' },
  ],
  weeklyUsage: [
    { day: 'Mon', liters: 180 },
    { day: 'Tue', liters: 160 },
    { day: 'Wed', liters: 200 },
    { day: 'Thu', liters: 150 },
    { day: 'Fri', liters: 190 },
    { day: 'Sat', liters: 180 },
    { day: 'Sun', liters: 180 },
  ],
  thisWeek: 1240,
  lastWeek: 1512,
  change: -18,
};

// ==================== DISEASE DATA ====================
export const diseaseData = [
  {
    id: 1,
    name: 'Leaf Blast',
    field: 'Field B',
    fieldId: 'field-b',
    crop: 'Rice',
    severity: 'moderate',
    risk: 65,
    confidence: 91,
    symptoms: 'Diamond-shaped lesions on leaves, gray centers with brown borders',
    cause: 'Magnaporthe oryzae fungus, thrives in warm humid conditions',
    recommendedAction: 'Apply Tricyclazole 75% WP @ 0.6g/L. Remove infected leaves.',
    prevention: 'Maintain proper spacing, avoid excess nitrogen, use resistant varieties',
    detected: '2 days ago',
  },
  {
    id: 2,
    name: 'Brown Plant Hopper',
    field: 'Field A',
    fieldId: 'field-a',
    crop: 'Rice',
    severity: 'low',
    risk: 25,
    confidence: 84,
    symptoms: 'Yellowing of tillers, honeydew on stems, hopping insects visible',
    cause: 'Nilaparvata lugens, common in warm wet conditions',
    recommendedAction: 'Monitor closely. Apply Imidacloprid 17.8 SL @ 0.3 ml/L if population increases.',
    prevention: 'Maintain field hygiene, avoid excessive nitrogen, encourage natural predators',
    detected: '5 days ago',
  },
];

// ==================== FERTILIZER DATA ====================
export const fertilizerData = {
  nextApplications: [
    { field: 'Field A', crop: 'IR-64', product: 'Urea', amount: '40 kg', due: 'Tomorrow', priority: 'high' },
    { field: 'Field B', crop: 'Swarna', product: 'DAP', amount: '25 kg', due: 'In 3 days', priority: 'high' },
    { field: 'Field C', crop: 'Basmati', product: 'Potash', amount: '20 kg', due: 'In 5 days', priority: 'medium' },
  ],
  history: [
    { date: 'Aug 12', product: 'Urea', amount: '40 kg', field: 'Field A', status: 'completed' },
    { date: 'Aug 15', product: 'DAP', amount: '25 kg', field: 'Field C', status: 'completed' },
    { date: 'Aug 20', product: 'Urea', amount: '35 kg', field: 'Field B', status: 'completed' },
    { date: 'Aug 25', product: 'MOP', amount: '15 kg', field: 'Field D', status: 'completed' },
    { date: 'Sep 04', product: 'Potash', amount: '20 kg', field: 'Field C', status: 'upcoming' },
  ],
};

// ==================== FINANCE DATA ====================
export const financeData = {
  expenses: {
    total: 48250,
    breakdown: [
      { category: 'Seeds', amount: 4500, color: '#79C98A' },
      { category: 'Fertilizer', amount: 12800, color: '#4F8F62' },
      { category: 'Pesticides', amount: 6200, color: '#E8A94E' },
      { category: 'Labor', amount: 14000, color: '#6BB8E8' },
      { category: 'Irrigation', amount: 5750, color: '#8B6BB8' },
      { category: 'Other', amount: 5000, color: '#A8B0AA' },
    ],
  },
  revenue: {
    expected: 142000,
    estimatedProfit: 93750,
  },
  monthlyExpenses: [
    { month: 'Apr', amount: 8500 },
    { month: 'May', amount: 12200 },
    { month: 'Jun', amount: 9800 },
    { month: 'Jul', amount: 7500 },
    { month: 'Aug', amount: 6250 },
    { month: 'Sep', amount: 4000 },
  ],
};

// ==================== MARKET DATA ====================
export const marketData = {
  crops: [
    {
      name: 'IR-64',
      price: 3420,
      unit: 'Quintal',
      change: 4.2,
      trend: 'up',
      markets: [
        { name: 'Local Mandi', price: 3420 },
        { name: 'State Market', price: 3380 },
        { name: 'Regional APMC', price: 3510 },
      ],
      priceHistory: [
        { month: 'Apr', price: 3100 },
        { month: 'May', price: 3150 },
        { month: 'Jun', price: 3200 },
        { month: 'Jul', price: 3280 },
        { month: 'Aug', price: 3350 },
        { month: 'Sep', price: 3420 },
      ],
    },
    {
      name: 'Swarna',
      price: 3280,
      unit: 'Quintal',
      change: 3.8,
      trend: 'up',
      markets: [
        { name: 'Local Mandi', price: 3280 },
        { name: 'State Market', price: 3250 },
        { name: 'Regional APMC', price: 3340 },
      ],
      priceHistory: [
        { month: 'Apr', price: 2980 },
        { month: 'May', price: 3020 },
        { month: 'Jun', price: 3080 },
        { month: 'Jul', price: 3150 },
        { month: 'Aug', price: 3220 },
        { month: 'Sep', price: 3280 },
      ],
    },
    {
      name: 'Basmati',
      price: 5200,
      unit: 'Quintal',
      change: 5.1,
      trend: 'up',
      markets: [
        { name: 'Local Mandi', price: 5200 },
        { name: 'State Market', price: 5100 },
        { name: 'Regional APMC', price: 5350 },
      ],
      priceHistory: [
        { month: 'Apr', price: 4600 },
        { month: 'May', price: 4720 },
        { month: 'Jun', price: 4850 },
        { month: 'Jul', price: 4980 },
        { month: 'Aug', price: 5100 },
        { month: 'Sep', price: 5200 },
      ],
    },
  ],
};

// ==================== ANALYTICS DATA ====================
export const analyticsData = {
  metrics: [
    { label: 'Crop Health', value: 87, change: 12, trend: 'up' },
    { label: 'Water Usage', value: 1240, unit: 'L', change: -18, trend: 'down' },
    { label: 'Fertilizer Cost', value: 12800, unit: '₹', change: -7, trend: 'down' },
    { label: 'Yield', value: 12.8, unit: 'Ton', change: 14, trend: 'up' },
    { label: 'Profit', value: 93750, unit: '₹', change: 21, trend: 'up' },
  ],
  healthTrend: [
    { day: '1', health: 78 },
    { day: '2', health: 79 },
    { day: '3', health: 81 },
    { day: '4', health: 80 },
    { day: '5', health: 82 },
    { day: '6', health: 84 },
    { day: '7', health: 87 },
  ],
  yieldTrend: [
    { month: 'Apr', actual: 2.8, potential: 3.2 },
    { month: 'May', actual: 3.0, potential: 3.5 },
    { month: 'Jun', actual: 3.2, potential: 3.8 },
    { month: 'Jul', actual: 3.4, potential: 4.0 },
    { month: 'Aug', actual: 3.6, potential: 4.2 },
    { month: 'Sep', actual: 3.8, potential: 4.3 },
  ],
  waterTrend: [
    { week: 'W1', usage: 1580, optimal: 1400 },
    { week: 'W2', usage: 1450, optimal: 1400 },
    { week: 'W3', usage: 1320, optimal: 1400 },
    { week: 'W4', usage: 1240, optimal: 1400 },
  ],
};

// ==================== RECOMMENDATIONS ====================
export const recommendations = [
  {
    id: 1,
    category: 'critical',
    title: 'Irrigation Required',
    description: 'Soil moisture in Field B is below optimal level (31%). Immediate irrigation recommended.',
    impact: 'high',
    benefit: 'Prevents yield loss of up to 0.3 Ton',
    field: 'Field B',
    priority: 1,
    icon: 'droplets',
  },
  {
    id: 2,
    category: 'critical',
    title: 'Disease Alert — Leaf Blast',
    description: 'Leaf Blast detected in Field B with moderate severity. Take preventive action.',
    impact: 'high',
    benefit: 'Prevents potential 15% yield loss',
    field: 'Field B',
    priority: 1,
    icon: 'bug',
  },
  {
    id: 3,
    category: 'important',
    title: 'Nutrient Imbalance',
    description: 'Phosphorus levels are below optimal in Field B. Consider phosphorus supplementation.',
    impact: 'medium',
    benefit: 'Improves root development and tillering',
    field: 'Field B',
    priority: 2,
    icon: 'flask-conical',
  },
  {
    id: 4,
    category: 'recommended',
    title: 'Crop Leaf Inspection',
    description: 'Schedule leaf inspection for Field A to monitor Brown Plant Hopper activity.',
    impact: 'medium',
    benefit: 'Early detection prevents crop damage',
    field: 'Field A',
    priority: 3,
    icon: 'search',
  },
  {
    id: 5,
    category: 'optimization',
    title: 'Improve Growth Conditions',
    description: 'Consider optimizing nitrogen levels in Field D (Samba Mahsuri) for better tillering.',
    impact: 'low',
    benefit: 'Potential 0.2 Ton yield improvement',
    field: 'Field D',
    priority: 4,
    icon: 'trending-up',
  },
];

// ==================== ACTIVITY DATA ====================
export const activityData = [
  { id: 1, action: 'Irrigation completed', field: 'Field A', time: '2 hours ago', icon: 'droplets', type: 'irrigation' },
  { id: 2, action: 'Fertilizer applied', field: 'Field C', time: 'Yesterday', icon: 'flask-conical', type: 'fertilizer' },
  { id: 3, action: 'Crop scan completed', field: 'All Fields', time: '2 days ago', icon: 'scan', type: 'scan' },
  { id: 4, action: 'Health alert — Leaf Blast', field: 'Field B', time: '3 days ago', icon: 'alert-triangle', type: 'alert' },
  { id: 5, action: 'Soil test completed', field: 'Field D', time: '4 days ago', icon: 'test-tubes', type: 'soil' },
  { id: 6, action: 'Pest monitoring', field: 'Field A', time: '5 days ago', icon: 'bug', type: 'pest' },
];

// ==================== CALENDAR DATA ====================
export const calendarData = [
  { date: 'Sep 02', task: 'Irrigation', field: 'Field B', status: 'upcoming', type: 'irrigation' },
  { date: 'Sep 03', task: 'Fertilizer (Urea)', field: 'Field A', status: 'upcoming', type: 'fertilizer' },
  { date: 'Sep 05', task: 'Disease Check', field: 'Field B', status: 'upcoming', type: 'disease' },
  { date: 'Sep 07', task: 'Irrigation', field: 'Field D', status: 'upcoming', type: 'irrigation' },
  { date: 'Sep 10', task: 'Fertilizer (DAP)', field: 'Field B', status: 'upcoming', type: 'fertilizer' },
  { date: 'Sep 12', task: 'Pest Spray', field: 'Field A', status: 'upcoming', type: 'spray' },
  { date: 'Sep 15', task: 'Soil Test', field: 'Field C', status: 'upcoming', type: 'soil' },
  { date: 'Sep 20', task: 'Fertilizer (Potash)', field: 'Field C', status: 'upcoming', type: 'fertilizer' },
  { date: 'Oct 15', task: 'Harvest', field: 'Field A', status: 'upcoming', type: 'harvest' },
];

// ==================== MOCK SERVICE FUNCTIONS ====================
// These replace mock data with real API calls later

export const getCropHealth = () => {
  return new Promise(resolve => setTimeout(() => resolve({ score: 87, status: 'healthy' }), 300));
};

export const getYieldPrediction = (fieldId) => {
  const crop = crops.find(c => c.fieldId === fieldId);
  return new Promise(resolve => setTimeout(() => resolve({
    current: crop?.expectedYield || 3.8,
    potential: crop?.potentialYield || 4.3,
    gap: (crop?.potentialYield || 4.3) - (crop?.expectedYield || 3.8),
  }), 300));
};

export const getRecommendations = () => {
  return new Promise(resolve => setTimeout(() => resolve(recommendations), 300));
};

export const analyzeCropImage = (imageData) => {
  return new Promise(resolve => setTimeout(() => resolve({
    problem: 'Leaf Blast',
    confidence: 91,
    severity: 'Moderate',
    actions: [
      'Inspect nearby plants',
      'Maintain proper field management',
      'Follow recommended treatment',
      'Recheck after 3 days',
    ],
  }), 1500));
};

export const askAgricultureAI = (question, fieldContext) => {
  return new Promise(resolve => setTimeout(() => {
    const responses = {
      default: {
        answer: 'Based on current field conditions, I recommend checking soil moisture levels and monitoring crop health indicators.',
        confidence: 85,
      },
      soil: {
        answer: 'Current soil pH is within optimal range (6.2-6.7). Phosphorus levels in Field B need attention.',
        confidence: 88,
      },
      weather: {
        answer: 'Rain expected tonight. Consider postponing scheduled irrigation. Wind speeds are within safe range for outdoor activities.',
        confidence: 92,
      },
    };
    resolve(responses[fieldContext] || responses.default);
  }, 1000));
};

export const getWeatherData = () => {
  return new Promise(resolve => setTimeout(() => resolve(weatherData), 300));
};

export const getSoilData = () => {
  return new Promise(resolve => setTimeout(() => resolve(soilData), 300));
};

export const getIrrigationStatus = () => {
  return new Promise(resolve => setTimeout(() => resolve(irrigationData), 300));
};
