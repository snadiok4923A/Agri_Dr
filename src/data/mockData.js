// ==================== FARM DATA ====================
export const farmData = {
    name: "Green Valley Rice Farm",
    owner: "Rajesh Kumar",
    totalLand: 8.6,
    activeCrops: 4,
    expectedYield: 16.1,
    potentialYield: 18.4,
    estimatedProduction: 16.1,
    currentProductionEstimate: 12.2,
    estimatedRevenue: 625680,
    estimatedCost: 136000,
    expectedProfit: 489680,
    profitMargin: 78.3,
    location: "Burdwan, West Bengal, India",
};

// ==================== FIELD DATA ====================
export const fields = [
    {
        id: "field-a",
        name: "Field A",
        crop: "Rice",
        variety: "IR-64",
        cropId: "rice-a",
        area: 2.4,
        expectedYield: 4.8,
        potentialYield: 5.4,
        expectedRevenue: 164160,
        estimatedCost: 35000,
        expectedProfit: 129160,
        profitMargin: 78.7,
        status: "optimal",
        cropAge: 48,
        growthStage: "Tillering",
        medicineRequirement: {
            medicine: "Imidacloprid 17.8 SL",
            purpose: "Brown Plant Hopper prevention",
            quantity: "120 ml",
            cost: 850,
            urgency: "medium",
        },
        fertilizerRequirement: {
            fertilizer: "Urea (Top-dressing)",
            quantity: "40 kg",
            cost: 320,
            due: "Tomorrow",
            expectedBenefit: "+0.25 Ton yield",
        },
        soil: {
            ph: 6.7,
            nitrogen: 85,
            phosphorus: 72,
            potassium: 88,
            organicMatter: 3.2,
        },
        waterSchedule: {
            status: "optimal",
            stageDepth: "2-3 cm shallow water",
            nextIrrigation: "In 3 days (after rain)",
        },
        coordinates: { x: 15, y: 20, width: 35, height: 30 },
    },
    {
        id: "field-b",
        name: "Field B",
        crop: "Rice",
        variety: "Swarna",
        cropId: "rice-b",
        area: 1.8,
        expectedYield: 3.4,
        potentialYield: 4.2,
        expectedRevenue: 111520,
        estimatedCost: 28000,
        expectedProfit: 83520,
        profitMargin: 74.9,
        status: "needs-attention",
        cropAge: 44,
        growthStage: "Tillering",
        medicineRequirement: {
            medicine: "Tricyclazole 75% WP",
            purpose: "Leaf Blast treatment",
            quantity: "250 g",
            cost: 1200,
            urgency: "high",
        },
        fertilizerRequirement: {
            fertilizer: "DAP (Nutrient boost)",
            quantity: "25 kg",
            cost: 675,
            due: "In 3 days",
            expectedBenefit: "+0.30 Ton yield",
        },
        soil: {
            ph: 6.2,
            nitrogen: 68,
            phosphorus: 55,
            potassium: 78,
            organicMatter: 2.8,
        },
        waterSchedule: {
            status: "needs-attention",
            stageDepth: "2 cm standing water",
            nextIrrigation: "Tomorrow post-rain",
        },
        coordinates: { x: 55, y: 15, width: 30, height: 35 },
    },
    {
        id: "field-c",
        name: "Field C",
        crop: "Rice",
        variety: "Basmati",
        cropId: "rice-c",
        area: 2.2,
        expectedYield: 4.1,
        potentialYield: 4.6,
        expectedRevenue: 213200,
        estimatedCost: 42000,
        expectedProfit: 171200,
        profitMargin: 80.3,
        status: "optimal",
        cropAge: 55,
        growthStage: "Vegetative",
        medicineRequirement: {
            medicine: "Hexaconazole 5% SC",
            purpose: "Sheath Blight protective",
            quantity: "500 ml",
            cost: 650,
            urgency: "low",
        },
        fertilizerRequirement: {
            fertilizer: "MOP / Potash",
            quantity: "20 kg",
            cost: 480,
            due: "In 5 days",
            expectedBenefit: "+0.20 Ton yield",
        },
        soil: {
            ph: 6.5,
            nitrogen: 82,
            phosphorus: 67,
            potassium: 91,
            organicMatter: 3.5,
        },
        waterSchedule: {
            status: "optimal",
            stageDepth: "Saturated to 2 cm",
            nextIrrigation: "In 4 days",
        },
        coordinates: { x: 20, y: 55, width: 25, height: 25 },
    },
    {
        id: "field-d",
        name: "Field D",
        crop: "Rice",
        variety: "Samba Mahsuri",
        cropId: "rice-d",
        area: 2.2,
        expectedYield: 3.8,
        potentialYield: 4.2,
        expectedRevenue: 136800,
        estimatedCost: 31000,
        expectedProfit: 105800,
        profitMargin: 77.3,
        status: "optimal",
        cropAge: 38,
        growthStage: "Vegetative",
        medicineRequirement: {
            medicine: "Copper Oxychloride",
            purpose: "Bacterial Blight protective",
            quantity: "500 g",
            cost: 550,
            urgency: "low",
        },
        fertilizerRequirement: {
            fertilizer: "Zinc Sulfate + Urea",
            quantity: "20 kg",
            cost: 450,
            due: "In 7 days",
            expectedBenefit: "+0.15 Ton yield",
        },
        soil: {
            ph: 6.5,
            nitrogen: 79,
            phosphorus: 74,
            potassium: 85,
            organicMatter: 3.0,
        },
        waterSchedule: {
            status: "optimal",
            stageDepth: "Saturated soil",
            nextIrrigation: "In 2 days",
        },
        coordinates: { x: 55, y: 55, width: 35, height: 30 },
    },
];

