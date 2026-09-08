
export interface FertilizationOperationDTO {
  id: number;
  operation: string;
  label: string;
  value: number;
  color?: string;
}

export interface FertilizationChartDTO {
  title: string;
  subtitle: string;
  unit: string;
  weightedAverage: number;
  totalOperations: number;
  items: FertilizationOperationDTO[];
}

export function toPieChartData(dto: FertilizationChartDTO): {
  items: { label: string; value: number }[];
  colors: string[];
} {
  return {
    items: dto.items.map((operation) => ({
      label: operation.label,
      value: operation.value,
    })),
    colors: dto.items.map((operation) => operation.color ?? '#52B788'),
  };
}