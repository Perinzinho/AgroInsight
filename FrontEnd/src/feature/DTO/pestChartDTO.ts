
export interface PestDetectionItemDTO {
  
  id: number;
  label: string;
  scientificName?: string;
  value: number;
  culture?: string;
}

export interface PestDetectionChartDTO {
  title: string;
  subtitle?: string;
  unit: string;
  items: PestDetectionItemDTO[];
}

export function toChartItems(
  dto: PestDetectionChartDTO
): { label: string; value: number }[] {
  return dto.items.map((item) => ({
    label: item.label,
    value: item.value,
  }));
}