// ==================== CROP DATA (RICE VARIETIES) ====================
export const crops = [
    {
        id: "rice-a",
        name: "Rice",
        variety: "IR-64",
        field: "Field A",
        fieldId: "field-a",
        area: 2.4,
        day: 48,
        totalDays: 120,
        stage: "Tillering",
        expectedYield: 4.8,
        potentialYield: 5.4,
        estimatedCost: 35000,
        expectedRevenue: 164160,
        expectedProfit: 129160,
        profitMargin: 78.7,
        marketPrice: 3420,
        medicine: "Imidacloprid 17.8 SL (120 ml)",
        medicineCost: 850,
        fertilizer: "Urea top-dressing (40 kg)",
        fertilizerCost: 320,
        timeline: [
            { stage: "Seed", completed: true },
            { stage: "Germination", completed: true },
            { stage: "Vegetative", completed: true },
            { stage: "Tillering", completed: false, current: true },
            { stage: "Flowering", completed: false },
            { stage: "Harvest", completed: false },
        ],
    },
    {
        id: "rice-b",
        name: "Rice",
        variety: "Swarna",
        field: "Field B",
        fieldId: "field-b",
        area: 1.8,
        day: 44,
        totalDays: 120,
        stage: "Tillering",
        expectedYield: 3.4,
        potentialYield: 4.2,
        estimatedCost: 28000,
        expectedRevenue: 111520,
        expectedProfit: 83520,
        profitMargin: 74.9,
        marketPrice: 3280,
        medicine: "Tricyclazole 75% WP (250 g)",
        medicineCost: 1200,
        fertilizer: "DAP (25 kg)",
        fertilizerCost: 675,
        timeline: [
            { stage: "Seed", completed: true },
            { stage: "Germination", completed: true },
            { stage: "Vegetative", completed: true },
            { stage: "Tillering", completed: false, current: true },
            { stage: "Flowering", completed: false },
            { stage: "Harvest", completed: false },
        ],
    },
    {
        id: "rice-c",
        name: "Rice",
        variety: "Basmati",
        field: "Field C",
        fieldId: "field-c",
        area: 2.2,
        day: 55,
        totalDays: 130,
        stage: "Vegetative",
        expectedYield: 4.1,
        potentialYield: 4.6,
        estimatedCost: 42000,
        expectedRevenue: 213200,
        expectedProfit: 171200,
        profitMargin: 80.3,
        marketPrice: 5200,
        medicine: "Hexaconazole 5% SC (500 ml)",
        medicineCost: 650,
        fertilizer: "MOP / Potash (20 kg)",
        fertilizerCost: 480,
        timeline: [
            { stage: "Seed", completed: true },
            { stage: "Germination", completed: true },
            { stage: "Vegetative", completed: false, current: true },
            { stage: "Tillering", completed: false },
            { stage: "Flowering", completed: false },
            { stage: "Harvest", completed: false },
        ],
    },
    {
        id: "rice-d",
        name: "Rice",
        variety: "Samba Mahsuri",
        field: "Field D",
        fieldId: "field-d",
        area: 2.2,
        day: 38,
        totalDays: 115,
        stage: "Vegetative",
        expectedYield: 3.8,
        potentialYield: 4.2,
        estimatedCost: 31000,
        expectedRevenue: 136800,
        expectedProfit: 105800,
        profitMargin: 77.3,
        marketPrice: 3600,
        medicine: "Copper Oxychloride (500 g)",
        medicineCost: 550,
        fertilizer: "Zinc Sulfate + Urea (20 kg)",
        fertilizerCost: 450,
        timeline: [
            { stage: "Seed", completed: true },
            { stage: "Germination", completed: true },
            { stage: "Vegetative", completed: false, current: true },
            { stage: "Tillering", completed: false },
            { stage: "Flowering", completed: false },
            { stage: "Harvest", completed: false },
        ],
    },
];

