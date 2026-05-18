const HOSPITAL_SERVICE_MAP = {
  'General Hospitals': ['Emergency', 'Surgery', 'Radiology', 'Pediatrics', 'Maternity', 'Cardiology', 'Laboratory', 'Outpatient'],
  'Specialized Hospitals': ['Specialized Care', 'Radiology', 'Laboratory', 'Rehabilitation'],
  'Internal / Medical Hospitals': ['Internal Medicine', 'Cardiology', 'Endocrinology', 'Laboratory'],
  'Surgical Hospitals': ['Surgery', 'Anesthesiology', 'Operative Care', 'Radiology'],
  'Maternal & Child Hospitals': ['Maternity', 'Pediatrics', 'Neonatal', 'Obstetrics'],
  'Teaching & Referral Hospitals': ['Emergency', 'Surgery', 'Radiology', 'Research', 'Laboratory', 'Teaching Clinics'],
  'Clinics & Primary Care Facilities': ['General Practice', 'Outpatient', 'Vaccination', 'Basic Diagnostics']
};

const PHARMACY_SERVICE_MAP = {
  'Hospital Pharmacy': [
    'Dispensing prescribed medicines',
    'Inpatient medication supply',
    'Outpatient medication supply',
    'Medication storage and management',
    'Clinical pharmacy services',
    'Drug interaction checking',
    'Patient medication counseling',
    'Emergency drug supply',
    'Inventory control',
    'Support for doctors and nurses'
  ],
  'Community (Retail) Pharmacy': [
    'Dispensing prescription medicines',
    'Selling over-the-counter (OTC) drugs',
    'Patient counseling',
    'Health advice for minor illnesses',
    'Blood pressure checking',
    'Blood sugar testing',
    'First aid supplies',
    'Family planning products',
    'Referral to health facilities',
    'Health education'
  ],
  'Clinical Pharmacy': [
    'Medication therapy management',
    'Drug review and evaluation',
    'Monitoring drug effectiveness',
    'Preventing drug interactions',
    'Adjusting drug doses',
    'Patient counseling',
    'Supporting medical teams',
    'Adverse drug reaction monitoring',
    'Chronic disease medication support',
    'Medication safety services'
  ],
  'Industrial Pharmacy': [
    'Drug manufacturing',
    'Quality control testing',
    'Drug formulation',
    'Packaging and labeling',
    'Research and development',
    'Production planning',
    'Regulatory compliance',
    'Storage of finished products',
    'Distribution preparation',
    'Pharmacovigilance support'
  ],
  'Wholesale / Distribution Pharmacy': [
    'Bulk purchase of medicines',
    'Drug storage and warehousing',
    'Distribution to pharmacies and hospitals',
    'Cold chain management',
    'Inventory management',
    'Order processing',
    'Transportation coordination',
    'Stock monitoring',
    'Quality assurance',
    'Supply chain management'
  ],
  'Compounding Pharmacy': [
    'Preparing customized medicines',
    'Mixing special drug formulas',
    'Pediatric dose preparation',
    'Geriatric dose preparation',
    'Allergy-free medication preparation',
    'Topical preparations (creams, ointments)',
    'Liquid medicine preparation',
    'Patient-specific labeling',
    'Doctor consultation support',
    'Safe packaging'
  ],
  'Regulatory / Public Health Pharmacy': [
    'Drug regulation and control',
    'Drug inspection',
    'Licensing of pharmacies',
    'Quality assurance',
    'Pharmacovigilance',
    'Monitoring illegal drugs',
    'Public health drug programs',
    'Policy implementation',
    'Drug information services',
    'Training and supervision'
  ]
};

const ALL_SERVICE_OPTIONS = Array.from(new Set([
  ...Object.values(HOSPITAL_SERVICE_MAP).flat(),
  ...Object.values(PHARMACY_SERVICE_MAP).flat()
]));

module.exports = {
  HOSPITAL_SERVICE_MAP,
  PHARMACY_SERVICE_MAP,
  ALL_SERVICE_OPTIONS
};
