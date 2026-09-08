
export interface PestDetectionItemDTO {
  id: number;
  label: string;
  scientificName?: string;
  value: number;
  color?: string;
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

export function toPieChartData(dto: PestDetectionChartDTO): {
  items: { label: string; value: number }[];
  colors: string[];
} {
  return {
    items: toChartItems(dto),
    colors: dto.items.map((item) => item.color ?? '#52B788'),
  };
}