// ==================== WEATHER DATA (AGRONOMIC RECOMMENDATIONS) ====================
export const weatherData = {
    current: {
        temperature: 29,
        feelsLike: 32,
        humidity: 78,
        rainProbability: 62,
        wind: 12,
        condition: "Partly Cloudy",
        icon: "cloud-sun",
    },
    farmImpact: {
        message:
            "Rain expected tonight (62%). Postpone scheduled irrigation to save pumping electricity.",
        irrigationNeeded: false,
        alert: "Moderate rain expected between 6 PM - 11 PM",
        sprayAdvisory:
            "Avoid foliar medicine spraying for next 24 hours to prevent rain wash-off.",
        diseaseAdvisory:
            "High humidity (>75%) favors fungal blast development. Inspect Field B tomorrow.",
    },
    forecast: [
        {
            day: "Today",
            high: 31,
            low: 24,
            rain: 62,
            icon: "cloud-rain",
            humidity: 78,
        },
        {
            day: "Tomorrow",
            high: 30,
            low: 23,
            rain: 45,
            icon: "cloud",
            humidity: 72,
        },
        { day: "Wed", high: 32, low: 25, rain: 20, icon: "sun", humidity: 65 },
        { day: "Thu", high: 33, low: 26, rain: 15, icon: "sun", humidity: 60 },
        {
            day: "Fri",
            high: 31,
            low: 24,
            rain: 40,
            icon: "cloud-sun",
            humidity: 68,
        },
        {
            day: "Sat",
            high: 29,
            low: 23,
            rain: 70,
            icon: "cloud-rain",
            humidity: 80,
        },
        {
            day: "Sun",
            high: 28,
            low: 22,
            rain: 55,
            icon: "cloud-rain",
            humidity: 75,
        },
    ],
    rainfallTrend: [
        { week: "W1", rainfall: 25 },
        { week: "W2", rainfall: 18 },
        { week: "W3", rainfall: 42 },
        { week: "W4", rainfall: 35 },
    ],
};

// ==================== SOIL TESTING DATA (LAB REPORTS) ====================
export const soilData = {
    lastLabTestDate: "12 May 2024",
    testingAgency: "ICAR State Agricultural University Soil Testing Lab",
    overall: {
        ph: 6.7,
        status: "Optimal for Rice Paddy (Slightly Acidic)",
        issue: "Slight Phosphorus fixation in Field B; requires SSP/DAP top-dressing",
        organicCarbon: "0.68% (Medium)",
        cationExchangeCapacity: "18.4 meq/100g",
        yieldImpact:
            "Optimal pH and Potassium availability support high grain filling (up to 4.5 T/ac).",
    },
    nutrients: [
        {
            name: "Available Nitrogen (N)",
            value: "245 kg/ha",
            status: "Medium",
            rating: 68,
            recommendation: "Apply split dose Urea @ 40 kg/ac at panicle stage",
        },
        {
            name: "Available Phosphorus (P)",
            value: "14.2 kg/ha",
            status: "Low-Medium",
            rating: 52,
            recommendation: "Apply DAP @ 25 kg/ac to prevent tillering delay",
        },
        {
            name: "Available Potassium (K)",
            value: "280 kg/ha",
            status: "High",
            rating: 88,
            recommendation: "MOP basal application adequate; maintain schedule",
        },
        {
            name: "Organic Carbon (OC)",
            value: "0.68%",
            status: "Medium",
            rating: 65,
            recommendation:
                "Incorporate crop residue post harvest to boost carbon",
        },
        {
            name: "Zinc (Zn)",
            value: "0.78 ppm",
            status: "Adequate",
            rating: 75,
            recommendation: "Zinc Sulphate 21% spray in nursery completed",
        },
    ],
    fields: {
        "field-a": {
            variety: "IR-64",
            ph: 6.8,
            nitrogen: "255 kg/ha",
            phosphorus: "16 kg/ha",
            potassium: "290 kg/ha",
            organicMatter: "0.72%",
            yieldPotential: "4.8 Ton",
        },
        "field-b": {
            variety: "Swarna",
            ph: 6.4,
            nitrogen: "230 kg/ha",
            phosphorus: "12 kg/ha",
            potassium: "265 kg/ha",
            organicMatter: "0.62%",
            yieldPotential: "3.4 Ton",
        },
        "field-c": {
            variety: "Basmati",
            ph: 7.1,
            nitrogen: "260 kg/ha",
            phosphorus: "18 kg/ha",
            potassium: "310 kg/ha",
            organicMatter: "0.75%",
            yieldPotential: "4.1 Ton",
        },
        "field-d": {
            variety: "Samba Mahsuri",
            ph: 6.6,
            nitrogen: "240 kg/ha",
            phosphorus: "14 kg/ha",
            potassium: "275 kg/ha",
            organicMatter: "0.65%",
            yieldPotential: "3.8 Ton",
        },
    },
};

