export type PersonalFields = {
  fullName: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  birthDay: string;
  height: string;
  education: string;
  occupation: string;
  income: string;
  caste: string;
  subCaste: string;
  complexion: string;
};

export type HoroscopeFields = {
  kuldevat: string;
  rashi: string;
  nakshatra: string;
  nadi: string;
  gan: string;
  devak: string;
  bloodGroup: string;
  varna: string;
  gotra: string;
};

export type FamilyFields = {
  father: string;
  mother: string;
  address: string;
  nativePlace: string;
  siblings: string;
  relatives: string;
};

export type ContactFields = {
  selfContact: string;
  parentContact: string;
  officeContact: string;
};

export type PreferenceFields = {
  expectation: string;
  notes: string;
};

export type StructuredFields = {
  personal: PersonalFields;
  horoscope: HoroscopeFields;
  family: FamilyFields;
  contacts: ContactFields;
  preferences: PreferenceFields;
};

export type TemplateSettings = {
  centerName: string;
  idLabel: string;
  idValue: string;
  watermarkText: string;
  footerText: string;
  accentColor: string;
  showWatermark: boolean;
};

export type PreviewMetadata = {
  engineUsed: string;
  pageCount: number;
  warnings: string[];
  extractedFromPdfText: boolean;
};

export type OcrPreviewResponse = {
  rawOcrText: string;
  structuredFields: StructuredFields;
  templateSettings: TemplateSettings;
  missingFields: string[];
  lowConfidenceFields: string[];
  metadata: PreviewMetadata;
  photoDataUrl?: string | null;
};

export type ReparseResponse = {
  structuredFields: StructuredFields;
  missingFields: string[];
  lowConfidenceFields: string[];
};

export const defaultTemplateSettings = (): TemplateSettings => ({
  centerName: 'भैरवनाथ वधू वर सूचक केंद्र',
  idLabel: 'आयडी क्रमांक',
  idValue: '',
  watermarkText: 'भैरवनाथ वधू वर सूचक केंद्र',
  footerText: 'भैरवनाथ वधू वर सूचक केंद्र',
  accentColor: '#9a2d15',
  showWatermark: true,
});

export const blankStructuredFields = (): StructuredFields => ({
  personal: {
    fullName: '',
    birthDate: '',
    birthTime: '',
    birthPlace: '',
    birthDay: '',
    height: '',
    education: '',
    occupation: '',
    income: '',
    caste: '',
    subCaste: '',
    complexion: '',
  },
  horoscope: {
    kuldevat: '',
    rashi: '',
    nakshatra: '',
    nadi: '',
    gan: '',
    devak: '',
    bloodGroup: '',
    varna: '',
    gotra: '',
  },
  family: {
    father: '',
    mother: '',
    address: '',
    nativePlace: '',
    siblings: '',
    relatives: '',
  },
  contacts: {
    selfContact: '',
    parentContact: '',
    officeContact: '9975285800',
  },
  preferences: {
    expectation: '',
    notes: '',
  },
});
