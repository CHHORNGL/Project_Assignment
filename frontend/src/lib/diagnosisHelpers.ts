export interface DiagnosisSymptomItem {
  id?: number;
  name: string;
  name_kh?: string;
}

export type DiagnosisCategoryId = 2 | 3 | 4 | 5;

export interface CropSymptomState {
  cropId: string;
  selectedNames: string[];
  searchQuery: string;
}

export function categoryOfSymptom(name: string, nameKh?: string): DiagnosisCategoryId {
  const n = (name || "").toLowerCase();
  const kh = nameKh || "";
  if (
    n.includes("leaf") ||
    n.includes("leaves") ||
    n.includes("spot") ||
    n.includes("yellow") ||
    n.includes("chlorosis") ||
    n.includes("rust") ||
    n.includes("streak") ||
    n.includes("blast") ||
    n.includes("blight") ||
    n.includes("curl") ||
    n.includes("mildew") ||
    n.includes("scorch") ||
    n.includes("stippl") ||
    n.includes("defoliat") ||
    n.includes("blade") ||
    n.includes("speck") ||
    n.includes("mottl") ||
    kh.includes("ស្លឹក")
  ) {
    return 2;
  }
  if (
    n.includes("stem") ||
    n.includes("stalk") ||
    n.includes("sheath") ||
    n.includes("canker") ||
    n.includes("rot") ||
    n.includes("vascular") ||
    n.includes("bore") ||
    n.includes("dead heart") ||
    n.includes("root") ||
    n.includes("corm") ||
    n.includes("collar") ||
    n.includes("bulb") ||
    n.includes("pith") ||
    n.includes("girdl") ||
    n.includes("internode") ||
    n.includes("lodging") ||
    kh.includes("ដើម") ||
    kh.includes("ស្រទប") ||
    kh.includes("បណ្ដូល") ||
    kh.includes("ឫស") ||
    kh.includes("គល់") ||
    kh.includes("ថ្នាំង")
  ) {
    return 3;
  }
  if (
    n.includes("fruit") ||
    n.includes("grain") ||
    n.includes("pod") ||
    n.includes("flower") ||
    n.includes("seed") ||
    n.includes("panicle") ||
    n.includes("ear") ||
    n.includes("tuber") ||
    n.includes("peel") ||
    n.includes("husk") ||
    n.includes("scab") ||
    n.includes("floret")
  ) {
    return 4;
  }
  return 5;
}

export function groupSymptomsForCrop(
  cropsData: Record<string, Array<DiagnosisSymptomItem | string>>,
  cropId: string,
  categorizer: (name: string, nameKh?: string) => DiagnosisCategoryId = categoryOfSymptom,
): {
  categories: Record<DiagnosisCategoryId, DiagnosisSymptomItem[]>;
  isEmpty: boolean;
  totalCount: number;
} {
  const categories: Record<DiagnosisCategoryId, DiagnosisSymptomItem[]> = {
    2: [],
    3: [],
    4: [],
    5: [],
  };
  const rows = cropsData[String(cropId)] || [];
  for (const item of rows) {
    const normalized: DiagnosisSymptomItem = typeof item === "string" ? { name: item } : item;
    const catId = categorizer(normalized.name, normalized.name_kh);
    categories[catId].push(normalized);
  }
  return {
    categories,
    isEmpty: rows.length === 0,
    totalCount: rows.length,
  };
}

export function selectCropState(current: CropSymptomState, nextCropId: string): CropSymptomState {
  const nextId = String(nextCropId);
  const cropChanged = String(current.cropId) !== nextId;
  if (!cropChanged) {
    return current;
  }
  return {
    cropId: nextId,
    selectedNames: [],
    searchQuery: "",
  };
}