// ==================== IRRIGATION & WATER SCHEDULE (AGRONOMIC) ====================
export const irrigationData = {
    thisWeekHours: 24,
    pumpingCostThisWeek: 1770,
    costSavings: 420,
    weatherAdvisory:
        "Rain forecasted for Tuesday afternoon (18mm). Skip scheduled irrigation on Fields A & B to save ~₹540 in electricity cost.",
    fields: [
        {
            fieldId: "f1",
            name: "Field A",
            variety: "IR-64",
            stage: "Tillering",
            waterCondition: "Shallow Standing Water (2-3 cm)",
            recommendation:
                "Maintain shallow submergence. Skip Tuesday due to rain.",
            pumpingHoursRequired: 6,
            estimatedPumpingCost: 450,
            status: "optimal",
        },
        {
            fieldId: "f2",
            name: "Field B",
            variety: "Swarna",
            stage: "Vegetative",
            waterCondition: "Saturated Soil",
            recommendation: "Drain excess water if rainfall exceeds 25mm.",
            pumpingHoursRequired: 4,
            estimatedPumpingCost: 300,
            status: "needs-attention",
        },
        {
            fieldId: "f3",
            name: "Field C",
            variety: "Basmati",
            stage: "Panicle Initiation",
            waterCondition: "Continuous 4 cm standing water",
            recommendation:
                "Critical reproductive stage. Maintain steady water layer.",
            pumpingHoursRequired: 8,
            estimatedPumpingCost: 600,
            status: "optimal",
        },
        {
            fieldId: "f4",
            name: "Field D",
            variety: "Samba Mahsuri",
            stage: "Tillering",
            waterCondition: "Shallow Standing Water (2-3 cm)",
            recommendation:
                "Keep water layer shallow to stimulate tiller formation.",
            pumpingHoursRequired: 6,
            estimatedPumpingCost: 420,
            status: "optimal",
        },
    ],
    weeklyPumpingHours: [
        { day: "Mon", hours: 5, cost: 375 },
        { day: "Tue", hours: 0, cost: 0 },
        { day: "Wed", hours: 4, cost: 300 },
        { day: "Thu", hours: 6, cost: 450 },
        { day: "Fri", hours: 3, cost: 225 },
        { day: "Sat", hours: 4, cost: 300 },
        { day: "Sun", hours: 2, cost: 150 },
    ],
    stageRequirements: [
        {
            stage: "Seedling / Nursery",
            depth: "Saturated soil",
            note: "Avoid submergence",
        },
        {
            stage: "Tillering",
            depth: "2 - 3 cm shallow water",
            note: "Promotes root branching and tillers",
        },
        {
            stage: "Panicle Initiation to Flowering",
            depth: "4 - 5 cm standing water",
            note: "Most critical stage; never allow drought",
        },
        {
            stage: "Ripening / Grain Filling",
            depth: "Saturated to moist",
            note: "Drain field 10 days before harvest",
        },
    ],
};

// ==================== DISEASE & MEDICINE DATA ====================
export const diseaseData = [
    {
        id: 1,
        name: "Leaf Blast (Magnaporthe oryzae)",
        field: "Field B",
        fieldId: "field-b",
        variety: "Swarna",
        severity: "critical",
        risk: 65,
        confidence: 91,
        symptoms:
            "Diamond-shaped spindle lesions on leaves, grayish-white centers with dark brown margins",
        cause: "Magnaporthe oryzae fungus, promoted by warm humid weather and high nitrogen",
        medicine: "Tricyclazole 75% WP (Baan / Beam)",
        dosage: "0.6 g / L (approx. 250 g for 1.8 ac)",
        treatmentCost: "₹1,200",
        productionImpact:
            "Yield loss risk: -15% (~0.5 Ton / ₹16,700 loss) if untreated",
        recommendedAction:
            "Apply Tricyclazole 75% WP @ 0.6g/L immediately. Pause nitrogen top-dressing.",
        prevention:
            "Maintain balanced N-P-K, avoid water stress during tillering, apply preventive fungicide before panicle emergence.",
        detected: "2 days ago",
    },
    {
        id: 2,
        name: "Brown Plant Hopper (BPH)",
        field: "Field A",
        fieldId: "field-a",
        variety: "IR-64",
        severity: "moderate",
        risk: 28,
        confidence: 86,
        symptoms:
            "Yellowing tillers at base, early signs of hopperburn at dense spots",
        cause: "Nilaparvata lugens multiplying in microclimate of close planting",
        medicine: "Imidacloprid 17.8 SL (Confidor)",
        dosage: "0.3 ml / L (120 ml for 2.4 ac)",
        treatmentCost: "₹850",
        productionImpact:
            "Yield loss risk: -5% (~0.24 Ton / ₹8,200 loss) if population expands",
        recommendedAction:
            "Apply Imidacloprid 17.8 SL directed to plant base. Create alleyways for aeration.",
        prevention:
            "Alternate wetting and drying (AWD), encourage spider predators, avoid synthetic pyrethroids.",
        detected: "4 days ago",
    },
    {
        id: 3,
        name: "Sheath Blight Preventive",
        field: "Field C",
        fieldId: "field-c",
        variety: "Basmati",
        severity: "low",
        risk: 18,
        confidence: 82,
        symptoms:
            "Snake-skin like irregular greenish-grey spots on leaf sheaths near water line",
        cause: "Rhizoctonia solani soil-borne sclerotia in dense canopy",
        medicine: "Hexaconazole 5% SC (Contaf Plus)",
        dosage: "2.0 ml / L (500 ml for 2.2 ac)",
        treatmentCost: "₹650",
        productionImpact:
            "Yield loss risk: -8% Basmati premium yield loss if unchecked",
        recommendedAction:
            "Prophylactic spray of Hexaconazole 5% SC during early tillering.",
        prevention: "Clean bund sanitation, avoid excessive seedling density.",
        detected: "6 days ago",
    },
];

// ==================== FERTILIZER & NUTRITION DATA ====================
export const fertilizerData = {
    nextApplications: [
        {
            field: "Field A",
            crop: "Rice",
            variety: "IR-64",
            product: "Urea (46% N) Top Dressing",
            amount: "40 kg / acre",
            cost: "₹1,120",
            expectedYieldBenefit: "+0.25 Ton / acre (~₹8,550 profit gain)",
            stage: "Tillering",
            due: "Tomorrow",
            priority: "high",
        },
        {
            field: "Field B",
            crop: "Rice",
            variety: "Swarna",
            product: "DAP (Diammonium Phosphate) + MOP",
            amount: "25 kg / acre DAP + 15 kg MOP",
            cost: "₹1,650",
            expectedYieldBenefit: "+0.30 Ton / acre (~₹9,840 profit gain)",
            stage: "Vegetative",
            due: "In 4 days",
            priority: "high",
        },
        {
            field: "Field C",
            crop: "Rice",
            variety: "Basmati",
            product: "NPK 19:19:19 Foliar Spray",
            amount: "1.5 kg / acre",
            cost: "₹480",
            expectedYieldBenefit: "+0.20 Ton / acre (~₹10,400 profit gain)",
            stage: "Panicle Initiation",
            due: "In 8 days",
            priority: "medium",
        },
    ],
    history: [
        {
            date: "Aug 12",
            product: "Urea (Basal)",
            amount: "40 kg",
            field: "Field A",
            variety: "IR-64",
            cost: "₹320",
            status: "completed",
            benefit: "+0.25 Ton baseline established",
        },
        {
            date: "Aug 15",
            product: "DAP (Basal)",
            amount: "25 kg",
            field: "Field C",
            variety: "Basmati",
            cost: "₹675",
            status: "completed",
            benefit: "+0.30 Ton root establishment",
        },
        {
            date: "Aug 20",
            product: "Urea (1st Top)",
            amount: "35 kg",
            field: "Field B",
            variety: "Swarna",
            cost: "₹280",
            status: "completed",
            benefit: "+0.20 Ton vegetative vigorous tillering",
        },
        {
            date: "Aug 25",
            product: "MOP Potash",
            amount: "15 kg",
            field: "Field D",
            variety: "Samba Mahsuri",
            cost: "₹360",
            status: "completed",
            benefit: "+0.15 Ton stem strength",
        },
        {
            date: "Sep 04",
            product: "Potash Boost",
            amount: "20 kg",
            field: "Field C",
            variety: "Basmati",
            cost: "₹480",
            status: "upcoming",
            benefit: "+0.20 Ton grain filling weight",
        },
    ],
};

// ==================== FINANCE DATA ====================
export const financeData = {
    expenses: {
        total: 136000,
        breakdown: [
            { category: "Seeds", amount: 14500, color: "#79C98A" },
            { category: "Fertilizer", amount: 38000, color: "#4F8F62" },
            {
                category: "Medicine & Pesticides",
                amount: 18500,
                color: "#E8A94E",
            },
            { category: "Labor", amount: 45000, color: "#6BB8E8" },
            { category: "Irrigation & Power", amount: 12000, color: "#8B6BB8" },
            { category: "Equipment & Other", amount: 8000, color: "#A8B0AA" },
        ],
    },
    revenue: {
        expected: 625680,
        estimatedCost: 136000,
        estimatedProfit: 489680,
        profitMargin: 78.3,
    },
    profitMargin: 78.3,
    varietyWiseProfit: [
        {
            variety: "IR-64",
            field: "Field A",
            area: 2.4,
            expectedYield: 4.8,
            revenue: 164160,
            cost: 35000,
            profit: 129160,
            margin: 78.7,
        },
        {
            variety: "Swarna",
            field: "Field B",
            area: 1.8,
            expectedYield: 3.4,
            revenue: 111520,
            cost: 28000,
            profit: 83520,
            margin: 74.9,
        },
        {
            variety: "Basmati",
            field: "Field C",
            area: 2.2,
            expectedYield: 4.1,
            revenue: 213200,
            cost: 42000,
            profit: 171200,
            margin: 80.3,
        },
        {
            variety: "Samba Mahsuri",
            field: "Field D",
            area: 2.2,
            expectedYield: 3.8,
            revenue: 136800,
            cost: 31000,
            profit: 105800,
            margin: 77.3,
        },
    ],
    monthlyExpenses: [
        { month: "Apr", amount: 28500 },
        { month: "May", amount: 34200 },
        { month: "Jun", amount: 29800 },
        { month: "Jul", amount: 22500 },
        { month: "Aug", amount: 13000 },
        { month: "Sep", amount: 8000 },
    ],
};

// ==================== MARKET DATA ====================
export const marketData = {
    mandiAdvisory:
        "Basmati 1121 prices up +5.1% due to high export demand in Middle East. Consider holding harvested Basmati in dry storage for an additional ₹150-200/Q premium.",
    crops: [
        {
            name: "IR-64 Paddy",
            variety: "IR-64",
            price: 3420,
            unit: "Quintal",
            change: 4.2,
            trend: "up",
            expectedProductionTons: 4.8,
            estimatedSellingRevenue: 164160,
            estimatedCost: 35000,
            expectedProfit: 129160,
            profitMargin: 78.7,
            markets: [
                { name: "Burdwan Mandi", price: 3420 },
                { name: "Memari APMC", price: 3460 },
                { name: "State Rice Pool", price: 3380 },
            ],
            priceHistory: [
                { month: "Apr", price: 3100 },
                { month: "May", price: 3150 },
                { month: "Jun", price: 3200 },
                { month: "Jul", price: 3280 },
                { month: "Aug", price: 3350 },
                { month: "Sep", price: 3420 },
            ],
        },
        {
            name: "Swarna Rice",
            variety: "Swarna",
            price: 3280,
            unit: "Quintal",
            change: 3.8,
            trend: "up",
            expectedProductionTons: 3.4,
            estimatedSellingRevenue: 111520,
            estimatedCost: 28000,
            expectedProfit: 83520,
            profitMargin: 74.9,
            markets: [
                { name: "Burdwan Mandi", price: 3280 },
                { name: "Guskara Market", price: 3310 },
                { name: "Regional APMC", price: 3250 },
            ],
            priceHistory: [
                { month: "Apr", price: 2980 },
                { month: "May", price: 3020 },
                { month: "Jun", price: 3080 },
                { month: "Jul", price: 3150 },
                { month: "Aug", price: 3220 },
                { month: "Sep", price: 3280 },
            ],
        },
        {
            name: "Pusa Basmati 1121",
            variety: "Basmati",
            price: 5200,
            unit: "Quintal",
            change: 5.1,
            trend: "up",
            expectedProductionTons: 4.1,
            estimatedSellingRevenue: 213200,
            estimatedCost: 42000,
            expectedProfit: 171200,
            profitMargin: 80.3,
            markets: [
                { name: "Burdwan Premium Mandi", price: 5200 },
                { name: "Kolkata Wholesale APMC", price: 5350 },
                { name: "Export Millers Hub", price: 5400 },
            ],
            priceHistory: [
                { month: "Apr", price: 4600 },
                { month: "May", price: 4720 },
                { month: "Jun", price: 4850 },
                { month: "Jul", price: 4980 },
                { month: "Aug", price: 5100 },
                { month: "Sep", price: 5200 },
            ],
        },
        {
            name: "Samba Mahsuri (BPT 5204)",
            variety: "Samba Mahsuri",
            price: 3600,
            unit: "Quintal",
            change: 2.9,
            trend: "up",
            expectedProductionTons: 3.8,
            estimatedSellingRevenue: 136800,
            estimatedCost: 31000,
            expectedProfit: 105800,
            profitMargin: 77.3,
            markets: [
                { name: "Burdwan Mandi", price: 3600 },
                { name: "Durgapur Agro Hub", price: 3640 },
                { name: "State Procurement", price: 3550 },
            ],
            priceHistory: [
                { month: "Apr", price: 3300 },
                { month: "May", price: 3360 },
                { month: "Jun", price: 3420 },
                { month: "Jul", price: 3500 },
                { month: "Aug", price: 3550 },
                { month: "Sep", price: 3600 },
            ],
        },
    ],
};

// ==================== ANALYTICS DATA ====================
export const analyticsData = {
    bestVariety: "Basmati (₹1,71,200 Profit · 80.3% Margin)",
    highestYield: "IR-64 (4.8 Ton · 2.0 Ton/ac)",
    metrics: [
        {
            label: "Expected Production",
            value: 16.1,
            unit: "Ton",
            change: 12,
            trend: "up",
        },
        {
            label: "Estimated Revenue",
            value: 625680,
            unit: "₹",
            change: 8,
            trend: "up",
        },
        {
            label: "Production Cost",
            value: 136000,
            unit: "₹",
            change: -4,
            trend: "down",
        },
        {
            label: "Expected Net Profit",
            value: 489680,
            unit: "₹",
            change: 14,
            trend: "up",
        },
    ],
    productionTrend: [
        { month: "Apr", production: 2.1, potential: 2.5 },
        { month: "May", production: 6.4, potential: 7.2 },
        { month: "Jun", production: 11.2, potential: 12.5 },
        { month: "Jul", production: 13.8, potential: 15.4 },
        { month: "Aug", production: 15.2, potential: 17.1 },
        { month: "Sep", production: 16.1, potential: 18.4 },
    ],
    yieldTrend: [
        { month: "Apr", actual: 2.8, potential: 3.2 },
        { month: "May", actual: 3.0, potential: 3.5 },
        { month: "Jun", actual: 3.2, potential: 3.8 },
        { month: "Jul", actual: 3.4, potential: 4.0 },
        { month: "Aug", actual: 3.6, potential: 4.2 },
        { month: "Sep", actual: 3.8, potential: 4.3 },
    ],
    varietyComparison: [
        {
            variety: "Basmati",
            expectedYield: 4.1,
            cost: 42000,
            profit: 171200,
            margin: 80.3,
            efficiency: "Highest Profit & Margin",
        },
        {
            variety: "IR-64",
            expectedYield: 4.8,
            cost: 35000,
            profit: 129160,
            margin: 78.7,
            efficiency: "Highest Physical Volume",
        },
        {
            variety: "Samba Mahsuri",
            expectedYield: 3.8,
            cost: 31000,
            profit: 105800,
            margin: 77.3,
            efficiency: "Optimal Cost-to-Output",
        },
        {
            variety: "Swarna",
            expectedYield: 3.4,
            cost: 28000,
            profit: 83520,
            margin: 74.9,
            efficiency: "Lowest Production Cost",
        },
    ],
};

// ==================== CROP PROTECTION DATA (FOR PROTECTION PAGE) ====================
export const cropProtectionData = {
    yieldProtectedPercent: 92,
    yieldAtRiskTon: 1.3,
    protectedYieldTon: 16.1,
    totalTreatmentCost: 2050,
    valueProtected: 48000,
    breakdown: [
        {
            factor: "Blast Fungal Management",
            score: 85,
            medicine: "Tricyclazole 75% WP",
            status: "Action in Progress",
            field: "Field B",
        },
        {
            factor: "BPH Insect Protection",
            score: 95,
            medicine: "Imidacloprid 17.8 SL",
            status: "Preventive Active",
            field: "Field A",
        },
        {
            factor: "Nutrient Deficiency Shield",
            score: 90,
            medicine: "Urea + DAP Regimen",
            status: "Scheduled",
            field: "Field A & B",
        },
        {
            factor: "Sheath Blight Resistance",
            score: 94,
            medicine: "Hexaconazole Prophylactic",
            status: "Safeguarded",
            field: "Field C",
        },
    ],
    trend: [
        { month: "Apr", protectedYield: 2.1, potentialYield: 2.5 },
        { month: "May", protectedYield: 6.2, potentialYield: 7.2 },
        { month: "Jun", protectedYield: 10.8, potentialYield: 12.5 },
        { month: "Jul", protectedYield: 13.5, potentialYield: 15.4 },
        { month: "Aug", protectedYield: 14.9, potentialYield: 17.1 },
        { month: "Sep", protectedYield: 16.1, potentialYield: 18.4 },
    ],
};

// ==================== RECOMMENDATIONS (ACTIONABLE ALERTS) ====================
export const recommendations = [
    {
        id: 1,
        category: "critical",
        title: "Medicine Required",
        description:
            "Leaf Blast detected in Field B. Spray Tricyclazole 75% WP @ 0.6g/L immediately.",
        impact: "high",
        benefit: "Prevents 15% yield loss (saves ~₹16,700)",
        field: "Field B · Swarna",
        medicine: "Tricyclazole 75% WP (250g)",
        estimatedCost: "₹1,200",
        priority: 1,
        icon: "bug",
    },
    {
        id: 2,
        category: "critical",
        title: "Production Risk",
        description:
            "Expected yield in Field B down 8% due to blast lesions. Rapid curative spray required.",
        impact: "high",
        benefit: "Recovers 0.5 Ton potential yield",
        field: "Field B · Swarna",
        medicine: "Foliar Fungicide Curative",
        estimatedCost: "₹1,200",
        priority: 1,
        icon: "trending-down",
    },
    {
        id: 3,
        category: "important",
        title: "Fertilizer Required",
        description:
            "Field A requires Urea top-dressing (40 kg) for tillering panicle initiation.",
        impact: "medium",
        benefit: "Improves expected yield by +0.25 Ton",
        field: "Field A · IR-64",
        medicine: "Urea (40 kg)",
        estimatedCost: "₹320",
        priority: 2,
        icon: "flask-conical",
    },
    {
        id: 4,
        category: "recommended",
        title: "Profit Opportunity",
        description:
            "Basmati mandi prices up +5.1% (₹5,200/Q). Consider forward contracting Field C.",
        impact: "high",
        benefit: "Locks in ~₹18,000 additional profit margin",
        field: "Field C · Basmati",
        medicine: "Contract Booking",
        estimatedCost: "₹0",
        priority: 3,
        icon: "trending-up",
    },
    {
        id: 5,
        category: "optimization",
        title: "High Production Cost Alert",
        description:
            "Local mandi DAP subsidy available. Procure DAP now for Field B to lower cost.",
        impact: "medium",
        benefit: "Saves ₹1,200 on upcoming fertilizer spend",
        field: "All Fields",
        medicine: "DAP Purchase",
        estimatedCost: "-₹1,200",
        priority: 4,
        icon: "activity",
    },
];

// ==================== ACTIVITY DATA ====================
export const activityData = [
    {
        id: 1,
        action: "Medicine applied — Tricyclazole 75% WP",
        field: "Field B · Swarna",
        time: "2 hours ago",
        icon: "bug",
        type: "disease",
    },
    {
        id: 2,
        action: "Fertilizer applied — Urea (40 kg)",
        field: "Field A · IR-64",
        time: "Yesterday",
        icon: "flask-conical",
        type: "fertilizer",
    },
    {
        id: 3,
        action: "Production estimate updated (+0.3T)",
        field: "Field C · Basmati",
        time: "2 days ago",
        icon: "trending-up",
        type: "yield",
    },
    {
        id: 4,
        action: "Market price alert — Basmati ₹5,200/Q",
        field: "Burdwan APMC",
        time: "3 days ago",
        icon: "activity",
        type: "market",
    },
    {
        id: 5,
        action: "Water schedule adjusted (Rain tonight)",
        field: "All Fields",
        time: "4 days ago",
        icon: "droplets",
        type: "irrigation",
    },
    {
        id: 6,
        action: "Soil NPK test recorded",
        field: "Field D · Samba Mahsuri",
        time: "5 days ago",
        icon: "test-tubes",
        type: "soil",
    },
];

// ==================== CALENDAR DATA ====================
export const calendarData = [
    {
        date: "Sep 02",
        task: "Urea Top-Dressing (40 kg)",
        field: "Field A · IR-64",
        status: "upcoming",
        type: "fertilizer",
    },
    {
        date: "Sep 03",
        task: "Blast Fungicide Treatment",
        field: "Field B · Swarna",
        status: "upcoming",
        type: "disease",
    },
    {
        date: "Sep 05",
        task: "DAP Application (25 kg)",
        field: "Field B · Swarna",
        status: "upcoming",
        type: "fertilizer",
    },
    {
        date: "Sep 07",
        task: "Basmati MOP Potash Spray",
        field: "Field C · Basmati",
        status: "upcoming",
        type: "fertilizer",
    },
    {
        date: "Sep 10",
        task: "BPH Pheromone Check",
        field: "Field A · IR-64",
        status: "upcoming",
        type: "spray",
    },
    {
        date: "Sep 15",
        task: "Zinc Sulfate Boost",
        field: "Field D · Samba Mahsuri",
        status: "upcoming",
        type: "fertilizer",
    },
    {
        date: "Sep 25",
        task: "Panicle Initiation Assessment",
        field: "All Fields",
        status: "upcoming",
        type: "yield",
    },
    {
        date: "Oct 15",
        task: "Early IR-64 Harvest",
        field: "Field A · IR-64",
        status: "upcoming",
        type: "harvest",
    },
];

// ==================== MOCK SERVICE FUNCTIONS ====================
export const getYieldPrediction = (fieldId) => {
    const crop = crops.find((c) => c.fieldId === fieldId);
    return new Promise((resolve) =>
        setTimeout(
            () =>
                resolve({
                    expected: crop?.expectedYield || 4.8,
                    potential: crop?.potentialYield || 5.4,
                    gap: (
                        (crop?.potentialYield || 5.4) -
                        (crop?.expectedYield || 4.8)
                    ).toFixed(1),
                    revenue: crop?.expectedRevenue || 164160,
                    profit: crop?.expectedProfit || 129160,
                }),
            300,
        ),
    );
};

export const getRecommendations = () => {
    return new Promise((resolve) =>
        setTimeout(() => resolve(recommendations), 300),
    );
};

export const analyzeCropImage = (imageData) => {
    return new Promise((resolve) =>
        setTimeout(
            () =>
                resolve({
                    problem: "Leaf Blast (Magnaporthe oryzae)",
                    confidence: 91,
                    severity: "Moderate",
                    medicine: "Tricyclazole 75% WP",
                    dosage: "0.6 g / L",
                    estimatedCost: "₹1,200",
                    productionImpact: "-15% yield if untreated",
                    actions: [
                        "Spray Tricyclazole 75% WP @ 0.6g/L immediately",
                        "Avoid additional nitrogen fertilizer until blast subsides",
                        "Maintain 2-3 cm standing water in field",
                        "Recheck leaves after 3 days for lesion dry-up",
                    ],
                }),
            1500,
        ),
    );
};

export const askAgricultureAI = (question, fieldContext) => {
    return new Promise((resolve) =>
        setTimeout(() => {
            const responses = {
                default: {
                    answer: "Based on your rice varieties (IR-64, Swarna, Basmati, Samba Mahsuri), your total expected production is 16.1 Tons with an estimated profit of ₹4,89,680. Field B needs immediate Tricyclazole treatment for Leaf Blast to safeguard ₹16,700 worth of yield.",
                    confidence: 90,
                },
                soil: {
                    answer: "Soil test pH is optimal at 6.2-6.7. Field B shows lower available Phosphorus (55%), so applying 25 kg DAP will help recover tillering yield.",
                    confidence: 92,
                },
                weather: {
                    answer: "Rain is expected tonight (62% chance). Postpone irrigation to save pumping electricity. High humidity may accelerate blast spores; inspect Field B tomorrow.",
                    confidence: 94,
                },
            };
            resolve(responses[fieldContext] || responses.default);
        }, 1000),
    );
};

export const getWeatherData = () => {
    return new Promise((resolve) =>
        setTimeout(() => resolve(weatherData), 300),
    );
};

export const getSoilData = () => {
    return new Promise((resolve) => setTimeout(() => resolve(soilData), 300));
};

export const getIrrigationStatus = () => {
    return new Promise((resolve) =>
        setTimeout(() => resolve(irrigationData), 300),
    );
};
